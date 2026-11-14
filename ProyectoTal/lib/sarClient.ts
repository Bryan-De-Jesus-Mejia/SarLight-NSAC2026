import type { SarJob, SarResult } from "./sarWorker";
import { renderSarImage, type SarSceneOptions } from "./syntheticSar";

/**
 * Paints synthetic radar images off the main thread (a worker), caches them,
 * and falls back to painting in place where workers or OffscreenCanvas are
 * missing.
 */

type Moment = "before" | "after";

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, (bitmap: ImageBitmap | null) => void>();
const cache = new Map<string, Promise<ImageBitmap | null>>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return (worker = null);
  try {
    const created = new Worker(new URL("./sarWorker.ts", import.meta.url), { type: "module" });
    created.onmessage = (event: MessageEvent<SarResult>) => {
      waiting.get(event.data.id)?.(event.data.bitmap);
      waiting.delete(event.data.id);
    };
    created.onerror = () => {
      worker = null;
      for (const resolve of waiting.values()) resolve(null);
      waiting.clear();
      cache.clear();
    };
    return (worker = created);
  } catch {
    return (worker = null);
  }
}

function keyOf(options: SarSceneOptions, moment: Moment): string {
  const { seed, style, type, magnitude, direction } = options;
  return `${seed}|${style}|${type}|${magnitude}|${direction}|${moment}`;
}

function bitmapFor(options: SarSceneOptions, moment: Moment): Promise<ImageBitmap | null> {
  const key = keyOf(options, moment);
  const hit = cache.get(key);
  if (hit) return hit;
  const active = getWorker();
  if (!active) return Promise.resolve(null);
  const job = new Promise<ImageBitmap | null>((resolve) => {
    const id = (nextId += 1);
    waiting.set(id, resolve);
    const message: SarJob = { id, options, moment };
    active.postMessage(message);
  });
  cache.set(key, job);
  return job;
}

/** Paint one image on a canvas. Resolves when it is on screen. */
export async function paintSar(canvas: HTMLCanvasElement, options: SarSceneOptions, moment: Moment): Promise<void> {
  const bitmap = await bitmapFor(options, moment);
  if (!bitmap) {
    renderSarImage(canvas, options, moment); // no worker: paint here
    return;
  }
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
}
