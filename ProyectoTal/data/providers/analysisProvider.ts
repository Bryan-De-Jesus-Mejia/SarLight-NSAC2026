import raw from "../analysis/cases.json";
import extraRaw from "../analysis/extra.json";
import type {
  ChangeType,
  DataProvider,
  EventDetail,
  EventFilters,
  EventSummary,
  ExtraAnalysis,
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

interface RawExtra {
  id: string;
  type: ChangeType;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  startDate: string;
  endDate: string;
  footprint: Array<[number, number]>;
  thumb: string;
  changedAreaKm2: number;
  changedPct: number;
  extra: ExtraAnalysis;
}

const file = raw as unknown as { generatedAt: string; cases: RawCase[] };
const extraFile = extraRaw as unknown as { generatedAt: string; cases: RawExtra[] };

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

function extraSummary(c: RawExtra): EventSummary {
  const { extra, ...summary } = c;
  return { ...summary, source: "analysis", sensors: ["nisar"], kind: extra.kind };
}

const CASES = [...file.cases].sort((a, b) => a.startDate.localeCompare(b.startDate));
const EXTRA = extraFile.cases;
const bySummary = (a: EventSummary, b: EventSummary) => a.startDate.localeCompare(b.startDate);

export class AnalysisProvider implements DataProvider {
  readonly source = "analysis" as const;

  async getEvents(filters?: EventFilters): Promise<EventSummary[]> {
    const types = filters?.types;
    const keep = (c: { type: ChangeType }) => !types || types.length === 0 || types.includes(c.type);
    return [...CASES.filter(keep).map(toSummary), ...EXTRA.filter(keep).map(extraSummary)].sort(bySummary);
  }

  async getEventById(id: string): Promise<EventDetail | null> {
    const found = CASES.find((c) => c.id === id);
    if (found) return { ...toSummary(found), analyses: found.sensors };
    const extra = EXTRA.find((c) => c.id === id);
    return extra ? { ...extraSummary(extra), analyses: [], extra: extra.extra } : null;
  }

  async getTimeRange(): Promise<TimeRange> {
    const all = [...CASES, ...EXTRA];
    return {
      start: all.reduce((min, c) => (c.startDate < min ? c.startDate : min), all[0].startDate),
      end: all.reduce((max, c) => (c.endDate > max ? c.endDate : max), all[0].endDate),
    };
  }

  /** When the analyses were exported (ISO datetime). */
  generatedAt(): string {
    return file.generatedAt > extraFile.generatedAt ? file.generatedAt : extraFile.generatedAt;
  }
}
