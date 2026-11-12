/**
 * Old ("legacy") WesMaps scraper — the default source.
 * ----------------------------------------------------
 * As of Nov 2026 Wesleyan runs two WesMaps sites. Faculty were told to point
 * students at this one (owaprod-pub) because the new site at
 * webapps.wesleyan.edu/wesmaps is missing courses and edits. See
 * src/lib/wesmaps.ts for how the source is chosen.
 *
 * Old WesMaps is unauthenticated, so no student
 * credentials are ever needed. Two page types matter:
 *
 * 1. Listing page - all sections for a subject in a term:
 *    https://owaprod-pub.wesleyan.edu/reg/!wesmaps_page.html?crse_list=<SUBJ>&term=<TERM>&offered=Y
 *    Gives us section labels (e.g. "COMP212-01"), the course title, and the
 *    `crse` id used to reach the detail page.
 *
 * 2. Detail page - full info for one `crse` id (often several sections share one):
 *    https://owaprod-pub.wesleyan.edu/reg/!wesmaps_page.html?crse=<CRSE>&term=<TERM>
 *    Gives us "SECTION NN" blocks, each with "Total Enrollment Limit:" and
 *    "Seats Available:" figures - this is what we poll for changes.
 *
 * NOTE: WesMaps' markup is old-school ASP/HTML and can shift over time. The
 * parsing here works off plain text extracted from the page rather than
 * brittle CSS selectors. "Seats Available:" is typically only present during
 * live registration windows — null seatsAvailable outside those windows is
 * expected (see src/lib/registration.ts). Re-verify during add/drop, and keep
 * polling gated to those windows so we stay a good citizen of Wesleyan's servers.
 */

import * as cheerio from "cheerio";
import type { ListedSection, SeatInfo, WesmapsProvider } from "./wesmaps-types";

import { OLD_WESMAPS_URL as BASE } from "./links";

// Be a polite scraper: identify ourselves and don't hammer the server.
const FETCH_HEADERS = {
  "User-Agent": "Nabb/0.1 (student-built tool; contact: <your-email>)",
};

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`WesMaps request failed (${res.status}) for ${url}`);
  }
  return res.text();
}

/** Search all sections offered for a subject code (e.g. "COMP") in a given term. */
async function searchCourses(subject: string, term: string): Promise<ListedSection[]> {
  const url = `${BASE}?crse_list=${encodeURIComponent(subject)}&term=${encodeURIComponent(term)}&offered=Y`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);

  const results: ListedSection[] = [];

  // Each course row is a link like "COMP212-01" pointing at ?crse=XXXXXX&term=YYYY,
  // followed by a table cell with the course title.
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const label = $(el).text().trim();
    const match = href.match(/crse=(\d+).*?term=(\d+)|term=(\d+).*?crse=(\d+)/);
    const sectionLabelMatch = label.match(/^[A-Z]{2,6}\d+[A-Z]?-\d+$/);

    if (match && sectionLabelMatch) {
      const crse = match[1] || match[4];
      const termCode = match[2] || match[3];
      // Course title is usually the very next table cell/sibling text node.
      const row = $(el).closest("tr");
      const cells = row.find("td");
      const courseTitle = cells.length > 1 ? $(cells[1]).text().trim() : "";

      results.push({
        sectionLabel: label,
        courseTitle: courseTitle || label,
        crse,
        term: termCode,
      });
    }
  });

  // De-dupe (the same link can appear more than once in some layouts).
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.sectionLabel}-${r.crse}-${r.term}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Fetch seat info for every section on a given crse+term detail page. */
async function fetchSeatInfo(crse: string, term: string): Promise<SeatInfo[]> {
  const url = `${BASE}?crse=${encodeURIComponent(crse)}&term=${encodeURIComponent(term)}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const text = $.root().text().replace(/\s+/g, " ");

  const results: SeatInfo[] = [];

  // Split the page on "SECTION NN" markers and parse each chunk independently.
  const sectionSplits = [...text.matchAll(/SECTION\s+(\d+)/g)];
  for (let i = 0; i < sectionSplits.length; i++) {
    const sectionNum = sectionSplits[i][1];
    const start = sectionSplits[i].index ?? 0;
    const end = i + 1 < sectionSplits.length ? sectionSplits[i + 1].index : text.length;
    const chunk = text.slice(start, end);

    const limitMatch = chunk.match(/Total Enrollment Limit:\s*(\d+)/i);
    const seatsMatch = chunk.match(/Seats Available:\s*(-?\d+)/i);

    results.push({
      sectionNum,
      enrollmentLimit: limitMatch ? parseInt(limitMatch[1], 10) : null,
      seatsAvailable: seatsMatch ? parseInt(seatsMatch[1], 10) : null,
    });
  }

  return results;
}

export const legacyWesmaps: WesmapsProvider = {
  name: "legacy",
  searchCourses,
  fetchSeatInfo,
};
