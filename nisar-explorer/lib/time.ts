import type { TimeRange } from "@/data/types";

const DAY_MS = 86_400_000;

const isoToMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** Number of whole days between the start and the end of a range. */
export function dayCount(range: TimeRange): number {
  return Math.round((isoToMs(range.end) - isoToMs(range.start)) / DAY_MS);
}

/** Day index within a range (0 = range start) → ISO date. */
export function dayToIso(range: TimeRange, day: number): string {
  return new Date(isoToMs(range.start) + day * DAY_MS).toISOString().slice(0, 10);
}

/** ISO date → day index within a range (may fall outside 0…dayCount). */
export function isoToDay(range: TimeRange, iso: string): number {
  return Math.round((isoToMs(iso) - isoToMs(range.start)) / DAY_MS);
}
