import type { EventDetail } from "@/data/types";
import { narrative } from "@/lib/assistant/engine";
import { factOf, type CaseFact } from "@/lib/assistant/facts";
import type { Lang } from "@/lib/assistant/types";

/**
 * Everything a downloadable report shows about one case, in one language,
 * taken from the same data and sentences as the app. The PDF layouts in
 * lib/pdf/documents only arrange it.
 */

export interface Figure {
  src: string;
  caption: string;
}
export interface Point {
  date: string;
  value: number | null;
}
export interface Line {
  label: string;
  color: string;
  points: Point[];
}
export interface Chart {
  title: string;
  unit: string;
  lines: Line[];
  kind: "line" | "bar";
  /** A date to mark with a vertical rule (the event, the peak). */
  marker?: string;
}
export interface Row {
  label: string;
  value: string;
}
export interface Table {
  title: string;
  head: string[];
  rows: string[][];
}

export interface ReportModel {
  lang: Lang;
  fact: CaseFact;
  title: string;
  place: string;
  kind: string;
  period: string;
  summary: string;
  what: string;
  cause: string;
  people: string;
  field: string;
  advice: string[];
  emergency: string;
  caveat: string;
  keyFigures: Row[];
  method: Row[];
  images: Figure[];
  charts: Chart[];
  tables: Table[];
  weather: Chart | null;
  quakes: Table | null;
  limits: string[];
  sources: string[];
  url: string;
  citation: string;
}

const C = { accent: "#c98a2b", blue: "#2b6cb0", teal: "#2c7a7b", red: "#c53030", grey: "#718096", green: "#2f855a" };

export function labels(lang: Lang) {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  return {
    t,
    communityTitle: t("Ficha comunitaria", "Community sheet"),
    technicalTitle: t("Informe técnico", "Technical report"),
    whatHappened: t("Qué pasó", "What happened"),
    whyItHappened: t("Por qué pasó", "Why it happened"),
    whoLives: t("Quién vive ahí", "Who lives there"),
    forFarmers: t("Para quien cultiva", "For those who farm"),
    whatToDo: t("Qué puedes hacer", "What you can do"),
    radarSaw: t("Lo que vio el radar", "What the radar saw"),
    keyFigures: t("Cifras clave", "Key figures"),
    method: t("Método", "Method"),
    overTime: t("A lo largo del tiempo", "Over time"),
    weather: t("Clima alrededor de la fecha clave", "Weather around the key date"),
    quakes: t("Terremotos registrados (USGS)", "Recorded earthquakes (USGS)"),
    limits: t("Límites", "Limits"),
    sources: t("Fuentes y licencias", "Sources and licences"),
    cite: t("Cómo citar", "How to cite"),
    scan: t("Escanea para ver el caso en el globo", "Scan to open the case on the globe"),
    footer: t("Análisis de radar real · no verificado en el terreno", "Real radar analysis · not verified on the ground"),
    page: t("Página", "Page"),
    atlasTitle: t("Atlas de cambios en la superficie", "Atlas of surface change"),
    atlasIntro: t(
      "31 lugares analizados con imágenes reales del satélite de radar NISAR (NASA-ISRO): inundaciones, viento, calor, deslizamientos, incendios, terremotos, glaciares y campos, desde República Dominicana hacia el mundo.",
      "31 places analysed with real images from the NISAR radar satellite (NASA-ISRO): floods, wind, heat, landslides, fires, earthquakes, glaciers and fields, from the Dominican Republic out to the world.",
    ),
    howItWorks: t("Cómo funciona", "How it works"),
    contents: t("Contenido", "Contents"),
  };
}

const fmt = (lang: Lang, v: number, digits = 1) => v.toLocaleString(lang === "es" ? "es-DO" : "en-US", { maximumFractionDigits: digits });

