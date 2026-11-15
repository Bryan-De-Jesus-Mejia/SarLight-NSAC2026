import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from "satellite.js";

/**
 * When does NISAR image a place? Server-side maths, from public data only:
 *
 *  - the satellite's orbital elements (Space-Track data, through SatNOGS DB or CelesTrak),
 *    walked forward with SGP4 to know where it will be;
 *  - the public NASA catalogue (CMR) of real NISAR scenes, to see which of those slots
 *    were actually imaged before.
 *
 * NISAR is a side-looking radar (to the left of its direction of travel). It sees a strip
 * about 240 km wide that starts roughly 430 km from the ground track, so a place is "in view"
 * when the track passes 430–680 km away on that side, and never when the satellite is overhead.
 * The distances come from the incidence angles (about 33°–47°) and the orbit height
 * (about 747 km); they were checked against real scenes (see docs/SPEC.md).
 */

export const NISAR_NORAD = 65053;
/** The orbit repeats every 12 days: the same slot comes back at the same time of day. */
export const REPEAT_DAYS = 12;
/** Cross-track ground distance, in km, between which a place falls inside the swath. */
export const SWATH_NEAR_KM = 420;
export const SWATH_FAR_KM = 690;

const DAY_MS = 86_400_000;
const STEP_S = 30;
const EARTH_KM = 6371;
const RAD = Math.PI / 180;

export interface OrbitElements {
  line1: string;
  line2: string;
  /** Where the elements came from. */
  source: string;
  /** When they were measured (their epoch), ISO. */
  epoch: string;
}

export type Direction = "ascending" | "descending";

export interface CatalogueScene {
  /** Start of the scene, ISO. */
  time: string;
  cycle: number;
  track: number;
  direction: Direction;
  frame: number;
}

export interface Pass {
  /** The moment of closest approach to the place, ISO. */
  time: string;
  direction: Direction;
  /** How far the ground track passes from the place, km. */
  crossTrackKm: number;
  /** Mean solar time at the place, in hours (0–24): about 6 is dawn, about 18 is dusk. */
  solarHour: number;
  /** A scene of the public catalogue exists for this slot 12, 24, 36 or 48 days earlier. */
  imagedBefore: boolean;
}

export interface PassesResponse {
  generatedAt: string;
  point: { lat: number; lon: number };
  orbit: { source: string; epoch: string; ageDays: number };
  scenes: CatalogueScene[];
  scenesAvailable: boolean;
  passes: Pass[];
}

/* ------------------------------ orbital data ------------------------------ */

/** Epoch of a two-line element set: "26319.24014874" = day 319.24 of 2026. */
export function epochOf(line1: string): Date {
  const field = line1.slice(18, 32).trim();
  const yy = Number(field.slice(0, 2));
  const day = Number(field.slice(2));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * DAY_MS);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.json()) as T;
}

let remembered: { at: number; elements: OrbitElements } | null = null;
const KEEP_MS = 2 * 3_600_000; // the elements change a few times a day; CelesTrak asks for no more than every 2 hours

