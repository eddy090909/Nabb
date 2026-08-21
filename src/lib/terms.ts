export type TermOption = { code: string; label: string };

/** Curated WesMaps term codes — update each semester (no reliable public dropdown to scrape). */
export const TERMS: TermOption[] = [
  { code: "1269", label: "Fall 2026" },
  { code: "1271", label: "Spring 2027" },
];

export const DEFAULT_TERM = TERMS[0].code;
