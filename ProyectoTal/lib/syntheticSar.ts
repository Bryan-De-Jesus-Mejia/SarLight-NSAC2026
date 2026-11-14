import type { ChangeType } from "@/data/types";
import { mulberry32 } from "./prng";

/**
 * Procedural stand-ins for SAR imagery, drawn on canvas from a seed.
 * They illustrate what each product looks like (speckled backscatter,
 * wrapped-phase fringes); they are NOT measurements and are always shown
 * with a "Simulated imagery" label.
 */

export const SAR_IMAGE_WIDTH = 480;
export const SAR_IMAGE_HEIGHT = 300;

export interface SarSceneOptions {
  seed: number;
  style: "backscatter" | "interferogram";
  type: ChangeType;
  /** 0–1. Drives how large / intense the change looks. */
  magnitude: number;
  direction: "increase" | "decrease";
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const W = SAR_IMAGE_WIDTH;
const H = SAR_IMAGE_HEIGHT;
const TAU = Math.PI * 2;

/* ------------------------------- noise ----------------------------------- */

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]. */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Fractal noise in [0, 1]. */
function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(fx, fy, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2.03;
    fy *= 2.03;
  }
  return sum / norm;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const smoothstep = (edge0: number, edge1: number, v: number): number => {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/* ----------------------------- backscatter -------------------------------- */

interface BackscatterPlan {
  /** Feature radius (in normalised distance) before and after. */
  r0: number;
  r1: number;
  /** How the feature modifies the ground it covers. */
  kind: "water" | "darken" | "brighten";
  /** Blocky, field-shaped edges (agriculture) instead of organic ones. */
  blocky: boolean;
}

function planBackscatter(o: SarSceneOptions): BackscatterPlan {
  const shrink = 1 - (0.18 + 0.3 * o.magnitude);
  switch (o.type) {
    case "wetland":
      return o.direction === "increase"
        ? { r0: shrink, r1: 1, kind: "water", blocky: false }
        : { r0: 1, r1: shrink, kind: "water", blocky: false };
    case "glacier":
      // The feature is the dark water in front of bright ice: retreat grows it.
      return o.direction === "decrease"
        ? { r0: shrink, r1: 1, kind: "water", blocky: false }
        : { r0: 1, r1: shrink, kind: "water", blocky: false };
    case "wildfire":
      return o.direction === "decrease"
        ? { r0: 0, r1: 1, kind: "darken", blocky: false }
        : { r0: 1, r1: shrink * 0.8, kind: "darken", blocky: false };
    default:
      return o.direction === "decrease"
        ? { r0: 0.3, r1: 1, kind: "darken", blocky: true }
        : { r0: 0.3, r1: 1, kind: "brighten", blocky: true };
  }
}

function drawBackscatter(ctx: Ctx2D, o: SarSceneOptions, after: boolean): void {
  const image = ctx.createImageData(W, H);
  const data = image.data;
  const { seed } = o;
  const plan = planBackscatter(o);
  const radius = after ? plan.r1 : plan.r0;

  // Each acquisition has its own speckle realisation.
  const speckle = mulberry32(seed + (after ? 7919 : 104729));
  const layout = mulberry32(seed + 31);
  const cx = W * (0.4 + layout() * 0.2);
  const cy = H * (0.42 + layout() * 0.16);
  const reach = H * (0.26 + 0.14 * o.magnitude);
  const fieldAngle = layout() * Math.PI;
  const cosA = Math.cos(fieldAngle);
  const sinA = Math.sin(fieldAngle);
  const isIce = o.type === "glacier";
  const isFields = o.type === "agriculture";

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const terrain = fbm(x / 70, y / 70, seed);
      const texture = fbm(x / 16, y / 16, seed + 1, 2);

      let ground: number;
      let sx = x;
      let sy = y;

      if (isFields) {
        // Rotated patchwork of fields with thin dark boundaries.
        const u = x * cosA + y * sinA;
        const v = -x * sinA + y * cosA;
        const fu = Math.floor(u / 30);
        const fv = Math.floor(v / 22);
        const cell = hash2(fu, fv, seed + 5);
        const edge = Math.min(u / 30 - fu, v / 22 - fv);
        ground = (0.26 + 0.36 * cell + 0.08 * (texture - 0.5)) * (edge < 0.06 ? 0.6 : 1);
        // Snap the sampling point to the field centre: whole fields change at once.
        const mu = (fu + 0.5) * 30;
        const mv = (fv + 0.5) * 22;
        sx = mu * cosA - mv * sinA;
        sy = mu * sinA + mv * cosA;
      } else if (isIce) {
        // Bright ice with flow-aligned crevasse streaks.
        const streak = valueNoise(x / 60, y / 5, seed + 2);
        ground = 0.56 + 0.2 * terrain + 0.12 * (streak - 0.5);
      } else {
        ground = 0.14 + 0.62 * terrain + 0.16 * (texture - 0.5);
      }

      const wobble = plan.blocky ? 0.9 : 1.9;
      const dist =
        Math.hypot((sx - cx) / 1.3, sy - cy) / reach +
        (fbm(sx / 48, sy / 48, seed + 9, 3) - 0.5) * wobble;
      const inside = radius <= 0 ? 0 : 1 - smoothstep(radius - 0.035, radius + 0.035, dist);

      let value = ground;
      let speckleAmount = 1;
      if (inside > 0) {
        if (plan.kind === "water") {
          // Calm water: almost no return, and little speckle.
          value = ground * (1 - inside) + (0.045 + 0.025 * texture) * inside;
          speckleAmount = 1 - 0.55 * inside;
        } else if (plan.kind === "darken") {
          value = ground * (1 - 0.52 * inside);
        } else {
          value = ground * (1 + 0.5 * inside);
        }
      }

      // 4-look speckle: multiplicative, mean 1.
      const looks =
        -Math.log(
          Math.max(speckle(), 1e-6) *
            Math.max(speckle(), 1e-6) *
            Math.max(speckle(), 1e-6) *
            Math.max(speckle(), 1e-6),
        ) / 4;
      value *= 1 + (looks - 1) * 0.55 * speckleAmount;

      const tone = Math.pow(clamp01(value), 0.82) * 255;
      const i = (y * W + x) * 4;
      data[i] = tone * 0.93;
      data[i + 1] = tone * 0.97;
      data[i + 2] = tone;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/* ---------------------------- interferogram ------------------------------- */

/** Cyclic colour wheel: hue from wrapped phase. */
function phaseColor(phase: number, brightness: number): [number, number, number] {
  const h = (((phase / TAU) % 1) + 1) % 1;
  const k = (n: number): number => {
    const t = (n + h * 12) % 12;
    return 0.55 - 0.42 * Math.max(-1, Math.min(t - 3, 9 - t, 1));
  };
  return [k(0) * brightness * 255, k(8) * brightness * 255, k(4) * brightness * 255];
}

function drawInterferogram(ctx: Ctx2D, o: SarSceneOptions, after: boolean): void {
  const image = ctx.createImageData(W, H);
  const data = image.data;
  const { seed } = o;

  const noise = mulberry32(seed + (after ? 15485863 : 32452843));
  const layout = mulberry32(seed + 57);
  const cx = W * (0.38 + layout() * 0.24);
  const cy = H * (0.4 + layout() * 0.2);
  const angle = layout() * Math.PI;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const reach = H * (0.28 + 0.16 * o.magnitude);
  const fringes = (1.4 + o.magnitude * 6) * (o.direction === "increase" ? 1 : -1);
  const atmosphereSeed = seed + (after ? 14 : 4);
  const twoLobes = o.type === "earthquake";

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      // Coherence: low over water and dense vegetation → noisy phase.
      const coherence = smoothstep(0.34, 0.56, fbm(x / 62, y / 62, seed + 3));
      // Slow atmospheric phase screen, different in every pair.
      let phase = fbm(x / 170, y / 170, atmosphereSeed, 3) * TAU * 0.9;

      if (after) {
        const dx = x - cx;
        const dy = y - cy;
        const u = (dx * cosA + dy * sinA) / reach;
        const v = (-dx * sinA + dy * cosA) / reach;
        if (twoLobes) {
          // Two lobes of opposite sign either side of the fault trace (v = 0).
          const lobeA = Math.exp(-(u * u * 0.9 + (v - 0.42) * (v - 0.42) * 2.6));
          const lobeB = Math.exp(-(u * u * 0.9 + (v + 0.42) * (v + 0.42) * 2.6));
          phase += fringes * TAU * (lobeA - 0.75 * lobeB);
        } else {
          phase += fringes * TAU * Math.exp(-(u * u * 1.6 + v * v * 2.4));
        }
      }

      phase += (noise() - 0.5) * TAU * (0.1 + 0.9 * (1 - coherence));

      const [r, g, b] = phaseColor(phase, 0.5 + 0.5 * coherence);
      const i = (y * W + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/* --------------------------------- API ------------------------------------ */

/** Paint the "before" or "after" acquisition of a scene onto a canvas. */
export function renderSarImage(
  canvas: HTMLCanvasElement,
  options: SarSceneOptions,
  moment: "before" | "after",
): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (options.style === "interferogram") drawInterferogram(ctx, options, moment === "after");
  else drawBackscatter(ctx, options, moment === "after");
}

/** Paint a scene on any 2D context (a page canvas or an OffscreenCanvas in a worker). */
export function drawSarScene(ctx: Ctx2D, options: SarSceneOptions, moment: "before" | "after"): void {
  if (options.style === "interferogram") drawInterferogram(ctx, options, moment === "after");
  else drawBackscatter(ctx, options, moment === "after");
}
