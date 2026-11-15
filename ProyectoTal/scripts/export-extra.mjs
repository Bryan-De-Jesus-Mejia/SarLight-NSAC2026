/**
 * Exports the DataAnalytics results that are not radar change maps (agriculture, floods over
 * time, dated events, reservoirs and lakes, glaciers, earthquakes and landslides) as light
 * files for the app.
 *
 *   node scripts/export-extra.mjs
 *   node scripts/export-extra.mjs --only agricola_arroz_mekong
 *
 * Reads  ../DataAnalytics/data/analisis/<type>/<case>/...   (summaries, CSV series, figures)
 * Writes public/analysis-extra/<id>/*.webp                   (resized figures)
 *        data/analysis/extra.json                            (numbers and series)
 *
 * Every number comes straight from the pipeline's own files (resumen*.json, estadisticas.json,
 * serie_*.csv). The only things derived here are labels (track, direction), the case centre and
 * outline (from the search box in cloud/trabajos.txt or the summary's bbox), and which frames
 * are shown. Nothing is invented. Figures drawn by the pipeline keep their own text; only the
 * Spanish titles are cropped off.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(APP, "../DataAnalytics");
const ANALYSIS = path.join(ROOT, "data/analisis");
const PUBLIC = path.join(APP, "public/analysis-extra");
const OUT_JSON = path.join(APP, "data/analysis/extra.json");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

/* Editorial metadata: only names the place. */
const AGRICULTURE = {
  agricola_arroz_delta_nilo: { id: "nile-delta-rice", name: "Nile Delta rice harvest", region: "Nile Delta", country: "Egypt", activity: "harvest" },
  agricola_arroz_mekong: { id: "mekong-rice-flood", name: "Mekong Delta rice flooding", region: "Mekong Delta", country: "Vietnam", activity: "flood" },
  agricola_arroz_sacramento: { id: "sacramento-rice", name: "Sacramento Valley rice harvest", region: "Sacramento Valley, California", country: "United States", activity: "harvest" },
  agricola_cosecha_iowa: { id: "iowa-harvest", name: "Iowa crop harvest", region: "Central Iowa", country: "United States", activity: "harvest" },
  agricola_cosecha_saskatchewan: { id: "saskatchewan-harvest", name: "Saskatchewan crop harvest", region: "Saskatchewan", country: "Canada", activity: "harvest" },
  agricola_deforestacion_amazonia: { id: "amazon-clearing", name: "Amazon forest clearing", region: "Pará, Amazon", country: "Brazil", activity: "clearing" },
  agricola_girasol_ucrania: { id: "ukraine-sunflower", name: "Ukraine sunflower harvest", region: "Central Ukraine", country: "Ukraine", activity: "harvest" },
  agricola_inundacion_bangladesh: { id: "chattogram-rice-flood", name: "Chattogram rice-field flooding", region: "Chattogram coast", country: "Bangladesh", activity: "flood" },
  agricola_palma_riau: { id: "riau-palm-clearing", name: "Riau oil-palm clearing", region: "Riau, Sumatra", country: "Indonesia", activity: "clearing" },
  agricola_quema_punjab: { id: "punjab-burning", name: "Punjab crop-residue burning", region: "Punjab", country: "India", activity: "burning" },
};
const GLACIERS = {
  glaciar_jakobshavn: { id: "jakobshavn-glacier", name: "Jakobshavn Isbræ ice flow", region: "Ilulissat Icefjord", country: "Greenland" },
  glaciar_hubbard_alaska: { id: "hubbard-glacier", name: "Hubbard Glacier ice flow", region: "Yakutat Bay, Alaska", country: "United States" },
  glaciar_pine_island: { id: "pine-island-glacier", name: "Pine Island Glacier ice flow", region: "Amundsen Sea", country: "Antarctica" },
};
const DISPLACEMENT = {
  "terremotos/terremoto_indonesia": { id: "indonesia-quake", type: "earthquake", name: "Indonesia earthquake", region: "Flores Sea", country: "Indonesia" },
  "terremotos/terremoto_mexico": { id: "mexico-quake", type: "earthquake", name: "Mexico earthquake", region: "Chiapas coast", country: "Mexico" },
  "terremotos/terremoto_panama": { id: "panama-quake", type: "earthquake", name: "Panama earthquake", region: "Southwestern Panama", country: "Panama" },
  "terremotos/terremoto_venezuela": { id: "venezuela-quake", type: "earthquake", name: "Venezuela earthquake", region: "Central coast", country: "Venezuela" },
  "deslizamientos/colapso_langtang": { id: "langtang-collapse", type: "landslide", name: "Langtang Lirung collapse", region: "Langtang, Rasuwa", country: "Nepal" },
};

