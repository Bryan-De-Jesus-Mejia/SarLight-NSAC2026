import { LOCALE_TAG, getLang, type Lang } from "@/i18n/core";

/*
 * Dates and numbers in the language on screen. These read the current
 * language when called, so a component that uses them should also use `useT()`
 * (or `useLang()`): that is what makes it draw again when the language changes.
 *
 * A page that the server also draws (such as /methods) passes the language it got
 * from `useLang()` as the last argument: that hook still says "en" while the page
 * hydrates, so the text matches what the server sent.
 */

const tag = (lang: Lang = getLang()): string => LOCALE_TAG[lang];

const dateFormats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(key: string, options: Intl.DateTimeFormatOptions, lang?: Lang): Intl.DateTimeFormat {
  const id = `${key}|${tag(lang)}`;
  let format = dateFormats.get(id);
  if (!format) dateFormats.set(id, (format = new Intl.DateTimeFormat(tag(lang), { ...options, timeZone: "UTC" })));
  return format;
}

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** "2025-11-04" → "Nov 4, 2025" / "4 nov 2025". */
export function formatDate(iso: string, lang?: Lang): string {
  return dateFormat("date", { day: "numeric", month: "short", year: "numeric" }, lang).format(toDate(iso));
}

/** Short month name: "Nov" / "nov". */
export function monthName(monthIndex: number): string {
  const date = new Date(Date.UTC(2000, monthIndex, 1));
  return dateFormat("month", { month: "short" }).format(date).replace(/\.$/, "");
}

/** "2025-11-04" → "Nov ’25". */
export function formatMonth(iso: string): string {
  const date = toDate(iso);
  return `${monthName(date.getUTCMonth())} ’${String(date.getUTCFullYear()).slice(2)}`;
}

/** "Nov 4" / "4 nov", for things with no year. */
export function formatDayMonth(timestamp: number): string {
  return new Intl.DateTimeFormat(tag(), { month: "short", day: "numeric" }).format(timestamp).replace(/\.$/, "");
}

/** "Sat, Nov 15, 4:30 PM" / "sáb, 15 nov, 16:30", in the visitor's own time zone. */
export function formatWhen(timestamp: number, lang?: Lang): string {
  return new Intl.DateTimeFormat(tag(lang), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(timestamp)
    .replace(/\.(?=,| )/g, "");
}

/** Time of day for the chat list. */
export function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat(tag(), { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

const numberFormats = new Map<string, Intl.NumberFormat>();
/** A number with a fixed ceiling of decimals, in the language on screen. */
export function formatNumber(value: number, maxDecimals = 0, minDecimals = 0, lang?: Lang): string {
  const id = `${tag(lang)}|${maxDecimals}|${minDecimals}`;
  let format = numberFormats.get(id);
  if (!format) {
    numberFormats.set(
      id,
      (format = new Intl.NumberFormat(tag(lang), { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals })),
    );
  }
  return format.format(value);
}

/** Number with a sensible count of decimals for its size. */
export function formatValue(value: number, lang?: Lang): string {
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return formatNumber(value, decimals, 0, lang);
}

/** Signed number: "+18.4" / "−3.1" (true minus sign). */
export function formatSigned(value: number): string {
  const body = formatValue(Math.abs(value));
  return `${value < 0 ? "−" : "+"}${body}`;
}

export function formatPValue(p: number): string {
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`;
}