/** The latest orbital elements of NISAR. */
export async function fetchOrbitElements(): Promise<OrbitElements> {
  if (remembered && Date.now() - remembered.at < KEEP_MS) return remembered.elements;

  const sources: Array<() => Promise<OrbitElements>> = [
    async () => {
      const rows = await getJson<Array<{ tle1: string; tle2: string }>>(
        `https://db.satnogs.org/api/tle/?norad_cat_id=${NISAR_NORAD}&format=json`,
      );
      const row = rows[0];
      if (!row) throw new Error("no elements");
      return { line1: row.tle1, line2: row.tle2, source: "Space-Track via SatNOGS DB", epoch: epochOf(row.tle1).toISOString() };
    },
    async () => {
      const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${NISAR_NORAD}&FORMAT=tle`, {
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error(`celestrak ${response.status}`);
      const lines = (await response.text()).trim().split(/\r?\n/).map((line) => line.trim());
      const [line1, line2] = lines.filter((line) => line.startsWith("1 ") || line.startsWith("2 "));
      if (!line1 || !line2) throw new Error("no elements");
      return { line1, line2, source: "CelesTrak", epoch: epochOf(line1).toISOString() };
    },
  ];

  let lastError: unknown;
  for (const source of sources) {
    try {
      const elements = await source();
      remembered = { at: Date.now(), elements };
      return elements;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The orbital elements are not available.");
}

/* ----------------------------- the real scenes ---------------------------- */

const CMR = "https://cmr.earthdata.nasa.gov/search/granules.json";

/** The most recent real NISAR scenes (L2 GCOV) that cover the place, from NASA's public catalogue. */
export async function fetchCatalogueScenes(lat: number, lon: number): Promise<CatalogueScene[]> {
  const params = new URLSearchParams({
    short_name: "NISAR_L2_GCOV_V1",
    point: `${lon},${lat}`,
    page_size: "60",
    sort_key: "-start_date",
  });
  const body = await getJson<{ feed: { entry: Array<{ time_start: string; title: string }> } }>(`${CMR}?${params}`);
  const scenes: CatalogueScene[] = [];
  for (const entry of body.feed.entry) {
    // NISAR_L2_PR_GCOV_<cycle>_<track>_<A|D>_<frame>_…
    const parts = entry.title.split("_");
    const cycle = Number(parts[4]);
    const track = Number(parts[5]);
    const frame = Number(parts[7]);
    if (![cycle, track, frame].every(Number.isFinite) || (parts[6] !== "A" && parts[6] !== "D")) continue;
    scenes.push({
      time: new Date(`${entry.time_start.slice(0, 19)}Z`).toISOString(),
      cycle,
      track,
      direction: parts[6] === "A" ? "ascending" : "descending",
      frame,
    });
  }
  return scenes;
}

/* ------------------------------- the orbit ------------------------------- */

function groundDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

interface Sample {
  time: number;
  lat: number;
  lon: number;
}

function sampleAt(satrec: SatRec, time: number): Sample | null {
  const date = new Date(time);
  const state = propagate(satrec, date);
  if (!state) return null;
  const geodetic = eciToGeodetic(state.position, gstime(date));
  return { time, lat: degreesLat(geodetic.latitude), lon: degreesLong(geodetic.longitude) };
}

/** Which side of the ground track the place lies on: positive = left of the direction of travel. */
function sideOf(before: Sample, after: Sample, point: { lat: number; lon: number }): number {
  const cos = Math.cos(before.lat * RAD);
  const wrap = (degrees: number): number => ((degrees + 540) % 360) - 180;
  const heading = { x: wrap(after.lon - before.lon) * cos, y: after.lat - before.lat };
  const toPoint = { x: wrap(point.lon - before.lon) * cos, y: point.lat - before.lat };
  return heading.x * toPoint.y - heading.y * toPoint.x;
}

/**
 * NISAR looks to the LEFT of its direction of travel. Checked on real scenes: the two that the
 * catalogue holds over the Dominican Republic (an ascending and a descending one) both lie to the
 * left of the ground track.
 */
export const LOOKS_LEFT = true;

/** Moments, between `from` and `from + days`, when the place lies inside the swath of the ground track. */
export function orbitPasses(
  elements: OrbitElements,
  point: { lat: number; lon: number },
  from: number,
  days: number,
): Array<Omit<Pass, "imagedBefore">> {
  const satrec = twoline2satrec(elements.line1, elements.line2);
  const steps = Math.round((days * DAY_MS) / (STEP_S * 1000));
  const samples: Array<Sample | null> = [];
  for (let i = 0; i <= steps; i += 1) samples.push(sampleAt(satrec, from + i * STEP_S * 1000));

  const found: Array<Omit<Pass, "imagedBefore">> = [];
  for (let i = 1; i < steps; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const c = samples[i + 1];
    if (!a || !b || !c) continue;
    const d0 = groundDistanceKm(a.lat, a.lon, point.lat, point.lon);
    const d1 = groundDistanceKm(b.lat, b.lon, point.lat, point.lon);
    const d2 = groundDistanceKm(c.lat, c.lon, point.lat, point.lon);
    // The closest moment of a pass, far enough from the satellite to lie inside its swath.
    if (!(d1 < d0 && d1 <= d2) || d1 < SWATH_NEAR_KM || d1 > SWATH_FAR_KM) continue;
    const left = sideOf(a, c, point) > 0;
    if (left !== LOOKS_LEFT) continue;
    const when = new Date(b.time);
    const solar = (((when.getUTCHours() + when.getUTCMinutes() / 60 + point.lon / 15) % 24) + 24) % 24;
    found.push({
      time: when.toISOString(),
      direction: c.lat > a.lat ? "ascending" : "descending",
      crossTrackKm: Math.round(d1),
      solarHour: Math.round(solar * 10) / 10,
    });
  }
  return found;
}

/** Marks each pass that matches a real scene of the catalogue 12, 24, 36 or 48 days earlier (±3 minutes). */
export function markImaged(passes: Array<Omit<Pass, "imagedBefore">>, scenes: CatalogueScene[]): Pass[] {
  const times = scenes.map((scene) => new Date(scene.time).getTime());
  return passes.map((pass) => {
    const at = new Date(pass.time).getTime();
    const imagedBefore = [1, 2, 3, 4].some((k) => times.some((time) => Math.abs(time - (at - k * REPEAT_DAYS * DAY_MS)) < 3 * 60_000));
    return { ...pass, imagedBefore };
  });
}
