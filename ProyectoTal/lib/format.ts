const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** "2025-11-04" → "Nov 4, 2025". */
export function formatDate(iso: string): string {
  return DATE_FORMAT.format(toDate(iso));
}

/** "2025-11-04" → "Nov 25". */
export function formatMonth(iso: string): string {
  return MONTH_FORMAT.format(toDate(iso)).replace(" ", " ’");
}

/** Number with a sensible count of decimals for its size. */
export function formatValue(value: number): string {
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
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