/* Floods analysed against a dry baseline of earlier passes. `setting` says where the water was. */
const FLOODS = {
  inundacion_ozama_sdn: { id: "ozama-flood", name: "Ozama riverside flooding", region: "Santo Domingo Norte", country: "Dominican Republic", setting: "river" },
  inundacion_urbana_capotillo: { id: "capotillo-flood", name: "Capotillo urban flooding", region: "Capotillo, Santo Domingo", country: "Dominican Republic", setting: "town" },
  inundacion_san_pedro_macoris: { id: "san-pedro-flood", name: "San Pedro de Macorís flooding", region: "San Pedro de Macorís", country: "Dominican Republic", setting: "coast" },
  inundacion_san_jose_ocoa: { id: "ocoa-flood", name: "San José de Ocoa flooding", region: "San José de Ocoa", country: "Dominican Republic", setting: "valley" },
  inundacion_puerto_plata: { id: "puerto-plata-flood", name: "Puerto Plata flooding", region: "Puerto Plata and Sosúa", country: "Dominican Republic", setting: "town" },
  inundacion_santiago_hoya_caimito: { id: "hoya-caimito-flood", name: "Hoya de Caimito urban flooding", region: "Hoya de Caimito, Santiago", country: "Dominican Republic", setting: "town" },
  inundacion_tamayo_bahoruco: { id: "tamayo-flood", name: "Tamayo urban flooding", region: "Tamayo, Bahoruco", country: "Dominican Republic", setting: "town" },
  inundacion_matanzas_peravia: { id: "matanzas-flood", name: "Matanzas flooding", region: "Matanzas, Baní, Peravia", country: "Dominican Republic", setting: "rural" },
  inundacion_cambita_san_cristobal: { id: "cambita-flood", name: "Cambita Garabitos flooding", region: "Cambita Garabitos, San Cristóbal", country: "Dominican Republic", setting: "rural" },
  inundacion_haiti_sud: { id: "les-cayes-flood", name: "Les Cayes plain flooding", region: "Les Cayes, Sud", country: "Haiti", setting: "rural" },
  inundacion_haiti_nippes_baraderes: { id: "baraderes-flood", name: "Baradères flooding", region: "Baradères, Nippes", country: "Haiti", setting: "rural" },
  inundacion_haiti_grand_anse_corail: { id: "corail-flood", name: "Corail flooding", region: "Corail, Grand'Anse", country: "Haiti", setting: "rural" },
  inundacion_honduras_valle_sula: { id: "sula-flood", name: "Sula Valley flooding", region: "Sula Valley, Cortés", country: "Honduras", setting: "river" },
  inundacion_honduras_santa_barbara: { id: "santa-barbara-flood", name: "Santa Bárbara flooding", region: "Santa Bárbara", country: "Honduras", setting: "town" },
  inundacion_panama_tocumen: { id: "tocumen-flood", name: "Tocumen urban flooding", region: "Tocumen, Panama City", country: "Panama", setting: "town" },
  inundacion_colombia_cartagena: { id: "cartagena-flood", name: "Cartagena urban flooding", region: "Cartagena, Bolívar", country: "Colombia", setting: "town" },
  inundacion_colombia_santa_marta: { id: "santa-marta-flood", name: "Santa Marta flooding", region: "Santa Marta, Magdalena", country: "Colombia", setting: "town" },
  inundacion_colombia_cordoba: { id: "cordoba-flood", name: "Lower Sinú flooding", region: "Lorica, Córdoba", country: "Colombia", setting: "river" },
  inundacion_ecuador_muisne: { id: "muisne-flood", name: "Muisne river flooding", region: "Muisne, Esmeraldas", country: "Ecuador", setting: "river" },
  inundacion_ecuador_balao: { id: "balao-flood", name: "Balao river flooding", region: "Balao, Guayas", country: "Ecuador", setting: "river" },
  inundacion_ecuador_babahoyo: { id: "babahoyo-flood", name: "Babahoyo river flooding", region: "Babahoyo, Los Ríos", country: "Ecuador", setting: "river" },
  inundacion_ecuador_guayaquil: { id: "guayaquil-flood", name: "Guayaquil urban flooding", region: "Guayaquil, Guayas", country: "Ecuador", setting: "town" },
  inundacion_ecuador_el_guabo: { id: "el-guabo-flood", name: "El Guabo flooding", region: "El Guabo, El Oro", country: "Ecuador", setting: "river" },
  inundacion_ecuador_machala: { id: "machala-flood", name: "Machala urban flooding", region: "Machala, El Oro", country: "Ecuador", setting: "town" },
  inundacion_ecuador_portoviejo: { id: "portoviejo-flood", name: "Portoviejo urban flooding", region: "Portoviejo, Manabí", country: "Ecuador", setting: "town" },
  inundacion_ecuador_quito: { id: "quito-flood", name: "Quito urban flooding", region: "Quito, Pichincha", country: "Ecuador", setting: "town" },
  inundacion_ecuador_galapagos_santa_cruz: { id: "galapagos-flood", name: "Santa Cruz Island flooding", region: "Santa Cruz, Galápagos", country: "Ecuador", setting: "town" },
  inundacion_argentina_chaco: { id: "chaco-flood", name: "Resistencia river flooding", region: "Resistencia and Barranqueras, Chaco", country: "Argentina", setting: "river" },
  inundacion_argentina_paso_patria: { id: "paso-patria-flood", name: "Paso de la Patria flooding", region: "Paso de la Patria, Corrientes", country: "Argentina", setting: "river" },
  inundacion_argentina_itati: { id: "itati-flood", name: "Itatí river flooding", region: "Itatí, Corrientes", country: "Argentina", setting: "river" },
  inundacion_paraguay_ayolas: { id: "ayolas-flood", name: "Ayolas river flooding", region: "Ayolas, Misiones", country: "Paraguay", setting: "river" },
  inundacion_mexico_guaymas: { id: "guaymas-flood", name: "Guaymas flooding", region: "Guaymas, Sonora", country: "Mexico", setting: "town" },
  inundacion_mexico_navojoa: { id: "navojoa-flood", name: "Navojoa flooding", region: "Navojoa, Sonora", country: "Mexico", setting: "town" },
  inundacion_mexico_cajeme: { id: "cajeme-flood", name: "Cajeme flooding", region: "Ciudad Obregón, Sonora", country: "Mexico", setting: "town" },
  inundacion_mexico_ensenada: { id: "ensenada-flood", name: "Ensenada flooding", region: "Ensenada, Baja California", country: "Mexico", setting: "town" },
  inundacion_mexico_la_paz: { id: "la-paz-flood", name: "La Paz flooding", region: "La Paz, Baja California Sur", country: "Mexico", setting: "town" },
  inundacion_mexico_los_cabos: { id: "los-cabos-flood", name: "Los Cabos flooding", region: "Los Cabos, Baja California Sur", country: "Mexico", setting: "town" },
  inundacion_eeuu_pagosa_springs: { id: "pagosa-flood", name: "Pagosa Springs river flooding", region: "Pagosa Springs, Colorado", country: "United States", setting: "river" },
  inundacion_india_jammu: { id: "jammu-flood", name: "Jammu flash flooding", region: "Jammu, Jammu and Kashmir", country: "India", setting: "town" },
  inundacion_nepal_gorkha: { id: "gorkha-flood", name: "Budhi Gandaki flash flood", region: "Chumnubri, Gorkha", country: "Nepal", setting: "valley" },
};
/* The ground before and after a dated event (date chosen by the team from public reports). */
const EVENTS = {
  "deslizamientos/deslizamiento_los_cacaos": { id: "los-cacaos-landslide", type: "landslide", cause: "landslide", name: "Los Cacaos landslide watch", region: "Los Cacaos, San Cristóbal", country: "Dominican Republic" },
  "deslizamientos/deslizamiento_miches_el_seibo": { id: "miches-landslide", type: "landslide", cause: "landslide", name: "Miches landslide watch", region: "Miches, El Seibo", country: "Dominican Republic" },
  "vientos/viento_cibao": { id: "cibao-wind", type: "storm", cause: "wind", name: "Cibao wind damage", region: "Cibao Valley", country: "Dominican Republic" },
  "vientos/viento_valverde": { id: "valverde-wind", type: "storm", cause: "wind", name: "Valverde wind damage", region: "Valverde", country: "Dominican Republic" },
  "calor_extremo/calor_linea_noroeste": { id: "noroeste-heat", type: "drought", cause: "heat", name: "Northwest Line heat and drought", region: "Línea Noroeste", country: "Dominican Republic" },
  "sequias/sequia_valle_san_juan": { id: "san-juan-drought", type: "drought", cause: "drought", name: "San Juan Valley drought", region: "San Juan Valley", country: "Dominican Republic" },
  "deslizamientos/deslizamiento_guatemala_san_miguel_petapa": { id: "petapa-landslide", type: "landslide", cause: "landslide", name: "San Miguel Petapa landslide watch", region: "Villa Hermosa, San Miguel Petapa", country: "Guatemala" },
  "deslizamientos/deslizamiento_honduras_santa_cruz_yojoa": { id: "yojoa-landslide", type: "landslide", cause: "landslide", name: "Santa Cruz de Yojoa landslide watch", region: "Santa Cruz de Yojoa, Cortés", country: "Honduras" },
  "vientos/viento_brasil_santa_maria": { id: "santa-maria-wind", type: "storm", cause: "wind", name: "Santa Maria windstorm", region: "Santa Maria, Rio Grande do Sul", country: "Brazil" },
};
/* Reservoirs and lakes: calm open water counted on every pass. */
const WATER = {
  embalse_sabana_yegua: { id: "sabana-yegua-reservoir", body: "reservoir", name: "Sabana Yegua reservoir", region: "Azua and San Juan", country: "Dominican Republic" },
  embalse_monte_grande: { id: "monte-grande-reservoir", body: "reservoir", name: "Monte Grande reservoir", region: "Yaque del Sur River, Azua", country: "Dominican Republic" },
  embalse_jiguey: { id: "jiguey-reservoir", body: "reservoir", name: "Jigüey reservoir", region: "Nizao River, San José de Ocoa", country: "Dominican Republic" },
  embalse_sabaneta: { id: "sabaneta-reservoir", body: "reservoir", name: "Sabaneta reservoir", region: "San Juan", country: "Dominican Republic" },
  lago_enriquillo: { id: "enriquillo-lake", body: "lake", name: "Lake Enriquillo", region: "Enriquillo basin, Independencia and Bahoruco", country: "Dominican Republic" },
  embalse_mexico_la_boquilla: { id: "la-boquilla-reservoir", body: "reservoir", name: "La Boquilla reservoir", region: "Chihuahua", country: "Mexico" },
  embalse_ecuador_mazar: { id: "mazar-reservoir", body: "reservoir", name: "Mazar reservoir", region: "Azuay", country: "Ecuador" },
  embalse_colombia_tomine: { id: "tomine-reservoir", body: "reservoir", name: "Tominé reservoir", region: "Cundinamarca", country: "Colombia" },
  embalse_el_salvador_cerron_grande: { id: "cerron-grande-reservoir", body: "reservoir", name: "Cerrón Grande reservoir", region: "Chalatenango and Cuscatlán", country: "El Salvador" },
  embalse_el_salvador_el_chaparral: { id: "el-chaparral-reservoir", body: "reservoir", name: "El Chaparral reservoir", region: "San Luis de la Reina, San Miguel", country: "El Salvador" },
  lago_el_salvador_guija: { id: "guija-lake", body: "lake", name: "Lake Güija", region: "Metapán, Santa Ana", country: "El Salvador" },
};

