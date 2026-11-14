import { gaussian, hashString, mulberry32, type Rand } from "@/lib/prng";
import type {
  ChangeType,
  EventDetail,
  EventSummary,
  MetricPoint,
  Polarization,
  SarTechnique,
  SignificanceLevel,
} from "../types";

/**
 * Builds the full (simulated) detail of an event from its summary.
 *
 * Everything is deterministic: the PRNG is seeded from the event id. The
 * statistics are not decorative — the series is constructed so that the
 * reported change, z-score and p-value are exactly what you get by computing
 * them from the plotted points.
 */

const DAY_MS = 86_400_000;
/** NISAR revisits the same ground track every 12 days. */
const REPEAT_DAYS = 12;
const BASELINE_PASSES = 8;
const TAIL_PASSES = 3;

type Direction = "increase" | "decrease";

interface MetricSpec {
  label: string;
  unit: string;
  /** Value before the change. */
  baseline: number;
  /** Signed change once the event has fully developed. */
  delta: number;
}

interface TypeProfile {
  technique: SarTechnique;
  band: "L" | "S";
  polarizations: Polarization[];
  imageryStyle: "backscatter" | "interferogram";
  explanation: string;
  /** Abrupt (earthquake) instead of gradual change. */
  step: boolean;
  defaultDirection: Direction;
  /** Affected area at magnitude 0 and 1, km². */
  area: readonly [number, number];
  metric: (rand: Rand, magnitude: number, direction: Direction) => MetricSpec;
  summary: (e: EventSummary, direction: Direction) => string;
  drivers: readonly string[];
  impact: string;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const sign = (direction: Direction): number => (direction === "increase" ? 1 : -1);

const PROFILES: Record<ChangeType, TypeProfile> = {
  wetland: {
    technique: "polarimetry",
    band: "L",
    polarizations: ["HH", "HV"],
    imageryStyle: "backscatter",
    explanation:
      "Calm open water acts like a mirror and bounces the radar pulse away, so it looks dark. Flooded vegetation does the opposite: the pulse bounces off the water and then off stems back to the satellite (double bounce), so it looks bright in HH. Comparing HH and HV across passes separates open water, flooded vegetation and dry land — through cloud and at night.",
    step: false,
    defaultDirection: "increase",
    area: [8, 420],
    metric: (rand, magnitude, direction) => {
      const baseline = lerp(40, 520, rand());
      return {
        label: "Open-water extent",
        unit: "km²",
        baseline,
        delta: sign(direction) * baseline * lerp(0.015, 0.11, magnitude),
      };
    },
    summary: (e, direction) =>
      `Simulated L-band backscatter shows open water ${direction === "increase" ? "expanding" : "shrinking"} across the ${e.region} wetlands between passes. The change shows up as a shift between dark, mirror-like water and brighter flooded or dry vegetation.`,
    drivers: [
      "Unusual seasonal rainfall or drought over the catchment",
      "Upstream water management: dams, diversions or irrigation withdrawals",
      "Sea-level rise or storm surge pushing water inland",
      "Changes in river sediment supply or channel position",
    ],
    impact:
      "Shifts in wetland extent affect flood buffering, fisheries, carbon storage and the people who farm or live along the margins.",
  },
  glacier: {
    technique: "backscatter",
    band: "L",
    polarizations: ["HH"],
    imageryStyle: "backscatter",
    explanation:
      "Ice surfaces carry a fine, stable pattern of radar speckle and crevasses. By matching that pattern between two passes 12 days apart (pixel-offset tracking), the displacement of each patch of ice gives its flow speed, and the bright ice edge against dark water marks the terminus position.",
    step: false,
    defaultDirection: "decrease",
    area: [4, 260],
    metric: (rand, magnitude, direction) => ({
      label: "Terminus position",
      unit: "km",
      baseline: 0,
      delta: sign(direction) * lerp(0.08, 2.4, magnitude) * lerp(0.8, 1.2, rand()),
    }),
    summary: (e, direction) =>
      `Simulated offset tracking over ${e.region} shows the ice front ${direction === "decrease" ? "retreating" : "advancing"} relative to its pre-event position. Position is measured along the glacier's central flow line; negative values mean retreat.`,
    drivers: [
      "Warmer ocean water melting the ice front from below",
      "Loss of buttressing sea ice or ice mélange in front of the terminus",
      "Surface meltwater reaching the bed and speeding up flow",
      "A natural calving cycle rather than a sustained trend",
    ],
    impact:
      "Glacier retreat adds to sea-level rise, changes freshwater supply downstream and can destabilise valley walls and glacial lakes.",
  },
  wildfire: {
    technique: "backscatter",
    band: "L",
    polarizations: ["HH", "HV"],
    imageryStyle: "backscatter",
    explanation:
      "Leaves and branches scatter the radar pulse in all directions and rotate its polarisation, which is what the HV channel records. When fire removes the canopy that volume scattering collapses, so a burn scar appears as a sharp drop in HV backscatter — visible even while smoke still hides the ground from optical sensors.",
    step: false,
    defaultDirection: "decrease",
    area: [3, 310],
    metric: (rand, magnitude, direction) => ({
      label: "HV backscatter",
      unit: "dB",
      baseline: lerp(-15.5, -12.5, rand()),
      delta: sign(direction) * lerp(0.4, 4.2, magnitude),
    }),
    summary: (e, direction) =>
      direction === "decrease"
        ? `Simulated HV backscatter drops sharply over a patch of ${e.region}, the signature of canopy lost to fire. The scar stays visible in radar regardless of smoke or cloud.`
        : `Simulated HV backscatter climbs back over a former burn scar in ${e.region}, consistent with vegetation regrowing. Radar follows the recovery regardless of cloud.`,
    drivers: [
      "Prolonged drought and heat drying out fuels",
      "Strong wind events during ignition",
      "Fuel build-up from past fire suppression or land abandonment",
      "Human ignitions: land clearing, power lines or accidents",
    ],
    impact:
      "Burned slopes lose carbon and habitat, and are prone to erosion, debris flows and degraded water quality in the following rainy season.",
  },
  earthquake: {
    technique: "insar",
    band: "L",
    polarizations: ["HH"],
    imageryStyle: "interferogram",
    explanation:
      "InSAR compares the phase of the radar wave between a pass before and a pass after the earthquake. Where the ground moved toward or away from the satellite, the wave arrives slightly early or late; each full colour cycle (fringe) in the interferogram equals about 12 cm of line-of-sight motion at L-band. Tightly packed fringes mark where the ground moved most.",
    step: true,
    defaultDirection: "increase",
    area: [60, 2400],
    metric: (rand, magnitude, direction) => ({
      label: "Line-of-sight displacement",
      unit: "cm",
      baseline: 0,
      delta: sign(direction) * lerp(1.5, 48, magnitude) * lerp(0.85, 1.15, rand()),
    }),
    summary: (e) =>
      `A simulated interferogram over ${e.region} shows concentric fringes where the ground shifted during the event. Displacement is measured along the satellite's line of sight at the point of maximum motion.`,
    drivers: [
      "Sudden slip on a locked fault releasing accumulated tectonic strain",
      "Stress transferred from an earlier earthquake on a neighbouring fault",
      "Continued slow slip (afterslip) in the days following the mainshock",
    ],
    impact:
      "Displacement maps show which fault moved and by how much, guiding damage assessment, aftershock forecasts and where to send response teams.",
  },
  agriculture: {
    technique: "backscatter",
    band: "L",
    polarizations: ["HH", "HV"],
    imageryStyle: "backscatter",
    explanation:
      "As a crop grows, its stems and leaves scatter more of the radar pulse, so backscatter rises through the season and falls at harvest. Each crop traces its own curve; flooded rice and standing forest have especially distinctive signatures. Comparing this year's curve to the baseline reveals changes in what is planted, when, and where.",
    step: false,
    defaultDirection: "decrease",
    area: [20, 1800],
    metric: (rand, magnitude, direction) => {
      const baseline = lerp(180, 2400, rand());
      return {
        label: "Cultivated area in scene",
        unit: "km²",
        baseline,
        delta: sign(direction) * baseline * lerp(0.01, 0.09, magnitude),
      };
    },
    summary: (e, direction) =>
      `Simulated backscatter time series over ${e.region} show the cultivated area ${direction === "increase" ? "growing" : "shrinking"} compared with the baseline seasons. The signal comes from fields whose seasonal radar curve no longer matches their usual crop cycle.`,
    drivers: [
      "Shifts in rainfall or irrigation water availability",
      "Changes in crop prices, subsidies or planting policy",
      "Land conversion to or from pasture, forest or settlement",
      "Earlier or later planting in response to temperature",
    ],
    impact:
      "Changes in cropping affect food supply, farm income, water demand and, where land is cleared, carbon emissions and habitat.",
  },
  deformation: {
    technique: "insar",
    band: "L",
    polarizations: ["HH"],
    imageryStyle: "interferogram",
    explanation:
      "By comparing the phase of the radar wave across many passes over the same ground, InSAR measures how far the surface has moved toward or away from the satellite — to within millimetres. Stacking a year of 12-day pairs averages out atmospheric noise and reveals slow, steady sinking or uplift that no one on the ground would notice.",
    step: false,
    defaultDirection: "decrease",
    area: [6, 640],
    metric: (rand, magnitude, direction) => ({
      label: "Vertical displacement",
      unit: "mm",
      baseline: 0,
      delta: sign(direction) * lerp(3, 46, magnitude) * lerp(0.85, 1.15, rand()),
    }),
    summary: (e, direction) =>
      `A simulated InSAR time series over ${e.region} shows the ground ${direction === "decrease" ? "sinking" : "rising"} steadily relative to stable reference points nearby. Negative values mean subsidence.`,
    drivers: [
      "Groundwater pumping compacting the aquifer system",
      "Natural compaction of young delta or lake sediments",
      "Load from new buildings and infrastructure",
      "Oil, gas or geothermal extraction — or recharge, where the ground rises",
    ],
    impact:
      "Sinking ground raises flood risk, cracks buildings and pipes, and in coastal cities compounds sea-level rise.",
  },
};

/** Phrases (from the secondary-signal generator) that imply a direction. */
const PHRASE_DIRECTIONS: readonly (readonly [string, Direction])[] = [
  ["open-water expansion", "increase"],
  ["marsh drying", "decrease"],
  ["terminus retreat", "decrease"],
  ["surface lowering", "decrease"],
  ["burn scar", "decrease"],
  ["canopy loss", "decrease"],
  ["post-fire regrowth", "increase"],
  ["field expansion", "increase"],
  ["fallow increase", "decrease"],
  ["land subsidence", "decrease"],
  ["aquifer compaction", "decrease"],
  ["ground uplift", "increase"],
];

/* -------------------------------------------------------------------------- */
/* Hand-written content for the 8 featured cases                              */
/* -------------------------------------------------------------------------- */

interface FeaturedContent {
  areaKm2: number;
  summary: string;
  metric: MetricSpec;
  drivers: string[];
  impact: string;
}

const FEATURED: Record<string, FeaturedContent> = {
  "enriquillo-lake-advance": {
    areaKm2: 371,
    summary:
      "Simulated L-band backscatter shows the shoreline of Lake Enriquillo — the Caribbean's largest lake, lying below sea level — pushing outward over farmland on its eastern and southern margins. Dark, mirror-like open water replaces brighter vegetated ground across the year.",
    metric: { label: "Lake surface area", unit: "km²", baseline: 352.6, delta: 18.4 },
    drivers: [
      "Above-average rainfall and tropical storms feeding a closed basin with no outlet",
      "Higher inflow from the Yaque del Sur system through canals and groundwater",
      "Sediment from deforested slopes reducing the basin's storage",
    ],
    impact:
      "Past rises of this lake flooded cropland, pasture and homes and cut the road toward the Haitian border. Tracking the shoreline pass by pass shows which communities the water is approaching.",
  },
  "jakobshavn-terminus-retreat": {
    areaKm2: 148,
    summary:
      "Simulated offset tracking shows the calving front of Jakobshavn Isbræ, Greenland's fastest outlet glacier, stepping back up its fjord through the melt season. Position is measured along the central flow line; negative values mean retreat.",
    metric: { label: "Terminus position", unit: "km", baseline: 0, delta: -1.92 },
    drivers: [
      "Warm Atlantic-origin water entering Disko Bay and melting the front from below",
      "Loss of the winter ice mélange that braces the calving front",
      "Thinning that lifts the terminus off its bed and speeds up calving",
    ],
    impact:
      "This single glacier drains about 6.5% of the Greenland ice sheet, so its retreat and speed-up feed directly into global sea-level rise.",
  },
  "everglades-marsh-loss": {
    areaKm2: 96,
    summary:
      "Simulated HH and HV backscatter over Cape Sable shows bright, double-bounce marsh giving way to dark open water along the coast. The vegetated marsh extent falls step by step over the year.",
    metric: { label: "Vegetated marsh extent", unit: "km²", baseline: 214.3, delta: -9.6 },
    drivers: [
      "Sea-level rise pushing salt water into freshwater marsh",
      "Peat collapse once salt-stressed vegetation dies back",
      "Storm surge widening old canals and tidal creeks",
      "Reduced freshwater flow from upstream water management",
    ],
    impact:
      "Losing coastal marsh removes storm-surge protection and nursery habitat, and releases carbon that the peat had stored for centuries.",
  },
  "sierra-foothills-burn-scar": {
    areaKm2: 186,
    summary:
      "Simulated HV backscatter collapses across the forested foothills of El Dorado County within two passes, outlining a burn scar. Radar maps the perimeter while smoke still blocks optical satellites.",
    metric: { label: "HV backscatter", unit: "dB", baseline: -13.8, delta: -3.3 },
    drivers: [
      "Multi-year drought and summer heat drying out fuels",
      "Dense fuel loads after a century of fire suppression",
      "Dry downslope wind events during the fire's spread",
    ],
    impact:
      "Burned slopes above reservoirs and towns raise the risk of debris flows and sediment-laden runoff in the first winter storms.",
  },
  "atacama-coast-rupture": {
    areaKm2: 2100,
    summary:
      "A simulated co-seismic interferogram shows dense fringes along the Antofagasta coast, where the land lurched during a subduction-zone earthquake. The series records the jump in line-of-sight position between the passes that bracket the event.",
    metric: { label: "Line-of-sight displacement", unit: "cm", baseline: 0, delta: 41.5 },
    drivers: [
      "Slip on the locked interface where the Nazca plate dives beneath South America",
      "Release of strain built up since the last great earthquake in this segment",
      "Afterslip continuing to move the coast in the following days",
    ],
    impact:
      "A displacement map available within one satellite revisit shows how much of the fault broke — key for tsunami assessment, aftershock forecasts and inspecting ports, mines and roads.",
  },
  "mekong-delta-subsidence": {
    areaKm2: 540,
    summary:
      "A simulated InSAR time series over Cần Thơ shows the delta surface sinking steadily relative to stable ground. Negative values mean subsidence, accumulated since the first pass.",
    metric: { label: "Vertical displacement", unit: "mm", baseline: 0, delta: -31.4 },
    drivers: [
      "Groundwater pumping for households, farms and industry compacting the aquifers",
      "Natural compaction of young, water-rich delta sediments",
      "Weight of expanding urban areas and infrastructure",
      "Less river sediment arriving to rebuild the surface",
    ],
    impact:
      "Much of the delta lies barely above sea level. Sinking at this rate adds to sea-level rise, increasing flooding and salt intrusion in one of Asia's main rice-growing regions.",
  },
  "punjab-crop-rotation-shift": {
    areaKm2: 1320,
    summary:
      "Simulated backscatter time series over Ludhiana show fewer fields following the flooded-paddy signature in the monsoon season. The flooded-rice extent falls compared with the baseline seasons.",
    metric: { label: "Flooded-paddy extent", unit: "km²", baseline: 1482, delta: -131 },
    drivers: [
      "Falling groundwater tables making flooded rice costlier to irrigate",
      "Policies and incentives promoting less water-intensive crops",
      "Later transplanting dates shortening the flooded period",
    ],
    impact:
      "Shifts in the rice–wheat cycle change regional water demand, grain supply and the timing of residue burning that affects air quality across northern India.",
  },
  "rondonia-forest-conversion": {
    areaKm2: 410,
    summary:
      "Simulated L-band HV backscatter falls in geometric blocks along roads in Rondônia, the radar signature of forest replaced by pasture. Forest cover within the scene declines through the dry season.",
    metric: { label: "Forest cover in scene", unit: "km²", baseline: 2264, delta: -148 },
    drivers: [
      "Clearing for cattle pasture along new and existing roads",
      "Dry-season fires used to finish clearing felled forest",
      "Land speculation ahead of expected road or title changes",
    ],
    impact:
      "Forest conversion releases stored carbon, fragments habitat and reduces the moisture recycling that feeds rainfall further south.",
  },
};

/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/** Sample standard deviation (n − 1). */
const sampleStd = (values: readonly number[]): number => {
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
};

/** Complementary error function (Abramowitz & Stegun 7.1.26). */
const erfc = (x: number): number => {
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-x * x);
};

