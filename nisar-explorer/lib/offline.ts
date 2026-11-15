import { DR_BOX, satelliteUrl } from "@/lib/imagery";

/**
 * Keeping cases on the device so they open without a connection.
 *
 * Nothing here runs on its own except the small "essentials" step. Cases, study guides
 * and the Dominican Republic map are stored only when the visitor asks. They live in the
 * browser's Cache Storage, which `public/sw.js` reads when the network is gone.
 * The cache names below must match the ones in `public/sw.js`.
 */

export const CASES_CACHE = "sl-cases";
export const TILES_CACHE = "sl-tiles";
/** Where the service worker keeps the app's own files; filled with what the page already loaded. */
export const STATIC_CACHE = "sl-static-1";
/** Where the service worker keeps the home page and Methods. */
export const PAGES_CACHE = "sl-pages-1";

const META_KEY = "sl-offline-v1";
const DR_COUNTRY = "Dominican Republic";
const TILE_BYTES = 9_000;

export interface ManifestCase {
  bytes: number;
  files: string[];
  country: string;
}
export interface Manifest {
  cases: Record<string, ManifestCase>;
}

/** Why a case is on the device: asked for directly, kept with the classroom, or part of a pack. */
export type Keeper = "user" | "aula" | "pack";

export interface Meta {
  cases: Record<string, { bytes: number; at: number; keeper: Keeper; guide: boolean }>;
  packs: Record<string, { bytes: number; at: number }>;
  essentials: boolean;
}

const EMPTY: Meta = { cases: {}, packs: {}, essentials: false };

export function readMeta(): Meta {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return { ...EMPTY, cases: {}, packs: {} };
    const parsed = JSON.parse(raw) as Partial<Meta>;
    return { cases: parsed.cases ?? {}, packs: parsed.packs ?? {}, essentials: parsed.essentials ?? false };
  } catch {
    return { ...EMPTY, cases: {}, packs: {} };
  }
}

export function writeMeta(meta: Meta): void {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Storage blocked: the files are still on the device, only the list is lost.
  }
}

export const supported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "caches" in window;

/* ----------------------------- the manifest ------------------------------ */

let manifestPromise: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetch("/offline-manifest.json")
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<Manifest>;
    })
    .catch((error: unknown) => {
      manifestPromise = null;
      throw error;
    });
  return manifestPromise;
}

/* ------------------------------- the worker ------------------------------ */

export async function registerWorker(): Promise<void> {
  if (!supported() || process.env.NODE_ENV !== "production") return;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    // No worker: the app works as always, just not offline.
  }
}

const STATIC_URL = /\/_next\/static\/[^"'\s\\)<>]+/g;

/** Keeps the app's own files that this page already loaded, so the next visit can open offline. */
export async function keepLoadedFiles(): Promise<void> {
  if (!supported()) return;
  const cache = await caches.open(STATIC_CACHE);
  const urls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(window.location.origin) && name.includes("/_next/static/"));
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // It will be fetched next time.
      }
    }),
  );
}

/** Keeps a page (and the app files it names) so it opens offline. */
async function keepPage(path: string, into: string): Promise<number> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  const html = await response.clone().text();
  const cache = await caches.open(into);
  await cache.put(new URL(path, window.location.origin).toString(), response);
  const staticCache = await caches.open(STATIC_CACHE);
  let bytes = html.length;
  for (const asset of new Set(html.match(STATIC_URL) ?? [])) {
    const url = new URL(asset, window.location.origin).toString();
    if (await staticCache.match(url)) continue;
    try {
      const file = await fetch(url);
      if (file.ok) {
        bytes += Number(file.headers.get("content-length") ?? 0);
        await staticCache.put(url, file);
      }
    } catch {
      // Loaded on first use instead.
    }
  }
  return bytes;
}

/* -------------------------------- progress ------------------------------- */

export type Progress = (done: number, total: number) => void;

async function runPool<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

/* -------------------------------- the cases ------------------------------ */

const abs = (path: string): string => new URL(path, window.location.origin).toString();

