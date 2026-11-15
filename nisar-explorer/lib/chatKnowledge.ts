import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import { getDataProvider } from "@/data/providers";
import type { ChangeType, EventDetail, EventSummary } from "@/data/types";
import { translate } from "@/i18n/core";
import { normalizeText } from "@/lib/search";

/**
 * Server only. What the assistant knows, built from the same analyses the app
 * shows, in three layers so the prompt stays about the same size however many
 * cases there are (the free tiers cap tokens per minute):
 *   - a summary of every case by kind and country,
 *   - one line per case, only for the kinds and countries the question names,
 *   - the full facts of the few cases it is about (the one open on screen, and
 *     the ones it names).
 */

/** Cases told in full in one prompt. */
const MAX_DETAILED = 3;
/** One-line cases listed in one prompt; past this the question has to narrow it down. */
const MAX_LINES = 40;

const km = (v: number | null | undefined) => (v === null || v === undefined ? "?" : `${Math.round(v * 100) / 100} km²`);
const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "?");

/** Words that point at a kind of change without naming a place. */
const TYPE_WORDS: Record<ChangeType, string> = {
  wetland: "embalse embalses presa presas lago lagos reservoir reservoirs dam lake lakes agua water nivel level",
  flood: "inundacion inundaciones inundado crecida flood floods flooding flooded lluvia rain vaguada",
  glacier: "glaciar glaciares hielo glacier glaciers ice",
  wildfire: "incendio incendios fuego quema fire fires wildfire burn",
  earthquake: "terremoto terremotos sismo sismos temblor earthquake earthquakes quake",
  agriculture: "agricultura cultivo cultivos cosecha arroz campo campos farm farming crop crops harvest rice",
  deformation: "deformacion hundimiento subsidence deformation",
  landslide: "deslizamiento deslizamientos derrumbe derrumbes ladera landslide landslides collapse slope",
  storm: "viento vientos tormenta ventarron temporal wind storm windstorm",
  drought: "sequia sequias calor seco drought heat dry",
};

/** Other ways people name a country, besides its English and Spanish names. */
const COUNTRY_WORDS: Record<string, string> = {
  "Dominican Republic": "rd dominicana dominicano dominicanos quisqueya",
  "United States": "eeuu usa estados unidos",
};

const STOP = new Set(
  "que como cual cuales donde cuando paso pasa pasado ocurrio sucedio dime explica explicame sobre por para con sin los las una uno del de la el en y o a es son fue hay mas muy este esta esto ese esa eso sus su se lo le les al happened tell explain about the and for with what how why when where which who this that these those are was were has have had does did can could from into about there their our your you not but all any more most".split(
    " ",
  ),
);

function haystackOf(e: EventSummary): string {
  const parts = [e.name, e.region, e.country, CHANGE_TYPES[e.type].label];
  return normalizeText([...parts, ...parts.map((p) => translate("es", p)), TYPE_WORDS[e.type], e.id.replace(/-/g, " ")].join(" "));
}

/** How many of the question's words appear in the case's name, place or kind. Plurals count. */
function scoreOf(haystack: string, tokens: string[]): number {
  return tokens.reduce((sum, token) => {
    if (haystack.includes(token)) return sum + 1;
    return token.length > 5 && haystack.includes(token.slice(0, -2)) ? sum + 1 : sum;
  }, 0);
}

const wordsOf = (text: string): Set<string> => new Set(normalizeText(text).split(/[^a-z0-9ñ]+/).filter(Boolean));

/** True when a word of the question is one of these words, plurals included ("embalses" finds "embalse"). */
const namesAny = (words: Set<string>, tokens: string[]): boolean =>
  tokens.some((t) => words.has(t) || words.has(t.replace(/s$/, "")) || words.has(t.replace(/es$/, "")));

const TYPE_VOCAB = new Map(
  CHANGE_TYPE_ORDER.map((type) => [type, wordsOf(`${TYPE_WORDS[type]} ${CHANGE_TYPES[type].label} ${translate("es", CHANGE_TYPES[type].label)}`)]),
);
const countryVocab = (country: string): Set<string> =>
  wordsOf(`${country} ${translate("es", country)} ${COUNTRY_WORDS[country] ?? ""}`);

