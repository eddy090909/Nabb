/**
 * Registration windows — when WesMaps publishes "Seats Available:" and
 * when Nabb should poll. Outside these windows, seatsAvailable is
 * typically null; that is expected, not a scraper failure.
 *
 * Override with REGISTRATION_WINDOWS, e.g.:
 *   2026-09-07:2026-09-18,2026-11-18:2026-11-21
 */

export type RegistrationWindow = { start: string; end: string };

const TIME_ZONE = "America/New_York";

/** Default windows for Fall 2026 / spring adjustment (ET calendar days, inclusive). */
const DEFAULT_WINDOWS: RegistrationWindow[] = [
  { start: "2026-09-07", end: "2026-09-18" }, // Fall add/drop (confirmed)
  // TODO: Confirm spring Adjustment end date closer to November — catalog only
  // states Nov 18 start; Nov 21 is a placeholder until then (low priority vs Sept).
  { start: "2026-11-18", end: "2026-11-21" },
];

function parseWindowsFromEnv(raw: string | undefined): RegistrationWindow[] | null {
  if (!raw?.trim()) return null;
  const windows: RegistrationWindow[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [start, end] = trimmed.split(":").map((s) => s.trim());
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      console.warn(`Ignoring invalid REGISTRATION_WINDOWS entry: ${trimmed}`);
      continue;
    }
    windows.push({ start, end });
  }
  return windows.length ? windows : null;
}

export function getRegistrationWindows(): RegistrationWindow[] {
  return parseWindowsFromEnv(process.env.REGISTRATION_WINDOWS) ?? DEFAULT_WINDOWS;
}

/** YYYY-MM-DD for `date` in America/New_York. */
function etCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isRegistrationWindowActive(date: Date = new Date()): boolean {
  const day = etCalendarDate(date);
  return getRegistrationWindows().some((w) => day >= w.start && day <= w.end);
}