const SOURCES = (lang: Lang) => {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  return [
    t("NISAR L2 GCOV y GUNW, NASA/JPL e ISRO, distribuidos por el ASF DAAC.", "NISAR L2 GCOV and GUNW, NASA/JPL and ISRO, distributed by the ASF DAAC."),
    t("Sentinel-1 RTC (OPERA, NASA); contiene datos Copernicus Sentinel.", "Sentinel-1 RTC (OPERA, NASA); contains Copernicus Sentinel data."),
    t("Clima: API histórica de Open-Meteo, reanálisis ERA5, CC BY 4.0.", "Weather: Open-Meteo historical API, ERA5 reanalysis, CC BY 4.0."),
    t("Terremotos: catálogo del USGS, dominio público.", "Earthquakes: USGS catalogue, public domain."),
    t("Población: GHS-POP R2023A (época 2025), Comisión Europea JRC, CC BY 4.0.", "Population: GHS-POP R2023A (epoch 2025), European Commission JRC, CC BY 4.0."),
    t("Cobertura del suelo: ESA WorldCover 2021 v200, CC BY 4.0.", "Land cover: ESA WorldCover 2021 v200, CC BY 4.0."),
  ];
};

const LIMITS = (lang: Lang) => {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  return [
    t("Un cambio marcado es una pista, no un veredicto: nada se ha comprobado en el terreno.", "A flagged change is a lead, not a verdict: nothing has been checked on the ground."),
    t("La mayoría de los análisis comparan pocas pasadas; los datos de NISAR son públicos desde mediados de 2026.", "Most analyses compare a handful of passes; NISAR data are public only since mid-2026."),
    t("El clima viene de una malla de unos 25 km en el centro del área.", "Weather comes from a grid of about 25 km at the centre of the area."),
    t("La población es una estimación en cuadros de 1 km, no un censo.", "Population is an estimate in 1 km squares, not a census."),
  ];
};

function weatherChart(lang: Lang, d: EventDetail, fact: CaseFact): Chart | null {
  const w = d.context?.weather;
  if (!w?.dates.length) return null;
  const L = labels(lang);
  const pts = (arr: Array<number | null>) => w.dates.map((date, i) => ({ date, value: arr[i] }));
  if (d.type === "storm") return { title: L.weather, unit: "km/h", kind: "bar", lines: [{ label: L.t("Ráfaga máxima diaria", "Daily maximum gust"), color: C.teal, points: pts(w.gustKmh) }], marker: fact.keyDate ?? undefined };
  if (d.type === "drought" || d.type === "wildfire") return { title: L.weather, unit: "°C", kind: "line", lines: [{ label: L.t("Temperatura máxima diaria", "Daily maximum temperature"), color: C.red, points: pts(w.tmaxC) }], marker: fact.keyDate ?? undefined };
  return { title: L.weather, unit: "mm", kind: "bar", lines: [{ label: L.t("Lluvia diaria", "Daily rain"), color: C.blue, points: pts(w.rainMm) }], marker: fact.keyDate ?? undefined };
}

function quakeTable(lang: Lang, d: EventDetail): Table | null {
  const q = d.context?.quakes;
  if (!q?.length) return null;
  const L = labels(lang);
  return {
    title: L.quakes,
    head: [L.t("Magnitud", "Magnitude"), L.t("Fecha", "Date"), L.t("Profundidad", "Depth"), L.t("Lugar", "Place")],
    rows: q.slice(0, 6).map((x) => [fmt(lang, x.mag), narrative.date(lang, x.time.slice(0, 10)), `${Math.round(x.depthKm)} km`, x.place]),
  };
}

