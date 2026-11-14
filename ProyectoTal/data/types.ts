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

/** What the analysis was looking for. */
export type ChangeType =
  | "wetland"
  | "flood"
  | "glacier"
  | "wildfire"
  | "earthquake"
  | "agriculture"
  | "deformation";

/** Where the numbers come from: radar scenes compared by our own pipeline. */
export type DataSource = "analysis";

export type SensorId = "nisar" | "opera";

export type Polarization = "HH" | "HV" | "VV" | "VH";

/** One pass-to-pass observation of the whole area: its median backscatter. */
export interface SeriesPoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  medianDb: number;
  meanDb: number;
  /** Share of the area the pass actually covered, 0–100. */
  validPct: number;
  /** Covers enough of the area to be compared with the others. */
  usable: boolean;
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
  images: { pre: string; post: string; diff: string; change: string };
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
  /** [lon, lat] corners of the analysed area. */
  footprint: Array<[number, number]>;
}

export interface EventDetail extends EventSummary {
  /** Main analysis first (NISAR when there is one). */
  analyses: SensorAnalysis[];
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
