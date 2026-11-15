/**
 * Real-world context for every case: the weather around the radar passes and,
 * for earthquakes, the quake itself. Used by the "Why it happened" chain, so
 * the physical drivers we suggest come with evidence, not only words.
 *
 *   node scripts/export-context.mjs
 *
 * Sources (both free, no key):
 *   - Open-Meteo historical weather API (ERA5 reanalysis), CC BY 4.0
 *     https://open-meteo.com  · daily rain, maximum temperature, maximum wind gust
 *   - USGS earthquake catalogue (FDSN event web service), public domain
 *     https://earthquake.usgs.gov/fdsnws/event/1/
 *
 * Writes data/analysis/context.json. Nothing is modelled or invented here: the
 * numbers are exactly what the two services return for the case centre and dates.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(APP, "data/analysis/context.json");
const DAY = 86_400_000;
const LEAD_DAYS = 21; // weather shown from three weeks before the first pass
const ARCHIVE_LAG_DAYS = 6; // the reanalysis trails real time by a few days

const log = (msg) => console.log(`[export-context] ${msg}`);
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i += 1) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "dancing-with-the-sars (education, NASA Space Apps)" } });
      if (r.ok) return await r.json();
      log(`  HTTP ${r.status} (try ${i}/${tries})`);
    } catch (e) {
      log(`  ${String(e).slice(0, 80)} (try ${i}/${tries})`);
    }
    await sleep(1500 * i);
  }
  return null;
}

const load = async (file) => JSON.parse(await readFile(path.join(APP, "data/analysis", file), "utf8")).cases;
const cases = [...(await load("cases.json")), ...(await load("extra.json"))];
const today = Date.now();
const out = {};

for (const [n, c] of cases.entries()) {
  const start = iso(Date.parse(c.startDate) - LEAD_DAYS * DAY);
  const end = iso(Math.min(Date.parse(c.endDate) + 3 * DAY, today - ARCHIVE_LAG_DAYS * DAY));
  log(`[${n + 1}/${cases.length}] ${c.id}: ${start} → ${end}`);
  const entry = { lat: c.lat, lon: c.lon };

  const w = await getJson(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${c.lat}&longitude=${c.lon}` +
      `&start_date=${start}&end_date=${end}&daily=precipitation_sum,temperature_2m_max,wind_gusts_10m_max&timezone=UTC`,
  );
  if (w?.daily?.time) {
    entry.weather = {
      dates: w.daily.time,
      rainMm: w.daily.precipitation_sum,
      tmaxC: w.daily.temperature_2m_max,
      gustKmh: w.daily.wind_gusts_10m_max,
    };
  } else {
    log("  no weather");
  }

  if (c.type === "earthquake" || c.type === "landslide") {
    const lons = (c.footprint ?? []).map((p) => p[0]);
    const lats = (c.footprint ?? []).map((p) => p[1]);
    if (lons.length) {
      const q = await getJson(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}` +
          `&minlatitude=${Math.min(...lats) - 1}&maxlatitude=${Math.max(...lats) + 1}` +
          `&minlongitude=${Math.min(...lons) - 1}&maxlongitude=${Math.max(...lons) + 1}` +
          `&minmagnitude=4.5&orderby=magnitude&limit=5`,
      );
      entry.quakes = (q?.features ?? []).map((f) => ({
        mag: f.properties.mag,
        place: f.properties.place,
        time: new Date(f.properties.time).toISOString(),
        depthKm: f.geometry.coordinates[2],
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        url: f.properties.url,
      }));
      log(`  ${entry.quakes.length} quakes M≥4.5`);
    }
  }
  out[c.id] = entry;
  await sleep(350);
}

await writeFile(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sources: {
        weather: "Open-Meteo historical weather API (ERA5 reanalysis), CC BY 4.0, open-meteo.com",
        quakes: "USGS earthquake catalogue (FDSN event service), public domain, earthquake.usgs.gov",
      },
      cases: out,
    },
    null,
    1,
  ),
);
log(`${Object.keys(out).length} cases written to data/analysis/context.json`);