/** The headline number of a case, for the index. */
function headline(d: EventDetail): string {
  const x = d.extra;
  if (!x) {
    const a = d.analyses[0];
    return a ? `${km(a.land.changedAreaKm2)} of land flagged (${a.sensor.toUpperCase()} ${a.pol}, ${day(a.pre.date)}→${day(a.post.date)})` : "";
  }
  switch (x.kind) {
    case "water": {
      const o = x.orbits[0];
      return `calm water ${km(o.firstWaterKm2)} on ${o.firstDate} → ${km(o.lastWaterKm2)} on ${o.lastDate} (least ${km(o.minWaterKm2)}, most ${km(o.maxWaterKm2)})`;
    }
    case "agriculture": {
      const o = x.orbits[0];
      return o.mode === "flood" ? `flooded at peak ${km(o.peakFloodKm2)} on ${o.peakDate}` : `${km(o.harvestedKm2)} of fields changed (${o.harvestedPct}%)`;
    }
    case "change": {
      const o = x.orbits[0];
      return `${km(o.peakDropKm2)} lost echo by ${o.peakDropDate} after ${x.eventDate}`;
    }
    case "displacement": {
      const p = x.pairs[0];
      return `ground moved up to ${p.towardMaxCm} cm toward / ${Math.abs(p.awayMaxCm)} cm away, ${p.ref}→${p.sec}`;
    }
    case "glacier":
      return `ice up to ${x.maxSpeedMDay} m/day`;
  }
}

function weatherLines(d: EventDetail): string[] {
  const w = d.context?.weather;
  const out: string[] = [];
  if (w && w.dates.length) {
    const rain = w.rainMm.map((v) => v ?? 0);
    const wettest = rain.indexOf(Math.max(...rain));
    const temps = w.tmaxC.filter((v): v is number => v !== null);
    const gusts = w.gustKmh.filter((v): v is number => v !== null);
    out.push(
      `Weather at the centre of the area (ERA5 reanalysis, ~25 km grid), ${w.dates[0]}→${w.dates[w.dates.length - 1]}: ` +
        `total rain ${Math.round(rain.reduce((a, b) => a + b, 0))} mm, wettest day ${w.dates[wettest]} (${Math.round(rain[wettest])} mm)` +
        (temps.length ? `, hottest ${Math.round(Math.max(...temps))} °C` : "") +
        (gusts.length ? `, strongest gust ${Math.round(Math.max(...gusts))} km/h` : "") +
        ".",
    );
  }
  const q = d.context?.quakes?.[0];
  if (q) out.push(`Largest nearby earthquake (USGS): magnitude ${q.mag}, ${q.place}, ${day(q.time)}, ${Math.round(q.depthKm)} km deep.`);
  return out;
}

function peopleLine(d: EventDetail): string | null {
  const p = d.people;
  if (!p || p.areaPeople < 1) return null;
  const exposed = p.exposedPeople ? `; about ${Math.round(p.exposedPeople)} live on the land the analysis flagged` : "";
  return `People (GHSL 2025 grid, an estimate): about ${Math.round(p.areaPeople)} live in the analysed area${exposed}.`;
}

