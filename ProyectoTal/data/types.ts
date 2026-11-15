/**
 * Shared data contracts.
 *
 * Every event is a real radar change analysis: two satellite passes over the
 * same area, compared pixel by pixel (see Data analytics/pipeline). Nothing in
 * these types is simulated.
 *
 * The event model is split in two:
 *  - EventSummary: the light shape used to paint the globe (one request, all events).
 *  - EventDetail:  the full shape used by the case panel (fetched per event).
 */

import type { ExtraAnalysis } from "./extraTypes";

/** What the analysis was looking for. */
export type ChangeType =
  | "wetland"
  | "flood"
  | "glacier"
  | "wildfire"
  | "earthquake"
  | "agriculture"
  | "deformation"
  | "landslide"
  | "storm"
  | "drought";

/** Where the numbers come from: radar scenes compared by our own pipeline. */
export type DataSource = "analysis";

/** Analyses that are not radar change maps carry their own shape (see extraTypes.ts). */
export type { ExtraAnalysis } from "./extraTypes";

export type SensorId = "nisar" | "opera";

export type Polarization = "HH" | "HV" | "VV" | "VH";

/** One satellite pass over the area. */
export interface SeriesPoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Share of the land the pass actually covered, 0–100. */
  validPct: number;
  /** Covers enough of the area to be compared with the others. */
  usable: boolean;
  /** Median backscatter (dB) of the land that was flagged as changed. */
  insideDb: number | null;
  /** Median backscatter (dB) of the rest of the land. */
  outsideDb: number | null;
  /** False-colour image of this pass (R = co-pol, G = cross-pol, B = co − cross). */
  frame: string | null;
}

/** The same pair of passes measured with one polarisation. */
export interface PolarisationRow {
  pol: Polarization;
  /** True for the polarisation the analysis was run with. */
  analysed: boolean;
  flaggedAreaKm2: number;
  decreaseAreaKm2: number;
  increaseAreaKm2: number;
  medianDiffDb: number | null;
}

/** How the flagged change compares with each pixel's own pass-to-pass variation. */
export interface BaselineStats {
  passes: number;
  /** Consecutive pass pairs used (the analysed pair is left out). */
  pairs: number;
  sigmaMedianDb: number | null;
  judgedAreaKm2: number;
  beyond3SigmaKm2: number;
  beyond3SigmaPct: number;
}

export interface LandCoverClass {
  code: number;
  label: string;
  flaggedKm2: number;
  /** Share of the flagged land in this class. */
  flaggedPct: number;
  /** Share of all the land analysed in this class. */
  scenePct: number;
  sceneKm2: number;
}

export interface LandCover {
  source: string;
  classes: LandCoverClass[];
}

/** Area changed, counted over land only (permanent water excluded) and over everything. */
export interface ChangeStats {
  validAreaKm2: number;
  changedAreaKm2: number;
  changedPct: number;
  decreaseAreaKm2: number;
  increaseAreaKm2: number;
}

