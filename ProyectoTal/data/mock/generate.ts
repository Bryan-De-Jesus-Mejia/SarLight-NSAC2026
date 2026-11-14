import { clamp, gaussian, mulberry32, pick } from "@/lib/prng";
import type { ChangeType, EventSummary, SignificanceLevel, TimeRange } from "../types";
import { CHANGE_TYPE_ORDER } from "../changeTypes";

/** Window covered by the simulated dataset. */
export const MOCK_TIME_RANGE: TimeRange = { start: "2025-10-01", end: "2026-10-31" };

const SEED = 20261109;
const SECONDARY_COUNT = 320;
const DAY_MS = 86_400_000;

interface Cluster {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Gaussian σ of the scatter, in degrees. */
  spread: number;
}

const c = (name: string, country: string, lat: number, lon: number, spread: number): Cluster => ({
  name,
  country,
  lat,
  lon,
  spread,
});

/**
 * Real places where each kind of change actually happens. Scattering signals
 * around them keeps the globe believable: glaciers at high latitudes,
 * earthquakes on plate boundaries, nothing in the open ocean.
 */
const CLUSTERS: Record<ChangeType, readonly Cluster[]> = {
  wetland: [
    c("Pantanal", "Brazil", -17.7, -57.4, 1.2),
    c("Okavango Delta", "Botswana", -19.3, 22.9, 0.6),
    c("Sundarbans", "Bangladesh", 22.2, 89.3, 0.4),
    c("Sudd", "South Sudan", 7.5, 30.5, 1.0),
    c("Mississippi Delta", "United States", 29.9, -90.6, 0.4),
    c("West Siberian Lowland", "Russia", 61, 72, 3),
    c("Congo Basin peatlands", "Democratic Republic of the Congo", -0.5, 18.5, 1.5),
    c("Hudson Bay Lowlands", "Canada", 52.5, -85, 1.8),
    c("Inner Niger Delta", "Mali", 14.8, -4.3, 0.7),
    c("Mesopotamian Marshes", "Iraq", 31, 47.2, 0.4),
    c("Llanos", "Venezuela", 7.5, -68.5, 1.2),
  ],
  glacier: [
    c("West Greenland margin", "Greenland", 71, -49, 2.2),
    c("Antarctic Peninsula", "Antarctica", -68, -65, 1.0),
    c("Amundsen Sea Embayment", "Antarctica", -76.5, -102, 2.0),
    c("Chugach Mountains", "United States", 61.2, -145.5, 1.0),
    c("Southern Patagonian Icefield", "Chile", -49.5, -73.3, 0.45),
    c("Karakoram", "Pakistan", 35.8, 76.3, 0.8),
    c("Khumbu Himalaya", "Nepal", 28, 86.6, 0.6),
    c("Bernese Alps", "Switzerland", 46.45, 8, 0.35),
    c("Svalbard", "Norway", 78.8, 17, 0.7),
    c("Vatnajökull", "Iceland", 64.4, -16.8, 0.3),
    c("Southern Alps", "New Zealand", -43.6, 170.3, 0.3),
  ],
  wildfire: [
    c("Northern California", "United States", 40.2, -122.3, 1.0),
    c("Australian Alps", "Australia", -36.6, 147.4, 1.0),
    c("Mato Grosso", "Brazil", -11.5, -55, 2.5),
    c("Yakutia", "Russia", 63, 125, 4),
    c("British Columbia interior", "Canada", 53, -123, 2),
    c("Central Portugal", "Portugal", 40.2, -7.9, 0.5),
    c("Central Greece", "Greece", 38.7, 22.4, 0.4),
    c("Miombo woodlands", "Zambia", -13, 26, 3),
    c("Top End savanna", "Australia", -15, 133, 2),
    c("Alberta boreal", "Canada", 57, -113, 2),
  ],
  earthquake: [
    c("Honshu", "Japan", 37.4, 139.8, 0.7),
    c("Central Chile", "Chile", -34.5, -71, 0.7),
    c("East Anatolian Fault", "Türkiye", 38, 38, 1.0),
    c("Nepal Himalaya", "Nepal", 28.2, 84.5, 0.6),
    c("Sumatra", "Indonesia", -0.4, 100.8, 0.6),
    c("San Andreas Fault", "United States", 35.8, -120.2, 0.6),
    c("Guerrero", "Mexico", 17.5, -99.8, 0.5),
    c("Canterbury", "New Zealand", -43, 172, 0.4),
    c("Zagros", "Iran", 30.5, 51.5, 1.2),
    c("Hindu Kush", "Afghanistan", 36.3, 70.5, 0.7),
    c("Central Apennines", "Italy", 42.7, 13.2, 0.3),
    c("Luzon", "Philippines", 16.6, 121, 0.4),
  ],
  agriculture: [
    c("Corn Belt", "United States", 41.8, -93.5, 2.5),
    c("Indo-Gangetic Plain", "India", 27.5, 80, 2),
    c("North China Plain", "China", 36, 116, 1.4),
    c("Pampas", "Argentina", -34, -62, 2),
    c("Dnipro lowlands", "Ukraine", 49, 32, 2),
    c("Cerrado", "Brazil", -13.5, -46, 2),
    c("Sahel croplands", "Niger", 13.6, 8, 2.2),
    c("Po Valley", "Italy", 45.1, 10.3, 0.5),
    c("Murray–Darling Basin", "Australia", -34.5, 145, 1.5),
    c("Ethiopian Highlands", "Ethiopia", 9.5, 39, 1),
    c("Central Java", "Indonesia", -7.4, 110.4, 0.3),
    c("Canadian Prairies", "Canada", 51, -106, 2.5),
  ],
  deformation: [
    c("Jakarta", "Indonesia", -6.25, 106.85, 0.12),
    c("Mexico City", "Mexico", 19.4, -99.1, 0.15),
    c("San Joaquin Valley", "United States", 36.2, -119.6, 0.4),
    c("Ganges–Brahmaputra Delta", "Bangladesh", 23.5, 90.3, 0.5),
    c("Nile Delta", "Egypt", 30.9, 31.1, 0.35),
    c("Houston", "United States", 29.85, -95.45, 0.2),
    c("Tehran Plain", "Iran", 35.5, 51.2, 0.25),
    c("Venetian Plain", "Italy", 45.45, 12, 0.2),
    c("Bangkok", "Thailand", 13.85, 100.6, 0.18),
    c("Lagos", "Nigeria", 6.6, 3.4, 0.12),
    c("Beijing–Tianjin Plain", "China", 39.4, 116.8, 0.45),
    c("Metro Manila", "Philippines", 14.7, 121.05, 0.1),
  ],
};