/** Two-sided p-value of a z-score under a standard normal. */
const twoSidedP = (z: number): number => erfc(Math.abs(z) / Math.SQRT2);

const levelFromZ = (z: number): SignificanceLevel => {
  const abs = Math.abs(z);
  return abs >= 3 ? "high" : abs >= 2 ? "medium" : "low";
};

/** Target |z| ranges, kept clear of the level thresholds (2 and 3). */
const Z_TARGET: Record<SignificanceLevel, readonly [number, number]> = {
  high: [4.6, 7.5],
  medium: [2.25, 2.8],
  low: [0.8, 1.7],
};

/** Zero-mean gaussian residuals; with ≥ 2 values they are scaled to an exact sample σ. */
function residuals(rand: Rand, count: number, sigma: number, exactStd: boolean): number[] {
  if (count <= 1) return new Array<number>(count).fill(0);
  const raw = Array.from({ length: count }, () => gaussian(rand));
  const m = mean(raw);
  const centred = raw.map((v) => v - m);
  const scale = exactStd ? sigma / sampleStd(centred) : sigma;
  return centred.map((v) => v * scale);
}

const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

const toIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const fromIso = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

export function buildEventDetail(event: EventSummary): EventDetail {
  const seed = hashString(event.id);
  const rand = mulberry32(seed);
  const profile = PROFILES[event.type];
  const featured = FEATURED[event.id];

  const phraseDirection = PHRASE_DIRECTIONS.find(([phrase]) => event.name.endsWith(phrase))?.[1];
  const direction: Direction = featured
    ? featured.metric.delta >= 0
      ? "increase"
      : "decrease"
    : (phraseDirection ?? profile.defaultDirection);

  const spec = featured ? featured.metric : profile.metric(rand, event.magnitude, direction);

  // Noise level chosen so the change lands at the event's significance level.
  const [zMin, zMax] = Z_TARGET[event.significance];
  const sigma = Math.abs(spec.delta) / lerp(zMin, zMax, rand());
  const decimals = sigma >= 5 ? 1 : sigma >= 0.5 ? 2 : 3;

  // Sampling: 8 baseline passes before the event, then one pass every 12 days.
  const startMs = fromIso(event.startDate);
  const endMs = fromIso(event.endDate);
  const lastMs = Math.max(endMs, startMs + (TAIL_PASSES + 1) * REPEAT_DAYS * DAY_MS);
  const postCount = Math.floor((lastMs - startMs) / (REPEAT_DAYS * DAY_MS)) + 1;
  const tailCount = Math.min(TAIL_PASSES, Math.max(1, postCount - 1));
  const plateauIndex = postCount - tailCount;

  const baseNoise = residuals(rand, BASELINE_PASSES, sigma, true);
  const tailNoise = residuals(rand, tailCount, sigma * 0.55, false);

  const series: MetricPoint[] = [];

  for (let i = 0; i < BASELINE_PASSES; i += 1) {
    series.push({
      date: toIso(startMs - (BASELINE_PASSES - i) * REPEAT_DAYS * DAY_MS),
      value: round(spec.baseline + baseNoise[i], decimals),
      uncertainty: round(sigma * lerp(0.7, 1.15, rand()), decimals),
    });
  }

  for (let j = 0; j < postCount; j += 1) {
    const inTail = j >= plateauIndex;
    const progress = inTail
      ? 1
      : profile.step
        ? j >= 1
          ? 1
          : 0.5
        : smoothstep(j / plateauIndex);
    const noise = inTail ? tailNoise[j - plateauIndex] : gaussian(rand) * sigma * 0.55;
    series.push({
      date: toIso(startMs + j * REPEAT_DAYS * DAY_MS),
      value: round(spec.baseline + spec.delta * progress + noise, decimals),
      uncertainty: round(sigma * lerp(0.7, 1.15, rand()), decimals),
    });
  }

  // Statistics computed from the series itself, exactly as described in `method`.
  const baselineValues = series.slice(0, BASELINE_PASSES).map((p) => p.value);
  const tailValues = series.slice(-tailCount).map((p) => p.value);
  const change = mean(tailValues) - mean(baselineValues);
  const zScore = change / sampleStd(baselineValues);

  const drivers = featured
    ? featured.drivers
    : [...profile.drivers].sort(() => rand() - 0.5).slice(0, 3);

  return {
    ...event,
    areaKm2: featured
      ? featured.areaKm2
      : Math.round(lerp(profile.area[0], profile.area[1], event.magnitude) * lerp(0.75, 1.25, rand())),
    summary: featured ? featured.summary : profile.summary(event, direction),
    sar: {
      technique: profile.technique,
      band: profile.band,
      polarizations: profile.polarizations,
      explanation: profile.explanation,
    },
    drivers,
    impact: featured ? featured.impact : profile.impact,
    metric: {
      label: spec.label,
      unit: spec.unit,
      series,
      baselineEndDate: series[BASELINE_PASSES - 1].date,
    },
    change: {
      value: round(Math.abs(change), decimals),
      unit: spec.unit,
      direction: change >= 0 ? "increase" : "decrease",
    },
    significanceDetail: {
      level: levelFromZ(zScore),
      pValue: twoSidedP(zScore),
      zScore: round(zScore, 2),
      method: `Two-sided z-test: mean of the last ${tailCount === 1 ? "pass" : `${tailCount} passes`} against the mean and spread of the ${BASELINE_PASSES} baseline passes.`,
    },
    imagery: { kind: "synthetic", seed, style: profile.imageryStyle },
  };
}
