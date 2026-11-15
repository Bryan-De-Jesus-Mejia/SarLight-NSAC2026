import { mulberry32 } from "./prng";

const WIDTH = 4096;
const HEIGHT = 2048;
const STAR_COUNT = 3200;
const SEED = 7_041_969;

/** White, bluish and warm tints (r, g, b). */
const TINTS: readonly (readonly [number, number, number])[] = [
  [255, 255, 255],
  [255, 255, 255],
  [202, 220, 255],
  [176, 202, 255],
  [255, 232, 204],
];

let cached: string | null = null;

/**
 * Paints a deterministic equirectangular star map on a canvas and returns it
 * as a data URL, so the sky needs no image download and works offline.
 */
export function createStarfieldDataUrl(): string {
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const rand = mulberry32(SEED);

  ctx.fillStyle = "#040406";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A faint veil of haze: a few very soft, very large glows.
  const hazes: readonly (readonly [number, number, number, string])[] = [
    [0.18, 0.42, 620, "70, 104, 190"],
    [0.36, 0.58, 520, "96, 84, 170"],
    [0.62, 0.46, 700, "52, 96, 160"],
    [0.82, 0.55, 560, "120, 96, 150"],
    [0.5, 0.3, 480, "60, 120, 170"],
  ];
  for (const [fx, fy, radius, rgb] of hazes) {
    const x = fx * WIDTH;
    const y = fy * HEIGHT;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${rgb}, 0.085)`);
    gradient.addColorStop(0.5, `rgba(${rgb}, 0.03)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const x = rand() * WIDTH;
    // Uniform on the sphere (not on the image), so the poles are not crowded.
    const lat = Math.asin(2 * rand() - 1);
    const y = (0.5 - lat / Math.PI) * HEIGHT;

    const brightness = Math.pow(rand(), 3.2); // most stars are faint
    const radius = 0.4 + brightness * 1.05;
    const alpha = 0.3 + brightness * 0.7;
    const [r, g, b] = TINTS[Math.floor(rand() * TINTS.length)];
    // The sky sphere stretches pixels near the poles: pre-compress them.
    const stretch = 1 / Math.max(Math.cos(lat), 0.25);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * stretch, radius, 0, 0, Math.PI * 2);
    ctx.fill();

    // The brightest few get a soft halo.
    if (brightness > 0.8) {
      const haloRadius = radius * 3.2;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
      halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.2)`);
      halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(x, y, haloRadius * stretch, haloRadius, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  cached = canvas.toDataURL("image/png");
  return cached;
}
