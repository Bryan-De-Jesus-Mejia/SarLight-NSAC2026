/* SarLight service worker.
 *
 * It only READS what the page chose to keep: nothing big is stored on its own.
 *   sl-static   the app's own files (hashed, so safe to keep): filled as they load
 *   sl-pages    the last copy of the home page and Methods, for opening offline
 *   sl-data     the list of cases and the border files
 *   sl-cases    cases the visitor downloaded (data, images, study guides)  [kept across updates]
 *   sl-tiles    map tiles the visitor downloaded                           [kept across updates]
 */
const VERSION = "1";
const STATIC = `sl-static-${VERSION}`;
const PAGES = `sl-pages-${VERSION}`;
const DATA = `sl-data-${VERSION}`;
const CASES = "sl-cases";
const TILES = "sl-tiles";
const TILE_HOSTS = ["tiles.maps.eox.at", "gibs.earthdata.nasa.gov"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, PAGES, DATA, CASES, TILES]);
      for (const key of await caches.keys()) {
        if (key.startsWith("sl-") && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

const offlineJson = () =>
  new Response(
    JSON.stringify({ error: { code: "OFFLINE", message: "You are offline and this case is not downloaded." } }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type !== "opaque") cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (hit) {
    // Serve the copy now and refresh it in the background.
    refresh.catch(() => {});
    return hit;
  }
  return (await refresh) ?? new Response("", { status: 504 });
}

async function caseDetail(request) {
  try {
    return await fetch(request);
  } catch {
    const stored = await caches.open(CASES).then((cache) => cache.match(request));
    return stored ?? offlineJson();
  }
}

async function fromCasesThenNetwork(request) {
  const stored = await caches.open(CASES).then((cache) => cache.match(request));
  return stored ?? fetch(request);
}

async function navigate(request) {
  const url = new URL(request.url);
  const key = new Request(url.origin + url.pathname);
  try {
    const response = await fetch(request);
    if (response.ok && (url.pathname === "/" || url.pathname === "/methods")) {
      const cache = await caches.open(PAGES);
      cache.put(key, response.clone());
    }
    return response;
  } catch {
    const own = await caches.match(key);
    if (own) return own;
    const shell = await caches.match(new Request(url.origin + "/"));
    if (shell) return shell;
    return new Response("<!doctype html><meta charset=utf-8><title>SarLight</title><p style=\"font-family:sans-serif\">You are offline.</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function tile(request) {
  const stored = await caches.open(TILES).then((cache) => cache.match(request));
  return stored ?? fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (TILE_HOSTS.includes(url.hostname)) event.respondWith(tile(request));
    return;
  }

  const { pathname } = url;
  if (pathname.startsWith("/_next/static/")) return void event.respondWith(cacheFirst(request, STATIC));
  if (pathname === "/api/events") return void event.respondWith(staleWhileRevalidate(request, DATA));
  if (pathname.startsWith("/api/events/")) return void event.respondWith(caseDetail(request));
  if (pathname.startsWith("/analysis")) return void event.respondWith(fromCasesThenNetwork(request));
  if (pathname.startsWith("/geo/") || pathname.startsWith("/icons/")) {
    return void event.respondWith(staleWhileRevalidate(request, DATA));
  }
  if (request.mode === "navigate") return void event.respondWith(navigate(request));
});