/** Everything the app knows about one case, as plain sentences. */
function detailOf(d: EventDetail): string {
  const lines = [`### ${d.name} — ${d.region}, ${d.country} (id ${d.id})`, `Kind: ${CHANGE_TYPES[d.type].label}. Passes from ${d.startDate} to ${d.endDate}.`];
  const x = d.extra;
  if (!x) {
    for (const a of d.analyses) {
      lines.push(
        `${a.label} ${a.band}-band ${a.pol}, ${a.resolution_m} m: compared ${day(a.pre.date)} with ${day(a.post.date)}. ` +
          `On land, echo dropped on ${km(a.land.decreaseAreaKm2)} and rose on ${km(a.land.increaseAreaKm2)} (threshold ${a.method.thresholdDb} dB).` +
          (a.baseline ? ` ${a.baseline.beyond3SigmaPct}% of the flagged land changed more than 3× the normal pass-to-pass variability (${a.baseline.passes} passes).` : ""),
      );
      const cover = a.landCover?.classes
        .filter((c) => c.flaggedPct >= 5)
        .map((c) => `${c.label} ${c.flaggedPct}%`)
        .join(", ");
      if (cover) lines.push(`Ground cover of the flagged land (ESA WorldCover): ${cover}.`);
    }
  } else if (x.kind === "water") {
    const o = x.orbits[0];
    lines.push(
      `A ${x.body}. Calm open water (co-pol echo below ${o.waterMaxDb} dB) counted on ${o.dates.length} NISAR passes (${o.label}): ` +
        `first ${km(o.firstWaterKm2)} on ${o.firstDate}, last ${km(o.lastWaterKm2)} on ${o.lastDate}, most ${km(o.maxWaterKm2)} on ${o.maxDate}, least ${km(o.minWaterKm2)} on ${o.minDate}.`,
      `Per pass: ${o.series.map((p) => `${p.date} ${km(p.waterKm2)}`).join("; ")}.`,
      `Caution: wind ruffles water and makes it look like land to the radar, so single passes can jump; the trend matters more.`,
    );
  } else if (x.kind === "agriculture") {
    const o = x.orbits[0];
    if (o.mode === "flood") {
      lines.push(
        `Flood against a dry baseline of ${o.baselineDates.length} earlier passes (${o.label}, ${o.coPol}/${o.crossPol}). ` +
          `Peak on ${o.peakDate}: ${km(o.peakFloodKm2)} under water (${km(o.peakNewWaterKm2)} new open water, ${km(o.peakFloodedVegKm2)} flooded vegetation). ` +
          `Largest extent over all passes ${km(o.maxExtentKm2)}; permanent water left out ${km(o.permanentWaterKm2)}.`,
        `Per pass (total flooded): ${o.series.map((p) => `${p.date} ${km(p.floodKm2)}${p.baseline ? " (baseline)" : ""}`).join("; ")}.`,
      );
      if (x.setting) lines.push(`Setting: ${x.setting}.`);
    } else {
      lines.push(
        `Our reading of the place: ${x.activity}. ${km(o.harvestedKm2)} (${o.harvestedPct}% of the vegetated land) lost echo between ${o.dates[0]} and ${o.dates[o.dates.length - 1]}; ` +
          `busiest 12 days ended ${o.peakIntervalEnd} (${km(o.peakIntervalDropKm2)}).`,
      );
    }
  } else if (x.kind === "change") {
    const o = x.orbits[0];
    lines.push(
      `Event date set by the team from public reports: ${x.eventDate} (looking for ${x.cause}). ${o.baselineDates.length} passes before it set what is normal (${o.label}). ` +
        `First look after: ${o.firstPostDate}, ${km(o.firstPostDropKm2)} weaker. Most weakened: ${km(o.peakDropKm2)} on ${o.peakDropDate}. ` +
        `On the last pass (${o.lastDate}) ${km(o.lastDropKm2)} weaker and ${km(o.lastRiseKm2)} stronger.`,
    );
  } else if (x.kind === "displacement") {
    const p = x.pairs[0];
    lines.push(
      `InSAR (NISAR GUNW, ${p.label}), ${p.ref}→${p.sec}, event ${x.eventDate}: up to ${p.towardMaxCm} cm toward and ${Math.abs(p.awayMaxCm)} cm away from the satellite along the line of sight; ` +
        `${km(p.area5Km2)} moved more than 5 cm, ${km(p.area10Km2)} more than 10 cm. ${p.reliablePct}% of the picture was reliable (coherence ${p.coherence}).`,
    );
  } else if (x.kind === "glacier") {
    const g = x.groups[0];
    lines.push(
      `Ice speed from NISAR pixel offsets over ${x.pairsAnalysed} pairs: fastest ${x.maxSpeedMDay} m/day, typical ${g.typicalSpeedMDay} m/day, ` +
        `${km(g.fastAreaKm2)} faster than ${g.fastThresholdMs} m/day; noise on still ground ${x.medianNoiseMDay} m/day.`,
    );
  }
  const people = peopleLine(d);
  if (people) lines.push(people);
  lines.push(...weatherLines(d));
  return lines.join("\n");
}

const METHODS = `How the app works (use for general questions):
- NISAR is a NASA–ISRO radar satellite. Its L-band radar (24 cm wavelength) sees through clouds, smoke and night, and passes over the same place every 12 days.
- Polarisations: HH (co-pol) is strong on water edges and buildings; HV (cross-pol) comes from leaves and branches, so it drops when vegetation is lost.
- Calm water reflects the pulse away and looks dark; flooded trees and crops can look brighter (double bounce off water and stems).
- Floods: each pass is compared with a dry baseline of earlier passes. Reservoirs and lakes: calm water is counted on every pass. Dated events (wind, heat, drought, landslides): passes after the event are compared with the normal of the passes before it. Earthquakes: InSAR phase, each colour cycle about 12 cm of motion. Glaciers: tracking how the speckle pattern slides between passes.
- Two fire cases also compare with Sentinel-1 C-band (OPERA RTC), which sees mostly the top of the canopy.
- Extra data: population from the GHSL grid, weather from the ERA5 reanalysis, earthquakes from USGS, ground cover from ESA WorldCover.`;

const RULES = `You are the assistant of "SarLight", a web app for the NASA Space Apps Challenge 2026 challenge "Dancing with the SARs", built in the Dominican Republic. It shows real NISAR radar analyses on a globe.
Rules:
- Reply to the user's last message only; earlier turns are context. Never repeat or redo an earlier answer (not even to change its language). A greeting or thanks gets a short, friendly reply and an offer to help with the map, the radar or a case.
- Answer only from the facts below and the method notes. If they do not cover the question, say what you do know and that the analysis does not cover the rest. Never invent numbers, dates, places or cases.
- A flagged change is a lead, not a verdict: nothing has been checked on the ground. Present causes as likely explanations, not facts.
- Answer in the language named at the very end of these instructions, whatever language the facts are in. In Spanish, use clear, neutral Dominican Spanish for students and teachers: short sentences, few technical words.
- Be brief: usually 2 to 5 sentences. Plain text only: no Markdown, tables, headings or bullet symbols.
- In an emergency, tell people to call their local emergency number (9-1-1 in the Dominican Republic) and follow official alerts.`;

