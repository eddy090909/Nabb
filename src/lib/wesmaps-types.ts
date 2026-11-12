/** Shared shapes every WesMaps source must produce. */

export interface ListedSection {
  sectionLabel: string; // e.g. "COMP212-01"
  courseTitle: string;
  crse: string; // the source's course id, stored on each Watch
  term: string; // WesMaps term code, e.g. "1271" = Spring 2027
}

export interface SeatInfo {
  sectionNum: string; // "01", "02", ...
  enrollmentLimit: number | null;
  seatsAvailable: number | null; // null = not published (normal outside registration windows)
}

export type WesmapsSourceName = "legacy" | "new";

export interface WesmapsProvider {
  name: WesmapsSourceName;
  /** All sections offered for a subject code (e.g. "COMP") in a term. */
  searchCourses(subject: string, term: string): Promise<ListedSection[]>;
  /** Seat info for every section on one course (crse) in a term. */
  fetchSeatInfo(crse: string, term: string): Promise<SeatInfo[]>;
}
