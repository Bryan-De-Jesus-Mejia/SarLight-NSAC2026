import type { CaseContext, EventDetail } from "@/data/types";

/**
 * Outside evidence for a case: the weather records (ERA5 via Open-Meteo) and
 * earthquakes (USGS) around the key date of the analysis. Shared by the
 * "Why it happened" card and the assistant (client and server).
 */

export interface Evidence {
  keyDate: string | null;
  rainWeek: number | null;
  rainRatio: number | null;
  hottest: number | null;
  hotDays: number;
  gust: number | null;
  quake: { mag: number; place: string; date: string; depthKm: number; km: number } | null;
}

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

export function keyDateOf(detail: EventDetail): string | null {
  const x = detail.extra;
  if (!x) return detail.analyses[0]?.post.date.slice(0, 10) ?? null;
  if (x.kind === "change" || x.kind === "displacement") return x.eventDate;
  if (x.kind === "agriculture") {
    const o = x.orbits[0];
    return o.mode === "flood" ? o.peakDate : o.peakIntervalEnd;
  }
  return null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function evidenceOf(detail: EventDetail, ctx: CaseContext | undefined): Evidence {
  const keyDate = keyDateOf(detail);
  const e: Evidence = { keyDate, rainWeek: null, rainRatio: null, hottest: null, hotDays: 0, gust: null, quake: null };
  const w = ctx?.weather;
  if (w && w.dates.length) {
    const t = keyDate ? ms(keyDate) : ms(w.dates[w.dates.length - 1]);
    const inWeek = (d: string) => ms(d) <= t && ms(d) > t - 7 * DAY;
    const rain = w.rainMm.map((v) => v ?? 0);
    e.rainWeek = w.dates.reduce((sum, d, i) => sum + (inWeek(d) ? rain[i] : 0), 0);
    const meanWeek = (rain.reduce((a, b) => a + b, 0) / rain.length) * 7;
    e.rainRatio = meanWeek > 0.5 ? e.rainWeek / meanWeek : null;
    const temps = w.tmaxC.filter((v): v is number => v !== null);
    e.hottest = temps.length ? Math.max(...temps) : null;
    e.hotDays = temps.filter((v) => v >= 35).length;
    const near = w.dates.map((d, i) => (Math.abs(ms(d) - t) <= 3 * DAY ? w.gustKmh[i] : null)).filter((v): v is number => v !== null);
    e.gust = near.length ? Math.max(...near) : null;
  }
  const q = ctx?.quakes?.[0];
  if (q) {
    e.quake = {
      mag: q.mag,
      place: q.place,
      date: q.time.slice(0, 10),
      depthKm: Math.round(q.depthKm),
      km: Math.round(haversineKm(detail.lat, detail.lon, q.lat, q.lon)),
    };
  }
  return e;
}