const PHRASES: Record<ChangeType, readonly string[]> = {
  wetland: ["inundation change", "open-water expansion", "marsh drying", "flood-extent shift"],
  glacier: ["terminus retreat", "flow speed-up", "surface lowering", "calving-front change"],
  wildfire: ["burn scar", "canopy loss", "post-fire regrowth"],
  earthquake: ["co-seismic displacement", "surface rupture", "post-seismic slip"],
  agriculture: ["cropping shift", "harvest-timing change", "field expansion", "fallow increase"],
  deformation: ["land subsidence", "ground uplift", "aquifer compaction"],
};

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** Wrap a longitude into [-180, 180]. */
const normalizeLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

const toIsoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * 320 secondary signals, fully deterministic (fixed seed, no Math.random()).
 */
export function generateSecondaryEvents(): EventSummary[] {
  const rand = mulberry32(SEED);
  const rangeStart = Date.parse(`${MOCK_TIME_RANGE.start}T00:00:00Z`);
  const rangeEnd = Date.parse(`${MOCK_TIME_RANGE.end}T00:00:00Z`);
  const rangeDays = Math.round((rangeEnd - rangeStart) / DAY_MS);

  const events: EventSummary[] = [];

  for (let i = 0; i < SECONDARY_COUNT; i += 1) {
    const type = pick(rand, CHANGE_TYPE_ORDER);
    const cluster = pick(rand, CLUSTERS[type]);

    const lat = clamp(cluster.lat + gaussian(rand) * cluster.spread, -85, 85);
    // Degrees of longitude shrink toward the poles: widen the scatter to keep
    // clusters round on the sphere (capped so polar clusters do not smear).
    const lonStretch = 1 / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
    const lon = normalizeLon(cluster.lon + gaussian(rand) * cluster.spread * lonStretch);

    // Skewed toward small signals.
    const magnitude = clamp(0.06 + Math.pow(rand(), 2.2) * 0.8, 0, 1);

    const startMs = rangeStart + Math.floor(rand() * rangeDays) * DAY_MS;
    const durationDays = 12 + Math.floor(rand() * 180); // 12–191 days
    const endMs = Math.min(startMs + durationDays * DAY_MS, rangeEnd);

    const score = magnitude + (rand() - 0.5) * 0.25;
    const significance: SignificanceLevel = score > 0.55 ? "high" : score > 0.28 ? "medium" : "low";

    const phrase = pick(rand, PHRASES[type]);

    events.push({
      id: `sig-${String(i + 1).padStart(4, "0")}`,
      type,
      name: `${cluster.name} ${phrase}`,
      region: cluster.name,
      country: cluster.country,
      lat: round(lat, 3),
      lon: round(lon, 3),
      startDate: toIsoDate(startMs),
      endDate: toIsoDate(endMs),
      magnitude: round(magnitude, 3),
      featured: false,
      significance,
      source: "mock",
    });
  }

  return events;
}