/** The case's data and every image of it. Throws if any part fails, after removing what was stored. */
export async function downloadCase(id: string, keeper: Keeper, progress?: Progress): Promise<void> {
  const manifest = await loadManifest();
  const entry = manifest.cases[id];
  if (!entry) throw new Error(`Unknown case ${id}`);
  const cache = await caches.open(CASES_CACHE);
  const paths = [`/api/events/${encodeURIComponent(id)}`, ...entry.files];
  let done = 0;
  try {
    await runPool(paths, 4, async (path) => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${path} ${response.status}`);
      await cache.put(abs(path), response);
      done += 1;
      progress?.(done, paths.length);
    });
  } catch (error) {
    await Promise.all(paths.map((path) => cache.delete(abs(path))));
    throw error;
  }
  const meta = readMeta();
  const before = meta.cases[id];
  meta.cases[id] = {
    bytes: entry.bytes,
    at: Date.now(),
    // A case asked for directly stays until it is removed; one kept for the classroom follows the classroom.
    keeper: before && before.keeper !== keeper && keeper === "aula" ? before.keeper : keeper,
    guide: before?.guide ?? false,
  };
  writeMeta(meta);
}

export async function removeCase(id: string): Promise<void> {
  const manifest = await loadManifest().catch(() => null);
  const cache = await caches.open(CASES_CACHE);
  const paths = [`/api/events/${encodeURIComponent(id)}`, ...(manifest?.cases[id]?.files ?? [])];
  await Promise.all(paths.map((path) => cache.delete(abs(path))));
  const meta = readMeta();
  delete meta.cases[id];
  writeMeta(meta);
}

/** The study guide of a case in both languages, ready to print offline. */
export async function downloadGuide(id: string): Promise<void> {
  await keepPage(`/aula/es/${id}`, CASES_CACHE);
  await keepPage(`/aula/en/${id}`, CASES_CACHE);
  const meta = readMeta();
  if (meta.cases[id]) {
    meta.cases[id].guide = true;
    writeMeta(meta);
  }
}

export async function removeGuide(id: string): Promise<void> {
  const cache = await caches.open(CASES_CACHE);
  await Promise.all([`/aula/es/${id}`, `/aula/en/${id}`].map((path) => cache.delete(abs(path))));
  const meta = readMeta();
  if (meta.cases[id]) {
    meta.cases[id].guide = false;
    writeMeta(meta);
  }
}

/** A case saved in the classroom: the case and its guide stay on the device. */
export async function keepForClassroom(id: string): Promise<void> {
  if (!supported()) return;
  await downloadCase(id, "aula");
  await downloadGuide(id);
}

/** The classroom let go of a case: its guide goes, and the case too unless it was asked for directly. */
export async function releaseFromClassroom(id: string): Promise<void> {
  if (!supported()) return;
  await removeGuide(id);
  if (readMeta().cases[id]?.keeper === "aula") await removeCase(id);
}

/* --------------------------------- the map ------------------------------- */

function tileRange(box: [number, number, number, number], zoom: number): Array<[number, number, number]> {
  const [west, south, east, north] = box;
  const n = 2 ** zoom;
  const x = (lon: number): number => Math.floor(((lon + 180) / 360) * n);
  const y = (lat: number): number => {
    const rad = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  };
  const out: Array<[number, number, number]> = [];
  for (let tx = x(west); tx <= x(east); tx += 1) {
    for (let ty = y(north); ty <= y(south); ty += 1) out.push([tx, ty, zoom]);
  }
  return out;
}

const DR_TILES = ((): Array<[number, number, number]> => {
  const [west, south, east, north] = DR_BOX.split(",").map(Number);
  const list: Array<[number, number, number]> = [];
  for (let zoom = 3; zoom <= 10; zoom += 1) list.push(...tileRange([west, south, east, north], zoom));
  return list;
})();

const WORLD_TILES = ((): Array<[number, number, number]> => {
  const list: Array<[number, number, number]> = [];
  for (let zoom = 0; zoom <= 2; zoom += 1) list.push(...tileRange([-180, -85, 179.99, 85], zoom));
  return list;
})();

async function keepTiles(tiles: Array<[number, number, number]>, progress?: (n: number) => void): Promise<void> {
  const cache = await caches.open(TILES_CACHE);
  let done = 0;
  await runPool(tiles, 6, async ([x, y, z]) => {
    const url = satelliteUrl(x, y, z);
    try {
      if (!(await cache.match(url))) {
        const response = await fetch(url, { mode: "cors" });
        if (response.ok) await cache.put(url, response);
      }
    } catch {
      // A missing tile only leaves a gap in the offline map.
    }
    done += 1;
    progress?.(done);
  });
}

/** A coarse picture of the whole planet (about 0.2 MB) and the two pages, so the app opens offline. */
export async function keepEssentials(): Promise<void> {
  if (!supported() || readMeta().essentials) return;
  await keepPage("/", PAGES_CACHE);
  await keepPage("/methods", PAGES_CACHE);
  await keepTiles(WORLD_TILES);
  const meta = readMeta();
  meta.essentials = true;
  writeMeta(meta);
}

/* --------------------------------- the pack ------------------------------ */

export function packCases(manifest: Manifest, country: string = DR_COUNTRY): string[] {
  return Object.entries(manifest.cases)
    .filter(([, entry]) => entry.country === country)
    .map(([id]) => id);
}

export function packBytes(manifest: Manifest): number {
  return packCases(manifest).reduce((sum, id) => sum + manifest.cases[id].bytes, 0) + DR_TILES.length * TILE_BYTES;
}

export async function downloadPack(progress?: Progress): Promise<void> {
  const manifest = await loadManifest();
  const ids = packCases(manifest);
  const total = ids.length + 1;
  let done = 0;
  for (const id of ids) {
    if (!readMeta().cases[id]) await downloadCase(id, "pack");
    done += 1;
    progress?.(done, total);
  }
  await keepTiles(DR_TILES);
  progress?.(total, total);
  const meta = readMeta();
  meta.packs.dr = { bytes: packBytes(manifest), at: Date.now() };
  writeMeta(meta);
}

export async function removePack(): Promise<void> {
  const manifest = await loadManifest().catch(() => null);
  const meta = readMeta();
  for (const id of manifest ? packCases(manifest) : []) {
    if (meta.cases[id]?.keeper === "pack") await removeCase(id);
  }
  const tiles = await caches.open(TILES_CACHE);
  await Promise.all(DR_TILES.map(([x, y, z]) => tiles.delete(satelliteUrl(x, y, z))));
  const next = readMeta();
  delete next.packs.dr;
  writeMeta(next);
}

/* ----------------------------- everything / space ------------------------ */

export async function clearAll(): Promise<void> {
  if (!supported()) return;
  await caches.delete(CASES_CACHE);
  await caches.delete(TILES_CACHE);
  writeMeta({ cases: {}, packs: {}, essentials: readMeta().essentials });
}

export async function storageInfo(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate?.quota) return null;
    return { usage: estimate.usage ?? 0, quota: estimate.quota };
  } catch {
    return null;
  }
}

/** Asks the browser not to clear what was downloaded when space runs low. */
export async function keepStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not available: the browser may clear it when space is short.
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
