/**
 * The analyses that are not radar change maps: farming, ice flow, and ground
 * movement from earthquakes and landslides. Produced by DataAnalytics and
 * exported by scripts/export-extra.mjs. Every number comes from the pipeline's
 * own summaries and CSV series.
 */

export type Direction = "ascending" | "descending";

export interface FramePoint {
  /** ISO date of the pass. */
  date: string;
  /** False-colour image of the pass (R = co-pol, G = cross-pol, B = co − cross). */
  src: string;
}

interface OrbitBase {
  key: string;
  /** "Track 7 · frame 73 · descending". */
  label: string;
  track: number | null;
  frame: number | null;
  direction: Direction | null;
  pixelM: number;
  crs: string;
  map: string;
  mapSize: [number, number];
  frames: FramePoint[];
}

/* -------------------------------- farming -------------------------------- */

interface FarmOrbitBase extends OrbitBase {
  dates: string[];
  coPol: string;
  crossPol: string;
  thresholdDb: number | null;
  vegMinDb: number | null;
  waterMaxDb: number | null;
  medianFilterPx: number | null;
  downsample: number | null;
}

export interface HarvestPoint {
  date: string;
  coDb: number | null;
  crossDb: number | null;
  validPct: number | null;
  dropKm2: number | null;
  riseKm2: number | null;
  cumulativeKm2: number | null;
  cumulativePct: number | null;
}

/** Land whose echo dropped between passes: harvested, burned or cleared. */
export interface HarvestOrbit extends FarmOrbitBase {
  mode: "harvest";
  vegetatedKm2: number;
  harvestedKm2: number;
  harvestedPct: number;
  peakIntervalEnd: string;
  peakIntervalDropKm2: number;
  /** Day of the year. */
  medianHarvestDoy: number;
  meanMaxDropDb: number;
  series: HarvestPoint[];
}

export interface FloodPoint {
  date: string;
  baseline: boolean;
  coDb: number | null;
  crossDb: number | null;
  validPct: number | null;
  newWaterKm2: number | null;
  floodedVegKm2: number | null;
  permanentWaterKm2: number | null;
  floodKm2: number | null;
}

/** New water and flooded vegetation against a baseline of earlier passes. */
export interface FloodOrbit extends FarmOrbitBase {
  mode: "flood";
  baselineDates: string[];
  peakDate: string;
  peakFloodKm2: number;
  peakNewWaterKm2: number;
  peakFloodedVegKm2: number;
  maxExtentKm2: number;
  maxExtentOpenWaterKm2: number;
  maxExtentFloodedVegKm2: number;
  permanentWaterKm2: number;
  series: FloodPoint[];
}

export type FarmOrbit = HarvestOrbit | FloodOrbit;

export interface FarmExtra {
  kind: "agriculture";
  /** What the place is believed to show: our reading of the site, not something the radar tells apart. */
  activity: "harvest" | "flood" | "burning" | "clearing";
  orbits: FarmOrbit[];
}

/* -------------------------------- glaciers -------------------------------- */

export interface IcePoint {
  /** Middle date of the pair. */
  date: string;
  ref: string;
  sec: string;
  days: number;
  p50: number;
  p95: number;
  max: number;
  fastKm2: number;
  fastMedian: number;
  reliablePct: number;
  coherence: number;
}

export interface IceGroup extends OrbitBase {
  incidenceDeg: number;
  fastThresholdMs: number;
  maxSpeedMDay: number;
  typicalSpeedMDay: number;
  fastAreaKm2: number;
  noiseMDay: number;
  series: IcePoint[];
}

export interface GlacierExtra {
  kind: "glacier";
  method: string;
  pairsAnalysed: number;
  maxSpeedMDay: number;
  maxSpeedPair: string;
  medianNoiseMDay: number;
  groups: IceGroup[];
}

/* ------------------------- ground movement (InSAR) ------------------------- */

export interface DisplacementPair {
  key: string;
  group: string;
  label: string;
  direction: Direction;
  track: number;
  frame: number;
  ref: string;
  sec: string;
  days: number;
  pol: string;
  coveragePct: number;
  /** Share of the picture where the phase could be trusted. */
  reliablePct: number;
  towardMaxCm: number;
  awayMaxCm: number;
  area5Km2: number;
  area10Km2: number;
  area20Km2: number;
  coherence: number;
  decorrelatedKm2: number;
  wavelengthCm: number;
  fringeCm: number;
  pixelM: number;
  ionosphereRemoved: boolean;
  offsetRangeP99Cm: number;
  images: {
    fringes: string;
    fringesSize: [number, number];
    displacement: string;
    displacementSize: [number, number];
  };
}

export interface DisplacementExtra {
  kind: "displacement";
  eventDate: string;
  pairs: DisplacementPair[];
}

export type ExtraAnalysis = FarmExtra | GlacierExtra | DisplacementExtra;