/** Kind-specific figures, method, images, charts and tables. */
function analysisParts(lang: Lang, d: EventDetail): Pick<ReportModel, "keyFigures" | "method" | "images" | "charts" | "tables"> {
  const L = labels(lang);
  const km = (v: number) => `${fmt(lang, v)} km²`;
  const day = (iso: string) => narrative.date(lang, iso);
  const x = d.extra;

  if (!x) {
    const a = d.analyses[0];
    return {
      keyFigures: [
        { label: L.t("Cambio sobre tierra", "Changed on land"), value: km(a.land.changedAreaKm2) },
        { label: L.t("Eco más débil", "Weaker echo"), value: km(a.land.decreaseAreaKm2) },
        { label: L.t("Eco más fuerte", "Stronger echo"), value: km(a.land.increaseAreaKm2) },
        { label: L.t("Área analizada", "Area analysed"), value: km(a.land.validAreaKm2) },
      ],
      method: [
        { label: L.t("Sensor", "Sensor"), value: `${a.label} · ${L.t("banda", "band")} ${a.band}` },
        { label: L.t("Polarización", "Polarisation"), value: a.pol },
        { label: L.t("Pasadas comparadas", "Passes compared"), value: `${day(a.pre.date)} → ${day(a.post.date)}` },
        { label: L.t("Órbita", "Orbit"), value: a.group },
        { label: L.t("Umbral", "Threshold"), value: `${fmt(lang, a.method.thresholdDb)} dB (${a.method.direction})` },
        { label: L.t("Filtro de mediana", "Median filter"), value: `${a.method.medianFilterPx} px` },
        { label: L.t("Agua previa excluida", "Prior water excluded"), value: `< ${fmt(lang, a.method.waterDb)} dB` },
        { label: L.t("Píxel / proyección", "Pixel / projection"), value: `${a.grid.pixelSizeM} m · ${a.grid.crs}` },
        ...(a.baseline ? [{ label: L.t("Más allá de 3σ propia", "Beyond each pixel's 3σ"), value: `${km(a.baseline.beyond3SigmaKm2)} (${fmt(lang, a.baseline.beyond3SigmaPct)}%, ${a.baseline.passes} ${L.t("pasadas", "passes")})` }] : []),
      ],
      images: [
        { src: a.images.pre, caption: `${L.t("Antes", "Before")} · ${day(a.pre.date)}` },
        { src: a.images.post, caption: `${L.t("Después", "After")} · ${day(a.post.date)}` },
        { src: a.images.change, caption: L.t("Cambio marcado sobre la imagen de después", "Flagged change over the after image") },
      ],
      charts: [
        {
          title: L.t("Eco de radar mediano por pasada", "Median radar echo per pass"),
          unit: "dB",
          kind: "line",
          marker: a.post.date.slice(0, 10),
          lines: [
            { label: L.t("Tierra que cambió", "Land that changed"), color: C.accent, points: a.series.map((p) => ({ date: p.date, value: p.insideDb })) },
            { label: L.t("Resto de la tierra", "Rest of the land"), color: C.grey, points: a.series.map((p) => ({ date: p.date, value: p.outsideDb })) },
          ],
        },
      ],
      tables: [
        ...(a.landCover
          ? [
              {
                title: L.t("Dónde cayó el cambio (ESA WorldCover)", "Where the change fell (ESA WorldCover)"),
                head: [L.t("Cobertura", "Cover"), L.t("Cambio", "Changed"), L.t("% del cambio", "% of change"), L.t("% del área", "% of area")],
                rows: a.landCover.classes.slice(0, 6).map((c) => [c.label, km(c.flaggedKm2), `${fmt(lang, c.flaggedPct)}%`, `${fmt(lang, c.scenePct)}%`]),
              },
            ]
          : []),
        {
          title: L.t("Polarizaciones", "Polarisations"),
          head: [L.t("Pol.", "Pol."), L.t("Marcado", "Flagged"), L.t("Más débil", "Weaker"), L.t("Más fuerte", "Stronger"), L.t("Mediana Δ", "Median Δ")],
          rows: a.polarisations.map((r) => [`${r.pol}${r.analysed ? " *" : ""}`, km(r.flaggedAreaKm2), km(r.decreaseAreaKm2), km(r.increaseAreaKm2), r.medianDiffDb === null ? "–" : `${fmt(lang, r.medianDiffDb)} dB`]),
        },
      ],
    };
  }

  if (x.kind === "agriculture") {
    const o = x.orbits[0];
    const last = o.frames[o.frames.length - 1];
    const common: Row[] = [
      { label: L.t("Órbita", "Orbit"), value: o.label },
      { label: L.t("Pasadas", "Passes"), value: `${o.dates.length} · ${day(o.dates[0])} → ${day(o.dates[o.dates.length - 1])}` },
      { label: L.t("Polarizaciones", "Polarisations"), value: `${o.coPol} / ${o.crossPol}` },
      { label: L.t("Píxel / proyección", "Pixel / projection"), value: `${o.pixelM} m · ${o.crs}` },
      ...(o.thresholdDb !== null ? [{ label: L.t("Umbral", "Threshold"), value: `${fmt(lang, o.thresholdDb)} dB` }] : []),
    ];
    const orbitsTable: Table = {
      title: L.t("Todas las órbitas", "All orbits"),
      head: [L.t("Órbita", "Orbit"), L.t("Pasadas", "Passes"), L.t("Resultado", "Result")],
      rows: x.orbits.map((r) => [r.label, String(r.dates.length), r.mode === "flood" ? `${L.t("pico", "peak")} ${km(r.peakFloodKm2)}` : `${km(r.harvestedKm2)} (${fmt(lang, r.harvestedPct)}%)`]),
    };
    const images: Figure[] = [{ src: o.map, caption: L.t("Mapa de nuestro análisis", "Map from our analysis") }];
    if (last) images.push({ src: last.src, caption: `${L.t("Pasada del", "Pass of")} ${day(last.date)}` });
    if (o.mode === "flood") {
      return {
        keyFigures: [
          { label: L.t("Agua en el pico", "Water at the peak"), value: km(o.peakFloodKm2) },
          { label: L.t("Fecha del pico", "Peak date"), value: day(o.peakDate) },
          { label: L.t("Extensión máxima", "Largest extent"), value: km(o.maxExtentKm2) },
          { label: L.t("Agua permanente", "Permanent water"), value: km(o.permanentWaterKm2) },
        ],
        method: [...common, { label: L.t("Agua abierta si", "Open water if"), value: `< ${fmt(lang, o.waterMaxDb ?? 0)} dB` }],
        images,
        charts: [
          {
            title: L.t("Agua nueva en cada pasada", "New water at each pass"),
            unit: "km²",
            kind: "line",
            marker: o.peakDate,
            lines: [
              { label: L.t("Total inundado", "Total flooded"), color: C.blue, points: o.series.map((p) => ({ date: p.date, value: p.floodKm2 })) },
              { label: L.t("Agua abierta nueva", "New open water"), color: C.teal, points: o.series.map((p) => ({ date: p.date, value: p.newWaterKm2 })) },
              { label: L.t("Vegetación inundada", "Flooded vegetation"), color: C.green, points: o.series.map((p) => ({ date: p.date, value: p.floodedVegKm2 })) },
            ],
          },
        ],
        tables: [orbitsTable],
      };
    }
    return {
      keyFigures: [
        { label: L.t("Cultivos vigilados", "Crops watched"), value: km(o.vegetatedKm2) },
        { label: L.t("Cambiaron", "Changed"), value: `${km(o.harvestedKm2)} (${fmt(lang, o.harvestedPct)}%)` },
        { label: L.t("Tramo más activo hasta", "Busiest stretch ended"), value: day(o.peakIntervalEnd) },
        { label: L.t("Caída media del eco", "Mean echo drop"), value: `${fmt(lang, o.meanMaxDropDb)} dB` },
      ],
      method: common,
      images,
      charts: [
        {
          title: L.t("Parte de los cultivos que ya cambió", "Share of the crops already changed"),
          unit: "%",
          kind: "line",
          marker: o.peakIntervalEnd,
          lines: [{ label: L.t("Acumulado", "Cumulative"), color: C.accent, points: o.series.map((p) => ({ date: p.date, value: p.cumulativePct })) }],
        },
      ],
      tables: [orbitsTable],
    };
  }

  if (x.kind === "change") {
    const o = x.orbits[0];
    const first = o.frames[0];
    const last = o.frames[o.frames.length - 1];
    const images: Figure[] = [{ src: o.map, caption: L.t("Mapa de cambio de nuestro análisis", "Change map from our analysis") }];
    if (first && last && first !== last) images.push({ src: first.src, caption: `${L.t("Pasada del", "Pass of")} ${day(first.date)}` }, { src: last.src, caption: `${L.t("Pasada del", "Pass of")} ${day(last.date)}` });
    return {
      keyFigures: [
        { label: L.t("Fecha del evento", "Event date"), value: day(x.eventDate) },
        { label: L.t("Eco más débil, máximo", "Weaker echo, at most"), value: km(o.peakDropKm2) },
        { label: L.t("Fecha del máximo", "Date of the maximum"), value: day(o.peakDropDate) },
        { label: L.t("Primera pasada después", "First pass after"), value: `${day(o.firstPostDate)} · ${km(o.firstPostDropKm2)}` },
      ],
      method: [
        { label: L.t("Órbita", "Orbit"), value: o.label },
        { label: L.t("Línea base", "Baseline"), value: `${o.baselineDates.length} ${L.t("pasadas antes del evento", "passes before the event")}` },
        { label: L.t("Polarizaciones", "Polarisations"), value: `${o.coPol} / ${o.crossPol}` },
        ...(o.thresholdDb !== null ? [{ label: L.t("Umbral", "Threshold"), value: `${fmt(lang, o.thresholdDb)} dB` }] : []),
        { label: L.t("Píxel / proyección", "Pixel / projection"), value: `${o.pixelM} m · ${o.crs}` },
      ],
      images,
      charts: [
        {
          title: L.t("Tierra que cambió en cada pasada", "Land that changed at each pass"),
          unit: "km²",
          kind: "bar",
          marker: x.eventDate,
          lines: [
            { label: L.t("Eco más débil", "Weaker echo"), color: C.red, points: o.series.map((p) => ({ date: p.date, value: p.dropKm2 })) },
            { label: L.t("Eco más fuerte", "Stronger echo"), color: C.blue, points: o.series.map((p) => ({ date: p.date, value: p.riseKm2 })) },
          ],
        },
      ],
      tables: [],
    };
  }

  if (x.kind === "glacier") {
    const g = x.groups[0];
    return {
      keyFigures: [
        { label: L.t("Hielo más rápido", "Fastest ice"), value: `${fmt(lang, x.maxSpeedMDay)} m/${L.t("día", "day")}` },
        { label: L.t("Velocidad típica", "Typical speed"), value: `${fmt(lang, g.typicalSpeedMDay)} m/${L.t("día", "day")}` },
        { label: L.t("Hielo rápido", "Fast ice"), value: km(g.fastAreaKm2) },
        { label: L.t("Pares analizados", "Pairs analysed"), value: String(x.pairsAnalysed) },
      ],
      method: [
        { label: L.t("Método", "Method"), value: x.method },
        { label: L.t("Ruido mediano", "Median noise"), value: `${fmt(lang, x.medianNoiseMDay, 2)} m/${L.t("día", "day")}` },
        { label: L.t("Órbita", "Orbit"), value: `${g.label} · ${fmt(lang, g.incidenceDeg)}°` },
        { label: L.t("Píxel / proyección", "Pixel / projection"), value: `${g.pixelM} m · ${g.crs}` },
      ],
      images: [{ src: g.map, caption: L.t("Velocidad del hielo, nuestro análisis", "Ice speed from our analysis") }],
      charts: [
        {
          title: L.t("Velocidad del hielo por par de pasadas", "Ice speed per pair of passes"),
          unit: L.t("m/día", "m/day"),
          kind: "line",
          lines: [
            { label: L.t("Máxima", "Maximum"), color: C.blue, points: g.series.map((p) => ({ date: p.date, value: p.max })) },
            { label: L.t("Percentil 95", "95th percentile"), color: C.teal, points: g.series.map((p) => ({ date: p.date, value: p.p95 })) },
            { label: L.t("Mediana", "Median"), color: C.grey, points: g.series.map((p) => ({ date: p.date, value: p.p50 })) },
          ],
        },
      ],
      tables: [],
    };
  }

  // Ground movement (InSAR)
  const p = x.pairs[0];
  return {
    keyFigures: [
      { label: L.t("Fecha del evento", "Event date"), value: day(x.eventDate) },
      { label: L.t("Hacia el satélite", "Toward the satellite"), value: `${fmt(lang, p.towardMaxCm)} cm` },
      { label: L.t("Lejos del satélite", "Away from the satellite"), value: `${fmt(lang, p.awayMaxCm)} cm` },
      { label: L.t("Movió más de 5 cm", "Moved more than 5 cm"), value: km(p.area5Km2) },
    ],
    method: [
      { label: L.t("Técnica", "Technique"), value: L.t("Interferometría (InSAR), NISAR GUNW", "Interferometry (InSAR), NISAR GUNW") },
      { label: L.t("Onda / franja", "Wave / fringe"), value: `${fmt(lang, p.wavelengthCm)} cm / ${fmt(lang, p.fringeCm)} cm` },
      { label: L.t("Ionosfera corregida", "Ionosphere removed"), value: p.ionosphereRemoved ? L.t("sí", "yes") : L.t("no", "no") },
      { label: L.t("Píxel", "Pixel"), value: `${p.pixelM} m` },
    ],
    images: [
      { src: p.images.fringes, caption: `${L.t("Franjas", "Fringes")} · ${p.label}` },
      { src: p.images.displacement, caption: `${L.t("Movimiento en la línea de vista", "Line-of-sight motion")} · ${p.label}` },
    ],
    charts: [],
    tables: [
      {
        title: L.t("Pares de pasadas", "Pairs of passes"),
        head: [L.t("Par", "Pair"), L.t("Fechas", "Dates"), L.t("Hacia", "Toward"), L.t("Lejos", "Away"), L.t("Fiable", "Reliable")],
        rows: x.pairs.map((r) => [r.label, `${day(r.ref)} → ${day(r.sec)}`, `${fmt(lang, r.towardMaxCm)} cm`, `${fmt(lang, r.awayMaxCm)} cm`, `${fmt(lang, r.reliablePct)}%`]),
      },
    ],
  };
}

