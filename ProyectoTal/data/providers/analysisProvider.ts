import raw from "../analysis/cases.json";
import type {
  ChangeType,
  DataProvider,
  EventDetail,
  EventFilters,
  EventSummary,
  SensorAnalysis,
  TimeRange,
} from "../types";

/**
 * Real data: the radar change analyses produced by Data analytics/pipeline
 * (NISAR and Sentinel-1 scenes compared pass against pass) and exported by
 * pipeline/export_web.py to data/analysis/cases.json.
 */

interface RawCase {
  id: string;
  type: ChangeType;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  sensors: SensorAnalysis[];
}

const file = raw as unknown as { generatedAt: string; cases: RawCase[] };

function toSummary(c: RawCase): EventSummary {
  const main = c.sensors[0];
  return {
    id: c.id,
    type: c.type,
    name: c.name,
    region: c.region,
    country: c.country,
    lat: c.lat,
    lon: c.lon,
    startDate: c.startDate,
    endDate: c.endDate,
    source: "analysis",
    sensors: [...new Set(c.sensors.map((s) => s.sensor))],
    changedAreaKm2: main.land.changedAreaKm2,
    changedPct: main.land.changedPct,
    footprint: main.footprint.polygon,
    thumb: main.images.thumb,
  };
}

const CASES = [...file.cases].sort((a, b) => a.startDate.localeCompare(b.startDate));

export class AnalysisProvider implements DataProvider {
  readonly source = "analysis" as const;

  async getEvents(filters?: EventFilters): Promise<EventSummary[]> {
    const types = filters?.types;
    const cases = types && types.length > 0 ? CASES.filter((c) => types.includes(c.type)) : CASES;
    return cases.map(toSummary);
  }

  async getEventById(id: string): Promise<EventDetail | null> {
    const found = CASES.find((c) => c.id === id);
    return found ? { ...toSummary(found), analyses: found.sensors } : null;
  }

  async getTimeRange(): Promise<TimeRange> {
    return {
      start: CASES.reduce((min, c) => (c.startDate < min ? c.startDate : min), CASES[0].startDate),
      end: CASES.reduce((max, c) => (c.endDate > max ? c.endDate : max), CASES[0].endDate),
    };
  }

  /** When the analyses were exported (ISO datetime). */
  generatedAt(): string {
    return file.generatedAt;
  }
}
