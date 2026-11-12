/**
 * New WesMaps (webapps.wesleyan.edu/wesmaps) — NOT IMPLEMENTED YET.
 * ----------------------------------------------------------------
 * Wesleyan launched a second WesMaps in fall 2026. As of Nov 2026 faculty were
 * told it is missing courses and isn't picking up course edits, so Nabb keeps
 * using old WesMaps by default (src/lib/wesmaps-legacy.ts).
 *
 * This stub exists so switching later is a one-file change. Before filling it
 * in, check the following on the live site:
 *   - Whether the search page loads its data from a JSON endpoint (check the
 *     browser's Network tab). An endpoint is far sturdier than parsing HTML.
 *   - Whether it shows per-section enrollment limits / seats available at all.
 *   - What course id it uses. If it isn't old WesMaps' `crse`, existing
 *     Watch rows (which store `crse`) need mapping before switching sources.
 *   - Whether term codes match the ones in src/lib/terms.ts.
 */

import type { WesmapsProvider } from "./wesmaps-types";

export { NEW_WESMAPS_URL } from "./links";

function notReady(): never {
  throw new Error(
    "WESMAPS_SOURCE=new is set, but new WesMaps support isn't built yet. " +
      "Unset WESMAPS_SOURCE (or set it to 'legacy') to use old WesMaps."
  );
}

export const newWesmaps: WesmapsProvider = {
  name: "new",
  async searchCourses() {
    return notReady();
  },
  async fetchSeatInfo() {
    return notReady();
  },
};
