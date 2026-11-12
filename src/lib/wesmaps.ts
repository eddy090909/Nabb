/**
 * WesMaps source selector
 * -----------------------
 * Wesleyan currently runs two WesMaps sites:
 *   - old: https://owaprod-pub.wesleyan.edu/reg/!wesmaps_page.html  (default)
 *   - new: https://webapps.wesleyan.edu/wesmaps/wesmaps-search.html
 * Students register on Stellic, but neither Stellic nor new WesMaps lists every
 * course yet, so faculty were told (Nov 2026) to send students to old WesMaps.
 * That advice is expected to change, so the source is an env var:
 *
 *   WESMAPS_SOURCE=legacy   (default) old WesMaps
 *   WESMAPS_SOURCE=new      new WesMaps (stub until src/lib/wesmaps-new.ts is built)
 *
 * The rest of the app imports only from this file.
 */

import { legacyWesmaps } from "./wesmaps-legacy";
import { newWesmaps } from "./wesmaps-new";
import type { ListedSection, SeatInfo, WesmapsProvider, WesmapsSourceName } from "./wesmaps-types";

export type { ListedSection, SeatInfo, WesmapsSourceName } from "./wesmaps-types";

export function getWesmapsSource(): WesmapsSourceName {
  const raw = process.env.WESMAPS_SOURCE?.trim().toLowerCase();
  if (!raw || raw === "legacy" || raw === "old") return "legacy";
  if (raw === "new") return "new";
  console.warn(`Unknown WESMAPS_SOURCE "${process.env.WESMAPS_SOURCE}" — using old WesMaps.`);
  return "legacy";
}

function provider(): WesmapsProvider {
  return getWesmapsSource() === "new" ? newWesmaps : legacyWesmaps;
}

export function searchCourses(subject: string, term: string): Promise<ListedSection[]> {
  return provider().searchCourses(subject, term);
}

export function fetchSeatInfo(crse: string, term: string): Promise<SeatInfo[]> {
  return provider().fetchSeatInfo(crse, term);
}

/** Convenience: seat info for one specific section label, e.g. "COMP212-01". */
export async function fetchSeatInfoForSection(
  crse: string,
  term: string,
  sectionLabel: string
): Promise<SeatInfo | null> {
  const sectionNum = sectionLabel.split("-").pop() ?? "";
  const all = await fetchSeatInfo(crse, term);
  return all.find((s) => s.sectionNum === sectionNum) ?? null;
}