/* ------------------------------ helpers ---------------------------------- */

const log = (msg) => console.log(`[export-extra] ${msg}`);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const round = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const num = (v) => (v === "" || v === undefined ? null : Number(v));
const day = (iso) => String(iso).slice(0, 10);
const compactDay = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
const median = (list) => {
  const v = list.filter((x) => x !== null).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

async function readCsv(file) {
  const [head, ...rows] = (await readFile(file, "utf8")).trim().split(/\r?\n/);
  const keys = head.split(",");
  return rows.map((row) => Object.fromEntries(row.split(",").map((cell, i) => [keys[i], cell])));
}

/** "P007_F073_DESC" / "T131_F037_ASC" → readable parts. */
function parseGroup(name) {
  const m = name.match(/[PT](\d+)_F(\d+)_(ASC|DESC)/);
  return m
    ? { track: Number(m[1]), frame: Number(m[2]), direction: m[3] === "ASC" ? "ascending" : "descending" }
    : { track: null, frame: null, direction: null };
}
const groupLabel = (name) => {
  const g = parseGroup(name);
  return g.track === null ? name : `Track ${g.track} · frame ${g.frame} · ${g.direction}`;
};

/** Pick up to `count` items spread evenly over a list. */
function spread(list, count) {
  if (list.length <= count) return list;
  return Array.from({ length: count }, (_, i) => list[Math.round((i * (list.length - 1)) / (count - 1))]);
}

/**
 * Resize a figure to WebP. `crop` is in fractions of the source ({ left, top, width, height }),
 * which keeps it valid whatever the figure's pixel size. `trim` removes the white margin.
 */
async function figure(src, dest, { width, crop, trim = false, quality = 78 }) {
  await mkdir(path.dirname(dest), { recursive: true });
  let image = sharp(src);
  if (crop) {
    const { width: w, height: h } = await image.metadata();
    image = sharp(await image.extract({
      left: Math.round((crop.left ?? 0) * w),
      top: Math.round((crop.top ?? 0) * h),
      width: Math.round((crop.width ?? 1 - (crop.left ?? 0)) * w),
      height: Math.round((crop.height ?? 1 - (crop.top ?? 0)) * h),
    }).png().toBuffer());
  }
  if (trim) image = sharp(await image.trim({ background: "#ffffff", threshold: 12 }).png().toBuffer());
  const out = await image.resize({ width, withoutEnlargement: true }).webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
  await writeFile(dest, out.data);
  return { w: out.info.width, h: out.info.height };
}

const rel = (id, file) => `/analysis-extra/${id}/${file}`;
const polygonOf = ([w, s, e, n]) => [[w, n], [e, n], [e, s], [w, s]];
const centreOf = ([w, s, e, n]) => ({ lat: round((s + n) / 2, 3), lon: round((w + e) / 2, 3) });

/** Search boxes of the agriculture cases, from the cloud job list. */
async function agricultureBoxes() {
  const boxes = {};
  for (const line of (await readFile(path.join(ROOT, "cloud/trabajos.txt"), "utf8")).split(/\r?\n/)) {
    const m = line.match(/^(\w+):.*--bbox\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/);
    if (m) boxes[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  }
  return boxes;
}

const dirs = async (dir) =>
  (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();

/* ------------------------------ agriculture ------------------------------ */

async function exportAgriculture(name, meta, bbox, folder0 = "agricultura", type = "agriculture") {
  const base = path.join(ANALYSIS, folder0, name);
  const orbits = [];
  for (const dir of await dirs(base)) {
    const folder = path.join(base, dir);
    if (!existsSync(path.join(folder, "resumen.json"))) continue;
    const s = await readJson(path.join(folder, "resumen.json"));
    const rows = await readCsv(path.join(folder, "serie_temporal.csv"));
    const key = dir.replace(/^nisar_/, "");
    const mapFile = s.mode === "cosecha" ? "mapa_cosecha.png" : "mapa_inundacion.png";
    const map = await figure(path.join(folder, mapFile), path.join(PUBLIC, meta.id, `${key}_map.webp`), {
      width: 1000, crop: { top: 0.04 }, trim: true,
    });
    const frameFiles = spread((await readdir(path.join(folder, "frames"))).filter((f) => f.endsWith(".png")).sort(), 5);
    const frames = [];
    for (const f of frameFiles) {
      const date = f.replace(".png", "");
      await figure(path.join(folder, "frames", f), path.join(PUBLIC, meta.id, `${key}_${date}.webp`), { width: 640, quality: 62 });
      frames.push({ date, src: rel(meta.id, `${key}_${date}.webp`) });
    }
    const common = {
      key, label: groupLabel(key), ...parseGroup(key), pixelM: s.pixel_size_m, crs: s.crs,
      coPol: s.co_pol, crossPol: s.cross_pol,
      thresholdDb: s.params?.threshold ?? null, vegMinDb: s.params?.veg_min ?? null, waterMaxDb: s.params?.water_max ?? null,
      medianFilterPx: s.params?.median ?? null, downsample: s.params?.downsample ?? null,
      dates: s.dates.map(day), map: rel(meta.id, `${key}_map.webp`), mapSize: [map.w, map.h], frames,
    };
    if (s.mode === "cosecha") {
      orbits.push({
        ...common, mode: "harvest",
        vegetatedKm2: round(s.vegetated_area_km2), harvestedKm2: round(s.harvested_area_km2),
        harvestedPct: round(s.harvested_pct_of_vegetated), peakIntervalEnd: day(s.peak_interval_end),
        peakIntervalDropKm2: round(s.peak_interval_drop_km2), medianHarvestDoy: s.median_harvest_doy,
        meanMaxDropDb: round(s.mean_max_drop_db),
        series: rows.map((r) => ({
          date: day(r.date), coDb: num(r.co_median_db), crossDb: num(r.cross_median_db), validPct: num(r.valid_pct),
          dropKm2: num(r.drop_since_prev_km2), riseKm2: num(r.rise_since_prev_km2),
          cumulativeKm2: num(r.harvested_cum_km2), cumulativePct: num(r.harvested_cum_pct),
        })),
      });
    } else {
      orbits.push({
        ...common, mode: "flood",
        baselineDates: (s.baseline_dates ?? []).map(day), peakDate: day(s.peak_date),
        peakFloodKm2: round(s.peak_flood_km2), peakNewWaterKm2: round(s.peak_new_water_km2),
        peakFloodedVegKm2: round(s.peak_flooded_veg_km2), maxExtentKm2: round(s.max_extent_km2),
        maxExtentOpenWaterKm2: round(s.max_extent_open_water_km2), maxExtentFloodedVegKm2: round(s.max_extent_flooded_veg_km2),
        permanentWaterKm2: round(s.permanent_water_km2),
        series: rows.map((r) => ({
          date: day(r.date), baseline: r.is_baseline === "True", coDb: num(r.co_median_db), crossDb: num(r.cross_median_db),
          validPct: num(r.valid_pct), newWaterKm2: num(r.new_water_km2), floodedVegKm2: num(r.flooded_veg_km2),
          permanentWaterKm2: num(r.permanent_water_km2), floodKm2: num(r.flood_total_km2),
        })),
      });
    }
  }
  if (!orbits.length) return null;

  // Main orbit: the most passes, then the biggest signal.
  const signal = (o) => (o.mode === "harvest" ? o.harvestedKm2 : o.peakFloodKm2);
  orbits.sort((a, b) => b.dates.length - a.dates.length || signal(b) - signal(a));
  const main = orbits[0];
  const allDates = orbits.flatMap((o) => o.dates).sort();
  const thumbFrame = main.frames[main.frames.length - 1];
  await figure(path.join(base, `nisar_${main.key}`, "frames", `${thumbFrame.date}.png`), path.join(PUBLIC, meta.id, "thumb.webp"), { width: 360, quality: 70 });

  return {
    id: meta.id, type, name: meta.name, region: meta.region, country: meta.country,
    ...centreOf(bbox), startDate: allDates[0], endDate: allDates[allDates.length - 1],
    footprint: polygonOf(bbox), thumb: rel(meta.id, "thumb.webp"),
    changedAreaKm2: signal(main), changedPct: main.mode === "harvest" ? main.harvestedPct : 0,
    extra: { kind: "agriculture", activity: meta.activity, ...(meta.setting ? { setting: meta.setting } : {}), orbits },
  };
}

/* ------------------------------- glaciers -------------------------------- */

async function exportGlacier(name, meta) {
  const base = path.join(ANALYSIS, "glaciares", name);
  const s = await readJson(path.join(base, "resumen_glaciar.json"));
  const bbox = s.bbox;
  const groups = [];
  for (const group of s.groups) {
    const pairs = s.pairs.filter((p) => p.group === group).sort((a, b) => a.mid_date.localeCompare(b.mid_date));
    if (!pairs.length) continue;
    const folder = path.join(base, group);
    const map = await figure(path.join(folder, "mapa_velocidad.png"), path.join(PUBLIC, meta.id, `${group}_map.webp`), {
      width: 980, crop: { top: 0.04, width: 0.54, height: 0.92 }, trim: true,
    });
    const frameFiles = spread((await readdir(path.join(folder, "frames"))).filter((f) => f.endsWith(".png")).sort(), 5);
    const frames = [];
    for (const f of frameFiles) {
      const date = compactDay(f.replace(".png", ""));
      await figure(path.join(folder, "frames", f), path.join(PUBLIC, meta.id, `${group}_${date}.webp`), { width: 640, quality: 62 });
      frames.push({ date, src: rel(meta.id, `${group}_${date}.webp`) });
    }
    groups.push({
      key: group, label: groupLabel(group), ...parseGroup(group), pixelM: pairs[0].pixel_size_m, crs: pairs[0].crs,
      incidenceDeg: pairs[0].incidence_deg_assumed, fastThresholdMs: pairs[0].fast_threshold_m_day,
      map: rel(meta.id, `${group}_map.webp`), mapSize: [map.w, map.h], frames,
      maxSpeedMDay: round(Math.max(...pairs.map((p) => p.speed_max_m_day))),
      typicalSpeedMDay: round(median(pairs.map((p) => p.speed_p50_m_day))),
      fastAreaKm2: round(mean(pairs.map((p) => p.fast_area_km2)), 1),
      noiseMDay: round(median(pairs.map((p) => p.noise_stable_ground_m_day)), 3),
      series: pairs.map((p) => ({
        date: p.mid_date, ref: compactDay(p.ref), sec: compactDay(p.sec), days: p.days,
        p50: p.speed_p50_m_day, p95: p.speed_p95_m_day, max: p.speed_max_m_day,
        fastKm2: p.fast_area_km2, fastMedian: p.fast_median_m_day,
        reliablePct: p.reliable_pct, coherence: p.coherence_median,
      })),
    });
  }
  groups.sort((a, b) => b.series.length - a.series.length);
  const main = groups[0];
  await figure(path.join(base, main.key, "mapa_velocidad.png"), path.join(PUBLIC, meta.id, "thumb.webp"), {
    width: 360, crop: { top: 0.04, width: 0.54, height: 0.92 }, trim: true, quality: 70,
  });
  const dates = groups.flatMap((g) => g.series.flatMap((p) => [p.ref, p.sec])).sort();
  return {
    id: meta.id, type: "glacier", name: meta.name, region: meta.region, country: meta.country,
    ...centreOf(bbox), startDate: dates[0], endDate: dates[dates.length - 1], footprint: polygonOf(bbox),
    thumb: rel(meta.id, "thumb.webp"), changedAreaKm2: main.fastAreaKm2, changedPct: 0,
    extra: {
      kind: "glacier", method: s.method, pairsAnalysed: s.pairs_analyzed,
      maxSpeedMDay: s.max_speed_m_day, maxSpeedPair: s.max_speed_pair, medianNoiseMDay: s.median_noise_m_day, groups,
    },
  };
}

/* ------------------------- earthquakes and landslides --------------------- */

async function exportDisplacement(rel0, meta) {
  const base = path.join(ANALYSIS, rel0);
  const s = await readJson(path.join(base, "resumen_evento.json"));
  const pairs = [];
  for (const p of s.pairs) {
    const folder = path.join(base, `${p.group}_${p.ref}_${p.sec}`);
    const key = `${p.group}_${p.ref}_${p.sec}`;
    const fringes = await figure(path.join(folder, "franjas.png"), path.join(PUBLIC, meta.id, `${key}_fringes.webp`), {
      width: 900, crop: { top: 0.045 }, trim: true,
    });
    // First panel of the four-panel figure: line-of-sight displacement with its colour bar.
    const displacement = await figure(path.join(folder, "mapa_sismo.png"), path.join(PUBLIC, meta.id, `${key}_los.webp`), {
      width: 900, crop: { top: 0.045, width: 0.5, height: 0.47 }, trim: true,
    });
    pairs.push({
      key, group: p.group, label: groupLabel(p.group), direction: p.direction === "ASC" ? "ascending" : "descending",
      track: Number(p.track), frame: Number(p.frame), ref: compactDay(p.ref), sec: compactDay(p.sec), days: Number(p.days),
      pol: p.pol, coveragePct: p.cov, reliablePct: p.reliable_pct,
      towardMaxCm: p.los_toward_max_cm, awayMaxCm: p.los_away_max_cm,
      area5Km2: p.area_abs_los_gt_5cm_km2, area10Km2: p.area_abs_los_gt_10cm_km2, area20Km2: p.area_abs_los_gt_20cm_km2,
      coherence: p.coherence_median, decorrelatedKm2: p.decorrelated_area_km2,
      wavelengthCm: p.wavelength_cm, fringeCm: p.fringe_cm, pixelM: p.pixel_size_m,
      ionosphereRemoved: p.ionosphere_removed, offsetRangeP99Cm: p.offset_range_los_abs_p99_cm,
      images: {
        fringes: rel(meta.id, `${key}_fringes.webp`), fringesSize: [fringes.w, fringes.h],
        displacement: rel(meta.id, `${key}_los.webp`), displacementSize: [displacement.w, displacement.h],
      },
    });
  }
  // The pair with the most trustworthy picture comes first.
  pairs.sort((a, b) => b.reliablePct - a.reliablePct);
  const main = pairs[0];
  await figure(path.join(base, `${main.key}`, "franjas.png"), path.join(PUBLIC, meta.id, "thumb.webp"), {
    width: 360, crop: { top: 0.045 }, trim: true, quality: 70,
  });
  const dates = pairs.flatMap((p) => [p.ref, p.sec]).sort();
  return {
    id: meta.id, type: meta.type, name: meta.name, region: meta.region, country: meta.country,
    ...centreOf(s.bbox), startDate: dates[0], endDate: dates[dates.length - 1], footprint: polygonOf(s.bbox),
    thumb: rel(meta.id, "thumb.webp"), changedAreaKm2: main.area5Km2, changedPct: 0,
    extra: { kind: "displacement", eventDate: s.event_date, pairs },
  };
}

/* ------------------------- dated events (change mode) -------------------- */

async function exportEvent(rel0, meta, bbox) {
  const base = path.join(ANALYSIS, rel0);
  const orbits = [];
  for (const dir of await dirs(base)) {
    const folder = path.join(base, dir);
    if (!existsSync(path.join(folder, "resumen.json"))) continue;
    const s = await readJson(path.join(folder, "resumen.json"));
    const rows = await readCsv(path.join(folder, "serie_temporal.csv"));
    const key = dir.replace(/^nisar_/, "");
    const map = await figure(path.join(folder, "mapa_cambio.png"), path.join(PUBLIC, meta.id, `${key}_map.webp`), {
      width: 1000, crop: { top: 0.04 }, trim: true,
    });
    const frameFiles = spread((await readdir(path.join(folder, "frames"))).filter((f) => f.endsWith(".png")).sort(), 6);
    const frames = [];
    for (const f of frameFiles) {
      const date = f.replace(".png", "");
      await figure(path.join(folder, "frames", f), path.join(PUBLIC, meta.id, `${key}_${date}.webp`), { width: 640, quality: 62 });
      frames.push({ date, src: rel(meta.id, `${key}_${date}.webp`) });
    }
    orbits.push({
      key, label: groupLabel(key), ...parseGroup(key), pixelM: s.pixel_size_m, crs: s.crs,
      coPol: s.co_pol, crossPol: s.cross_pol, thresholdDb: s.params?.threshold ?? null,
      medianFilterPx: s.params?.median ?? null, dates: s.dates.map(day),
      map: rel(meta.id, `${key}_map.webp`), mapSize: [map.w, map.h], frames,
      baselineDates: (s.baseline_dates ?? []).map(day),
      firstPostDate: day(s.first_post_date), firstPostDropKm2: round(s.first_post_drop_km2), firstPostRiseKm2: round(s.first_post_rise_km2),
      peakDropDate: day(s.peak_drop_date), peakDropKm2: round(s.peak_drop_km2),
      lastDate: day(s.last_date), lastDropKm2: round(s.last_drop_km2), lastRiseKm2: round(s.last_rise_km2),
      series: rows.map((r) => ({
        date: day(r.date), baseline: r.is_baseline === "True", coDb: num(r.co_median_db), crossDb: num(r.cross_median_db),
        coChangeDb: num(r.co_change_median_db), crossChangeDb: num(r.cross_change_median_db), validPct: num(r.valid_pct),
        dropKm2: num(r.drop_km2), riseKm2: num(r.rise_km2),
      })),
    });
  }
  if (!orbits.length) return null;
  orbits.sort((a, b) => b.dates.length - a.dates.length || b.peakDropKm2 - a.peakDropKm2);
  const main = orbits[0];
  const allDates = orbits.flatMap((o) => o.dates).sort();
  const thumbFrame = main.frames[main.frames.length - 1];
  await figure(path.join(base, `nisar_${main.key}`, "frames", `${thumbFrame.date}.png`), path.join(PUBLIC, meta.id, "thumb.webp"), { width: 360, quality: 70 });
  const eventDate = (await readJson(path.join(base, `nisar_${main.key}`, "resumen.json"))).event_date;
  return {
    id: meta.id, type: meta.type, name: meta.name, region: meta.region, country: meta.country,
    ...centreOf(bbox), startDate: allDates[0], endDate: allDates[allDates.length - 1],
    footprint: polygonOf(bbox), thumb: rel(meta.id, "thumb.webp"), changedAreaKm2: main.peakDropKm2, changedPct: 0,
    extra: { kind: "change", cause: meta.cause, eventDate, orbits },
  };
}

/* ------------------------- reservoirs and lakes (water mode) -------------- */

async function exportWater(name, meta, bbox) {
  const base = path.join(ANALYSIS, "embalses_y_lagos", name);
  const orbits = [];
  for (const dir of await dirs(base)) {
    const folder = path.join(base, dir);
    if (!existsSync(path.join(folder, "resumen.json"))) continue;
    const s = await readJson(path.join(folder, "resumen.json"));
    const rows = await readCsv(path.join(folder, "serie_temporal.csv"));
    const key = dir.replace(/^nisar_/, "");
    const map = await figure(path.join(folder, "mapa_agua.png"), path.join(PUBLIC, meta.id, `${key}_map.webp`), {
      width: 1000, crop: { top: 0.04 }, trim: true,
    });
    const frameFiles = spread((await readdir(path.join(folder, "frames"))).filter((f) => f.endsWith(".png")).sort(), 6);
    const frames = [];
    for (const f of frameFiles) {
      const date = f.replace(".png", "");
      await figure(path.join(folder, "frames", f), path.join(PUBLIC, meta.id, `${key}_${date}.webp`), { width: 640, quality: 62 });
      frames.push({ date, src: rel(meta.id, `${key}_${date}.webp`) });
    }
    orbits.push({
      key, label: groupLabel(key), ...parseGroup(key), pixelM: s.pixel_size_m, crs: s.crs,
      coPol: s.co_pol, crossPol: s.cross_pol, waterMaxDb: s.params?.water_max ?? null,
      medianFilterPx: s.params?.median ?? null, dates: s.dates.map(day),
      map: rel(meta.id, `${key}_map.webp`), mapSize: [map.w, map.h], frames,
      firstDate: day(s.first_date), firstWaterKm2: round(s.first_water_km2), lastDate: day(s.last_date), lastWaterKm2: round(s.last_water_km2),
      changeKm2: round(s.change_km2), changePct: s.change_pct ?? null,
      minDate: day(s.min_date), minWaterKm2: round(s.min_water_km2), maxDate: day(s.max_date), maxWaterKm2: round(s.max_water_km2),
      rangePctOfMax: s.range_pct_of_max ?? null,
      series: rows.map((r) => ({
        date: day(r.date), coDb: num(r.co_median_db), crossDb: num(r.cross_median_db), validPct: num(r.valid_pct), waterKm2: num(r.water_km2),
      })),
    });
  }
  if (!orbits.length) return null;
  // Main orbit: the most passes, then the most water seen (the fullest view of the water body).
  orbits.sort((a, b) => b.dates.length - a.dates.length || b.maxWaterKm2 - a.maxWaterKm2);
  const main = orbits[0];
  const allDates = orbits.flatMap((o) => o.dates).sort();
  const thumbFrame = main.frames[main.frames.length - 1];
  await figure(path.join(base, `nisar_${main.key}`, "frames", `${thumbFrame.date}.png`), path.join(PUBLIC, meta.id, "thumb.webp"), { width: 360, quality: 70 });
  return {
    id: meta.id, type: "wetland", name: meta.name, region: meta.region, country: meta.country,
    ...centreOf(bbox), startDate: allDates[0], endDate: allDates[allDates.length - 1],
    footprint: polygonOf(bbox), thumb: rel(meta.id, "thumb.webp"), changedAreaKm2: main.maxWaterKm2, changedPct: 0,
    extra: { kind: "water", body: meta.body, orbits },
  };
}

/* -------------------------------- main ----------------------------------- */

const cases = [];
const boxes = await agricultureBoxes();
const want = (name) => !only || only === name;
/** The scheduled job list can name analyses that have not run yet: skip them quietly. */
const done = (folder, name) => existsSync(path.join(ANALYSIS, folder, name));

for (const [name, meta] of Object.entries(AGRICULTURE)) {
  if (!want(name) || !boxes[name]) continue;
  log(`agriculture · ${name}`);
  await rm(path.join(PUBLIC, meta.id), { recursive: true, force: true });
  const c = await exportAgriculture(name, meta, boxes[name]);
  if (c) cases.push(c);
}
for (const [name, meta] of Object.entries(FLOODS)) {
  if (!want(name) || !boxes[name] || !done("inundaciones", name)) continue;
  log(`flood · ${name}`);
  await rm(path.join(PUBLIC, meta.id), { recursive: true, force: true });
  const c = await exportAgriculture(name, { ...meta, activity: "flood" }, boxes[name], "inundaciones", "flood");
  if (c) cases.push(c);
}
for (const [rel0, meta] of Object.entries(EVENTS)) {
  const name = path.basename(rel0);
  if (!want(name) || !boxes[name] || !done(path.dirname(rel0), name)) continue;
  log(`event · ${rel0}`);
  await rm(path.join(PUBLIC, meta.id), { recursive: true, force: true });
  const c = await exportEvent(rel0, meta, boxes[name]);
  if (c) cases.push(c);
}
for (const [name, meta] of Object.entries(WATER)) {
  if (!want(name) || !boxes[name] || !done("embalses_y_lagos", name)) continue;
  log(`water · ${name}`);
  await rm(path.join(PUBLIC, meta.id), { recursive: true, force: true });
  const c = await exportWater(name, meta, boxes[name]);
  if (c) cases.push(c);
}
for (const [name, meta] of Object.entries(GLACIERS)) {
  if (!want(name)) continue;
  log(`glacier · ${name}`);
  await rm(path.join(PUBLIC, meta.id), { recursive: true, force: true });
  cases.push(await exportGlacier(name, meta));
}
for (const [rel0, meta] of Object.entries(DISPLACEMENT)) {
  if (!want(path.basename(rel0))) continue;
  log(`displacement · ${rel0}`);
  await rm(path.join(PUBLIC, meta.id), { recursive: true, force: true });
  cases.push(await exportDisplacement(rel0, meta));
}

if (only) {
  // Keep the cases that were not re-exported.
  const old = existsSync(OUT_JSON) ? (await readJson(OUT_JSON)).cases : [];
  const ids = new Set(cases.map((c) => c.id));
  cases.push(...old.filter((c) => !ids.has(c.id)));
}
cases.sort((a, b) => a.startDate.localeCompare(b.startDate));

// Analyses with no entry above never reach the app: name them, so a new case is not lost silently.
// Fires and the two oldest floods are change maps, exported by pipeline/export_web.py.
const CHANGE_MAPS = ["incendio_pelempito", "incendio_sierra_bahoruco", "inundacion_azua", "inundacion_monte_plata"];
const known = new Set([
  ...Object.keys(AGRICULTURE), ...Object.keys(FLOODS), ...Object.keys(WATER), ...Object.keys(GLACIERS),
  ...[...Object.keys(EVENTS), ...Object.keys(DISPLACEMENT)].map((k) => path.basename(k)), ...CHANGE_MAPS,
]);
for (const type of await dirs(ANALYSIS)) {
  for (const name of await dirs(path.join(ANALYSIS, type))) {
    if (!known.has(name)) log(`not in the app yet (add it to the tables at the top): ${type}/${name}`);
  }
}
await mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), cases }, null, 1));
log(`${cases.length} cases written to data/analysis/extra.json`);