interface Indexed {
  detail: EventDetail;
  haystack: string;
  line: string;
}
let indexPromise: Promise<Indexed[]> | null = null;

/** Built once per server instance: the analyses only change with a redeploy. */
function loadIndex(): Promise<Indexed[]> {
  indexPromise ??= (async () => {
    const provider = getDataProvider();
    const events = await provider.getEvents();
    const details = await Promise.all(events.map((e) => provider.getEventById(e.id)));
    return details
      .filter((d): d is EventDetail => d !== null)
      .map((d) => ({
        detail: d,
        haystack: haystackOf(d),
        line: `- ${d.name} (${d.country}) · ${CHANGE_TYPES[d.type].label} · ${headline(d)} · id ${d.id}`,
      }));
  })();
  return indexPromise;
}

/** Every case counted by kind, with the countries and the dates it spans. */
function summaryOf(index: Indexed[]): string {
  const lines: string[] = [];
  for (const type of CHANGE_TYPE_ORDER) {
    const cases = index.filter((c) => c.detail.type === type);
    if (!cases.length) continue;
    const perCountry = new Map<string, number>();
    for (const c of cases) perCountry.set(c.detail.country, (perCountry.get(c.detail.country) ?? 0) + 1);
    const countries = [...perCountry].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => `${name} ${n}`);
    const start = cases.reduce((min, c) => (c.detail.startDate < min ? c.detail.startDate : min), cases[0].detail.startDate);
    const end = cases.reduce((max, c) => (c.detail.endDate > max ? c.detail.endDate : max), cases[0].detail.endDate);
    lines.push(`- ${CHANGE_TYPES[type].label}: ${cases.length} cases (${countries.join(", ")}), passes from ${start} to ${end}.`);
  }
  return `All ${index.length} analysed cases, by kind:\n${lines.join("\n")}`;
}

/** One line per case of the kinds and countries the question names; nothing when it names neither. */
function listingOf(index: Indexed[], tokens: string[]): string {
  const types = new Set(CHANGE_TYPE_ORDER.filter((type) => namesAny(TYPE_VOCAB.get(type)!, tokens)));
  const countries = new Set([...new Set(index.map((c) => c.detail.country))].filter((country) => namesAny(countryVocab(country), tokens)));
  if (!types.size && !countries.size) {
    return "The question names no kind of change or country, so individual cases are not listed. If it needs them, ask the user which kind or country they mean.";
  }
  const listed = index.filter((c) => (!types.size || types.has(c.detail.type)) && (!countries.size || countries.has(c.detail.country)));
  const shown = listed.slice(0, MAX_LINES);
  const more = listed.length - shown.length;
  return (
    `Cases of the kinds and countries the question names (${listed.length}, one line each):\n${shown.map((c) => c.line).join("\n")}` +
    (more > 0 ? `\n(${more} more not listed: ask the user to narrow it down by country or kind.)` : "")
  );
}

/** The instructions for one question: rules, method notes, the summary, the listing, and the cases it is about. */
export async function buildInstructions(question: string, openCaseId: string | null, lang: "en" | "es"): Promise<string> {
  const index = await loadIndex();
  const words = normalizeText(question)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
  // Two-letter words only name countries ("RD"); for places and kinds they match too much.
  const tokens = words.filter((w) => w.length >= 3);

  const picked: Indexed[] = [];
  const open = openCaseId ? index.find((c) => c.detail.id === openCaseId) : undefined;
  if (open) picked.push(open);
  const ranked = index
    .map((c) => ({ c, score: scoreOf(c.haystack, tokens) }))
    .filter((r) => r.score > 0 && r.c !== open)
    .sort((a, b) => b.score - a.score);
  // Only the best matches: "Sabana Yegua" should not pull in every case that shares one word.
  const best = ranked[0]?.score ?? 0;
  for (const r of ranked.filter((x) => x.score === best)) {
    if (picked.length >= MAX_DETAILED) break;
    picked.push(r.c);
  }

  return [
    RULES,
    METHODS,
    open ? `The user has this case open on screen: ${open.detail.name} (id ${open.detail.id}).` : "The user has no case open.",
    summaryOf(index),
    listingOf(index, words),
    picked.length ? `Full facts of the cases this question is about:\n\n${picked.map((c) => detailOf(c.detail)).join("\n\n")}` : "",
    // Last, so it is the freshest instruction the model reads.
    lang === "es" ? "Answer language: Spanish." : "Answer language: English. Do not answer in Spanish.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