/** One comparison of two passes by one sensor and polarisation. */
export interface SensorAnalysis {
  key: string;
  sensor: SensorId;
  pol: Polarization;
  label: string;
  /** Radar band: L (NISAR) or C (Sentinel-1). */
  band: "L" | "C";
  resolution_m: number;
  /** Satellite track and frame, e.g. "NISAR P083 F079 DESC". */
  group: string;
  collection: string;
  pre: { date: string };
  post: { date: string };
  method: {
    thresholdDb: number;
    direction: "decrease" | "increase" | "both";
    medianFilterPx: number;
    /** Pixels darker than this in the before image count as open water. */
    waterDb: number;
  };
  grid: {
    rows: number;
    cols: number;
    pixelSizeM: number;
    crs: string;
    overlapPct: number | null;
  };
  /** As produced by the pipeline, over the whole area. */
  stats: ChangeStats & {
    meanDiffDb: number | null;
    medianDiffDb: number | null;
    preMeanDb: number;
    postMeanDb: number;
  };
  /** The same measurement without the pixels that were already open water. */
  land: ChangeStats & {
    waterAreaKm2: number;
    changedOnWaterKm2: number;
  };
  images: { pre: string; post: string; diff: string; change: string; thumb: string; probe: string };
  /** How to decode the probe image: value = (channel − offset) / scale; channel 0 = no data. */
  probe: {
    size: [number, number];
    diff: { scale: number; offset: number };
    db: { scale: number; offset: number };
  };
  /** Null when the track has too few passes to build a baseline. */
  baseline: BaselineStats | null;
  polarisations: PolarisationRow[];
  /** Null when the land-cover map could not be read. */
  landCover: LandCover | null;
  imageSize: [number, number];
  footprint: {
    /** [lon, lat] corners. */
    polygon: Array<[number, number]>;
    /** [lon_min, lat_min, lon_max, lat_max]. */
    bbox: [number, number, number, number];
    /** [lon, lat]. */
    center: [number, number];
  };
  dbRange: [number, number];
  series: SeriesPoint[];
}

export interface EventSummary {
  id: string;
  type: ChangeType;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  /** First pass analysed, ISO YYYY-MM-DD. */
  startDate: string;
  /** Last pass analysed, ISO YYYY-MM-DD. */
  endDate: string;
  source: DataSource;
  sensors: SensorId[];
  /** Changed area over land, km², from the main (first) analysis. */
  changedAreaKm2: number;
  changedPct: number;
  /** [lon, lat] corners of the analysed area: top-left, top-right, bottom-right, bottom-left. */
  footprint: Array<[number, number]>;
  /** Small preview: the after image with the flagged pixels on top. */
  thumb: string;
  /** Set for farming, ice and ground-movement analyses; absent for radar change maps. */
  kind?: ExtraAnalysis["kind"];
}

/** Real-world records around the case, for the "Why it happened" chain. */
export interface CaseContext {
  lat: number;
  lon: number;
  weather?: {
    dates: string[];
    rainMm: Array<number | null>;
    tmaxC: Array<number | null>;
    gustKmh: Array<number | null>;
  };
  quakes?: Array<{ mag: number; place: string; time: string; depthKm: number; lat: number; lon: number; url: string }>;
}

export interface EventDetail extends EventSummary {
  /** Main analysis first (NISAR when there is one). Empty for the cases that carry `extra`. */
  analyses: SensorAnalysis[];
  extra?: ExtraAnalysis;
  /** Weather and earthquake records around the case (Open-Meteo, USGS). */
  context?: CaseContext;
  /** People living in the area and on the land that changed (GHSL population grid). */
  people?: CasePeople;
}

export interface EventFilters {
  types?: ChangeType[];
}

export interface TimeRange {
  /** ISO date, YYYY-MM-DD. */
  start: string;
  /** ISO date, YYYY-MM-DD. */
  end: string;
}

/**
 * The only seam between the app and its data. Live feeds (earthquakes, fires,
 * storms…) would be added by implementing this interface — nothing else changes.
 */
export interface DataProvider {
  readonly source: DataSource;
  getEvents(filters?: EventFilters): Promise<EventSummary[]>;
  getEventById(id: string): Promise<EventDetail | null>;
  getTimeRange(): Promise<TimeRange>;
}

export interface EventsMeta {
  source: DataSource;
  count: number;
  timeRange: TimeRange;
  /** When the analyses were last exported, ISO datetime. */
  generatedAt: string;
}

export interface EventsResponse {
  meta: EventsMeta;
  events: EventSummary[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

/** Population estimates from the GHSL grid (1 km cells) crossed with our change masks. */
export interface CasePeople {
  /** Everyone living inside the analysed area. */
  areaPeople: number;
  /** People living on the pixels the analysis flagged; absent where that does not apply. */
  exposedPeople?: number;
}
