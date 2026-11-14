/**
 * Shared data contracts.
 *
 * The event model is split in two:
 *  - EventSummary: the light shape used to paint the globe (one request, all signals).
 *  - EventDetail:  the full shape used by the case panel (Phase 2, fetched per event).
 */

export type ChangeType =
  | "wetland"
  | "glacier"
  | "wildfire"
  | "earthquake"
  | "agriculture"
  | "deformation";

export type SignificanceLevel = "low" | "medium" | "high";

export type DataSource = "mock" | "nisar";

export type SarTechnique = "backscatter" | "insar" | "coherence" | "polarimetry";

export type Polarization = "HH" | "HV" | "VV" | "VH";

export interface EventSummary {
  id: string;
  type: ChangeType;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  /** ISO date, YYYY-MM-DD. */
  startDate: string;
  /** ISO date, YYYY-MM-DD. */
  endDate: string;
  /** Normalised change magnitude, 0–1. */
  magnitude: number;
  featured: boolean;
  significance: SignificanceLevel;
  source: DataSource;
}

export interface MetricPoint {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  value: number;
  uncertainty?: number;
}

export type EventImagery =
  | { kind: "synthetic"; seed: number; style: "backscatter" | "interferogram" }
  | { kind: "url"; beforeUrl: string; afterUrl: string };

export interface EventDetail extends EventSummary {
  areaKm2: number;
  /** Two-sentence plain-language summary. */
  summary: string;
  sar: {
    technique: SarTechnique;
    band: "L" | "S";
    polarizations: Polarization[];
    explanation: string;
  };
  /** Hypothesised causes — never presented as established fact. */
  drivers: string[];
  impact: string;
  metric: {
    label: string;
    unit: string;
    series: MetricPoint[];
    /** Last date of the baseline period, ISO YYYY-MM-DD. */
    baselineEndDate: string;
  };
  change: {
    value: number;
    unit: string;
    direction: "increase" | "decrease";
  };
  significanceDetail: {
    level: SignificanceLevel;
    pValue: number;
    zScore: number;
    method: string;
  };
  imagery: EventImagery;
}

export interface EventFilters {
  types?: ChangeType[];
  featuredOnly?: boolean;
}

export interface TimeRange {
  /** ISO date, YYYY-MM-DD. */
  start: string;
  /** ISO date, YYYY-MM-DD. */
  end: string;
}

/**
 * The only seam between the app and its data. Swapping mock data for real
 * NISAR products means implementing this interface — nothing else changes.
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
