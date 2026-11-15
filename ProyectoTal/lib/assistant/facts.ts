import type { ChangeType, EventDetail } from "@/data/types";
import { evidenceOf } from "@/lib/evidence";
import { fieldWatchOf, type Level } from "@/lib/impact";

/**
 * One compact record per case: every number the assistant may quote. Built on
 * the server from the same data the panels show, so the assistant can never
 * say something the app does not.
 */
export interface CaseFact {
  id: string;
  name: string;
  type: ChangeType;
  region: string;
  country: string;
  lat: number;
  lon: number;
  start: string;
  end: string;
  /** Area the analysis flagged, km². */
  km2: number;
  sensor: "NISAR" | "Sentinel-1";
  people?: number;
  exposed?: number;
  keyDate: string | null;
  rainWeekMm?: number;
  rainRatio?: number;
  hottestC?: number;
  hotDays?: number;
  gustKmh?: number;
  quake?: { mag: number; place: string; date: string; depthKm: number; km: number };
  field?: { level: Level; title: string };
  /** Glacier: fastest ice, m/day. */
  iceMDay?: number;
  /** Earthquake/landslide: largest ground motion toward/away from the satellite, cm. */
  motionCm?: number;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function factOf(d: EventDetail): CaseFact {
  const e = evidenceOf(d, d.context);
  const x = d.extra;
  const field = fieldWatchOf(d);
  const fact: CaseFact = {
    id: d.id,
    name: d.name.replace(/ analysis$/i, ""),
    type: d.type,
    region: d.region,
    country: d.country,
    lat: r1(d.lat),
    lon: r1(d.lon),
    start: d.startDate.slice(0, 10),
    end: d.endDate.slice(0, 10),
    km2: r1(d.changedAreaKm2),
    sensor: d.analyses[0] && d.analyses[0].sensor !== "nisar" ? "Sentinel-1" : "NISAR",
    keyDate: e.keyDate,
  };
  if (d.people) {
    fact.people = d.people.areaPeople;
    if (d.people.exposedPeople !== undefined) fact.exposed = d.people.exposedPeople;
  }
  if (e.rainWeek !== null) fact.rainWeekMm = Math.round(e.rainWeek);
  if (e.rainRatio !== null) fact.rainRatio = r1(e.rainRatio);
  if (e.hottest !== null) fact.hottestC = Math.round(e.hottest);
  if (e.hotDays) fact.hotDays = e.hotDays;
  if (e.gust !== null) fact.gustKmh = Math.round(e.gust);
  if (e.quake) fact.quake = e.quake;
  if (field) fact.field = { level: field.level, title: field.title };
  if (x?.kind === "glacier") fact.iceMDay = x.maxSpeedMDay;
  if (x?.kind === "displacement") {
    const most = Math.max(...x.pairs.map((p) => Math.max(Math.abs(p.towardMaxCm), Math.abs(p.awayMaxCm))));
    if (Number.isFinite(most)) fact.motionCm = Math.round(most);
  }
  return fact;
}