export function reportModel(d: EventDetail, lang: Lang, origin: string): ReportModel {
  const fact = factOf(d);
  const L = labels(lang);
  const inDR = d.country === "Dominican Republic";
  const adviceText = narrative.advice(lang, d.type, inDR);
  const adviceLines = adviceText.split("\n").filter(Boolean);
  const emergency = adviceLines.filter((l) => !l.startsWith("- ")).join(" ");
  const url = `${origin}/?case=${encodeURIComponent(d.id)}`;
  return {
    lang,
    fact,
    title: fact.name,
    place: `${d.region}, ${narrative.countryName(lang, d.country)}`,
    kind: narrative.typeName(lang, d.type),
    period: `${narrative.date(lang, fact.start)} – ${narrative.date(lang, fact.end)}`,
    summary: narrative.summary(lang, fact),
    what: L.t(`Entre el ${narrative.date(lang, fact.start)} y el ${narrative.date(lang, fact.end)}, el radar ${fact.sensor} vio que ${narrative.area(lang, fact)}.`, `Between ${narrative.date(lang, fact.start)} and ${narrative.date(lang, fact.end)}, the ${fact.sensor} radar saw that ${narrative.area(lang, fact)}.`),
    cause: narrative.cause(lang, fact),
    people: narrative.people(lang, fact),
    field: narrative.field(lang, fact),
    advice: adviceLines.filter((l) => l.startsWith("- ")).map((l) => l.slice(2)),
    emergency: emergency || (inDR ? L.t("Emergencias: 9-1-1. Sigue las alertas del COE y la Defensa Civil.", "Emergency: 9-1-1. Follow the alerts of the COE and Defensa Civil.") : L.t("En una emergencia, llama al número local y sigue las alertas de protección civil.", "In an emergency, call your local number and follow civil protection alerts.")),
    caveat: narrative.caveat(lang),
    ...analysisParts(lang, d),
    weather: weatherChart(lang, d, fact),
    quakes: quakeTable(lang, d),
    limits: LIMITS(lang),
    sources: SOURCES(lang),
    url,
    citation: `Dancing with the SARs (2026). ${fact.name}: ${L.t("análisis de radar NISAR", "NISAR radar analysis")}. NASA Space Apps Challenge 2026. ${url}`,
  };
}
