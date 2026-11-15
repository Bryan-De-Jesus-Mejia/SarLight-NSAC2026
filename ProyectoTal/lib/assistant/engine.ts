import type { ChangeType } from "@/data/types";
import { haversineKm } from "@/lib/evidence";
import type { CaseFact } from "@/lib/assistant/facts";
import type { AssistantReply, ChatAction, Lang } from "@/lib/assistant/types";

/**
 * The offline guide: understands questions about our cases and about radar,
 * in Spanish or English, and answers only from the case facts. No network, no
 * key, no cost: it is what answers when no language model is configured or
 * the free quota is used up, and it never makes a number up.
 */

/* ------------------------------- language -------------------------------- */

export const normalise = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:()"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function languageOf(text: string): Lang {
  return /[¿¡áéíóúñ]|\b(que|como|cuando|donde|por que|para que|cual|cuales|cuantos|cuantas|hola|gracias|el|los|las|una|del|hay|mi|llevame|muestrame|esta|estan|paso)\b/i.test(text)
    ? "es"
    : "en";
}

const t = (lang: Lang, es: string, en: string) => (lang === "es" ? es : en);
const has = (q: string, re: RegExp) => re.test(q);

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function date(lang: Lang, iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return lang === "es" ? `${d} ${MONTHS_ES[m - 1]} ${y}` : `${MONTHS_EN[m - 1]} ${d}, ${y}`;
}
const num = (lang: Lang, v: number) => v.toLocaleString(lang === "es" ? "es-DO" : "en-US", { maximumFractionDigits: 1 });
function people(lang: Lang, n: number): string {
  if (n < 100) return t(lang, "menos de 100", "fewer than 100");
  const digits = Math.floor(Math.log10(n)) - 1;
  const r = Math.round(n / 10 ** digits) * 10 ** digits;
  return t(lang, `unas ${num(lang, r)}`, `about ${num(lang, r)}`);
}

/* ------------------------------ vocabulary ------------------------------- */

const TYPE_WORDS: Array<[ChangeType, RegExp]> = [
  ["flood", /\b(inunda\w*|anega\w*|crecida|flood\w*|agua)\b/],
  ["storm", /\b(viento\w*|tormenta\w*|huracan\w*|rafaga\w*|wind\w*|storm\w*|hurricane\w*)\b/],
  ["drought", /\b(sequia\w*|calor|seco|secas?|drought|heat|dry\w*)\b/],
  ["landslide", /\b(deslizamiento\w*|derrumbe\w*|desliz\w*|ladera\w*|landslide\w*|slope\w*|colapso)\b/],
  ["wildfire", /\b(incendio\w*|fuego\w*|quema\w*|fire\w*|wildfire\w*|burn\w*)\b/],
  ["earthquake", /\b(terremoto\w*|sismo\w*|temblor\w*|earthquake\w*|quake\w*|seism\w*)\b/],
  ["glacier", /\b(glaciar\w*|hielo|glacier\w*|ice)\b/],
  ["agriculture", /\b(cosecha\w*|cultivo\w*|agricola\w*|agricultura|campos?|arroz|palma|harvest\w*|crop\w*|farm\w*|rice|agricultur\w*)\b/],
];

const TYPE_NAME: Record<ChangeType, [string, string]> = {
  flood: ["inundación", "flood"],
  storm: ["daños por viento", "wind damage"],
  drought: ["calor y sequía", "heat and drought"],
  landslide: ["vigilancia de deslizamientos", "landslide watch"],
  wildfire: ["incendio", "fire"],
  earthquake: ["terremoto", "earthquake"],
  glacier: ["glaciar", "glacier"],
  agriculture: ["campos agrícolas", "farmland"],
  wetland: ["humedal", "wetland"],
  deformation: ["deformación del suelo", "ground deformation"],
};
const typeName = (lang: Lang, type: ChangeType) => TYPE_NAME[type][lang === "es" ? 0 : 1];
const TYPE_PLURAL: Record<ChangeType, [string, string]> = {
  flood: ["inundaciones", "floods"],
  storm: ["casos de viento", "wind cases"],
  drought: ["casos de calor y sequía", "heat and drought cases"],
  landslide: ["casos de deslizamientos", "landslide cases"],
  wildfire: ["incendios", "fires"],
  earthquake: ["terremotos", "earthquakes"],
  glacier: ["glaciares", "glaciers"],
  agriculture: ["casos agrícolas", "farming cases"],
  wetland: ["humedales", "wetlands"],
  deformation: ["casos de deformación", "deformation cases"],
};

const COUNTRIES: Array<[RegExp, string, string]> = [
  [/\b(republica dominicana|dominicana|rd|quisqueya|dominican republic|dominican)\b/, "Dominican Republic", "República Dominicana"],
  [/\bvenezuela\b/, "Venezuela", "Venezuela"],
  [/\b(mexico)\b/, "Mexico", "México"],
  [/\bindonesia\b/, "Indonesia", "Indonesia"],
  [/\bpanama\b/, "Panama", "Panamá"],
  [/\bnepal\b/, "Nepal", "Nepal"],
  [/\b(groenlandia|greenland)\b/, "Greenland", "Groenlandia"],
  [/\b(estados unidos|eeuu|ee uu|usa|united states|us)\b/, "United States", "Estados Unidos"],
  [/\b(canada)\b/, "Canada", "Canadá"],
  [/\b(ucrania|ukraine)\b/, "Ukraine", "Ucrania"],
  [/\b(egipto|egypt)\b/, "Egypt", "Egipto"],
  [/\bvietnam\b/, "Vietnam", "Vietnam"],
  [/\b(bangladesh|banglades)\b/, "Bangladesh", "Bangladés"],
  [/\bindia\b/, "India", "India"],
  [/\b(brasil|brazil)\b/, "Brazil", "Brasil"],
  [/\b(antartida|antarctica)\b/, "Antarctica", "Antártida"],
];
const countryName = (lang: Lang, english: string) => (lang === "es" ? (COUNTRIES.find((c) => c[1] === english)?.[2] ?? english) : english);

/** Places people say that point to one of our cases. */
const ALIASES: Array<[RegExp, string[]]> = [
  [/\bsanto domingo norte|\bsdn\b|\bozama\b/, ["ozama-flood"]],
  [/\bsanto domingo\b|\bcapital\b|\bdistrito nacional\b/, ["capotillo-flood", "ozama-flood"]],
  [/\bsan pedro\b|\bmacoris\b/, ["san-pedro-flood"]],
  [/\bocoa\b/, ["ocoa-flood"]],
  [/\bsan cristobal\b|\bcacaos\b/, ["los-cacaos-landslide"]],
  [/\bmiches\b|\bseibo\b/, ["miches-landslide"]],
  [/\bcibao\b|\bsantiago\b|\bla vega\b/, ["cibao-wind"]],
  [/\bvalverde\b|\bmao\b/, ["valverde-wind"]],
  [/\blinea noroeste\b|\bnoroeste\b|\bmontecristi\b|\bdajabon\b/, ["noroeste-heat"]],
  [/\bbahoruco\b|\bbarahona\b/, ["bahoruco-fire"]],
  [/\bpelempito\b|\bpedernales\b/, ["pelempito-fire"]],
  [/\bjakobshavn\b|\bilulissat\b/, ["jakobshavn-glacier"]],
  [/\bhubbard\b|\balaska\b|\byakutat\b/, ["hubbard-glacier"]],
  [/\bpine island\b/, ["pine-island-glacier"]],
  [/\blangtang\b/, ["langtang-collapse"]],
  [/\bchiapas\b/, ["mexico-quake"]],
  [/\bmekong\b/, ["mekong-rice-flood"]],
  [/\bnilo\b|\bnile\b/, ["nile-delta-rice"]],
  [/\bpunjab\b/, ["punjab-burning"]],
  [/\bamazon\w*|\bpara\b/, ["amazon-clearing"]],
  [/\briau\b|\bsumatra\b/, ["riau-palm-clearing"]],
  [/\bchattogram\b|\bchittagong\b/, ["chattogram-rice-flood"]],
  [/\biowa\b/, ["iowa-harvest"]],
  [/\bsaskatchewan\b/, ["saskatchewan-harvest"]],
  [/\bsacramento\b|\bcalifornia\b/, ["sacramento-rice"]],
];

const STOP = new Set(["analysis", "flood", "flooding", "fire", "harvest", "wind", "damage", "watch", "landslide", "earthquake", "glacier", "ice", "flow", "crop", "rice", "field", "urban", "the", "and", "coast", "central", "valley", "delta", "republic", "dominican", "heat", "drought", "line", "clearing", "burning", "residue", "collapse", "forest", "sea"]);
const tokensOf = (f: CaseFact) =>
  [...new Set(normalise(`${f.name} ${f.region}`).split(" ").filter((w) => w.length >= 4 && !STOP.has(w)))];

function findCases(q: string, facts: CaseFact[]): CaseFact[] {
  const out = new Map<string, number>();
  for (const [re, ids] of ALIASES) if (re.test(q)) ids.forEach((id, i) => out.set(id, (out.get(id) ?? 0) + 3 - i * 0.5));
  const words = new Set(q.split(" "));
  for (const f of facts) {
    const score = tokensOf(f).filter((w) => words.has(w)).length;
    if (score) out.set(f.id, (out.get(f.id) ?? 0) + score);
  }
  return [...out.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => facts.find((f) => f.id === id))
    .filter((f): f is CaseFact => Boolean(f));
}

const typesIn = (q: string) => TYPE_WORDS.filter(([, re]) => re.test(q)).map(([type]) => type);
const countryIn = (q: string) => COUNTRIES.find(([re]) => re.test(q))?.[1] ?? null;

/* ------------------------------ case answers ------------------------------ */

function areaPhrase(lang: Lang, f: CaseFact): string {
  const km = `${num(lang, f.km2)} km²`;
  switch (f.type) {
    case "flood":
      return t(lang, `${km} quedaron bajo el agua en el momento de más agua`, `${km} were under water at the peak`);
    case "storm":
      return t(lang, `${km} de cultivos y árboles perdieron su eco de radar después del viento`, `${km} of crops and trees lost their radar echo after the wind`);
    case "drought":
      return t(lang, `${km} de tierra perdieron eco durante el calor`, `${km} of land lost echo during the heat`);
    case "landslide":
      return f.motionCm
        ? t(lang, `el suelo se movió hasta ${f.motionCm} cm hacia o desde el satélite`, `the ground moved up to ${f.motionCm} cm toward or away from the satellite`)
        : t(lang, `${km} de laderas cambiaron su superficie`, `${km} of slopes changed their surface`);
    case "wildfire":
      return t(lang, `${km} de terreno mostraron la marca de un incendio`, `${km} of land showed the mark of a fire`);
    case "earthquake":
      return f.motionCm
        ? t(lang, `el suelo se movió hasta ${f.motionCm} cm hacia o desde el satélite`, `the ground moved up to ${f.motionCm} cm toward or away from the satellite`)
        : t(lang, "el suelo se movió", "the ground moved");
    case "glacier":
      return f.iceMDay
        ? t(lang, `el hielo más rápido avanza ${num(lang, f.iceMDay)} metros por día hacia el mar`, `the fastest ice moves ${num(lang, f.iceMDay)} metres a day toward the sea`)
        : t(lang, "el hielo se desliza hacia el mar", "the ice slides toward the sea");
    default:
      return t(lang, `${km} de campos cambiaron (cosecha, desmonte o agua)`, `${km} of fields changed (harvest, clearing or water)`);
  }
}

function peopleLine(lang: Lang, f: CaseFact): string {
  if (f.type === "glacier" || !f.people) return "";
  if (f.exposed && f.exposed > 0 && f.type !== "earthquake") {
    return t(
      lang,
      `${people(lang, f.exposed)[0].toUpperCase()}${people(lang, f.exposed).slice(1)} personas viven en la tierra que cambió, de ${people(lang, f.people)} en toda la zona analizada.`,
      `${people(lang, f.exposed)[0].toUpperCase()}${people(lang, f.exposed).slice(1)} people live on the land that changed, out of ${people(lang, f.people)} in the whole area.`,
    );
  }
  return t(lang, `En la zona analizada viven ${people(lang, f.people)} personas.`, `${people(lang, f.people)[0].toUpperCase()}${people(lang, f.people).slice(1)} people live in the area we watched.`);
}

function causeLine(lang: Lang, f: CaseFact): string {
  if ((f.type === "flood" || f.type === "landslide") && f.rainWeekMm !== undefined && f.keyDate) {
    const ratio = f.rainRatio && f.rainRatio >= 1.3 ? t(lang, `, ${num(lang, f.rainRatio)} veces una semana normal`, `, ${num(lang, f.rainRatio)}× a usual week`) : "";
    return t(lang, `En la semana antes del ${date(lang, f.keyDate)} llovieron ${f.rainWeekMm} mm${ratio}.`, `${f.rainWeekMm} mm of rain fell in the week before ${date(lang, f.keyDate)}${ratio}.`);
  }
  if (f.type === "storm" && f.gustKmh) return t(lang, `La ráfaga más fuerte registrada fue de ${f.gustKmh} km/h.`, `The strongest gust on record was ${f.gustKmh} km/h.`);
  if ((f.type === "drought" || f.type === "wildfire") && f.hottestC) {
    const days = f.hotDays ? t(lang, ` y hubo ${f.hotDays} días de 35 °C o más`, `, with ${f.hotDays} days at 35 °C or more`) : "";
    return t(lang, `El día más caluroso llegó a ${f.hottestC} °C${days}.`, `The hottest day reached ${f.hottestC} °C${days}.`);
  }
  if (f.quake) {
    return t(
      lang,
      `El USGS registró un sismo de magnitud ${f.quake.mag} el ${date(lang, f.quake.date)}, a ${f.quake.depthKm} km de profundidad y a unos ${f.quake.km} km del centro del área.`,
      `USGS recorded a magnitude ${f.quake.mag} earthquake on ${date(lang, f.quake.date)}, ${f.quake.depthKm} km deep, about ${f.quake.km} km from the centre of the area.`,
    );
  }
  return "";
}

const FIELD_ES: Record<string, string> = {
  "Possible crop loss": "posible pérdida de cosecha",
  "Fields drying": "campos secándose",
  "Fields under water": "campos bajo el agua",
  "Harvest under way": "cosecha en marcha, normal de la temporada",
  "Fields cleared, likely by fire": "campos limpiados, probablemente con fuego",
  "Forest or plantation cleared": "bosque o plantación desmontados",
};
function fieldLine(lang: Lang, f: CaseFact): string {
  if (!f.field) return "";
  const label = { alert: ["Alerta", "Alert"], watch: ["Vigilancia", "Watch"], normal: ["Temporada", "Seasonal"] }[f.field.level][lang === "es" ? 0 : 1];
  return t(lang, `Para quien cultiva: ${label.toLowerCase()}, ${FIELD_ES[f.field.title] ?? f.field.title}.`, `For those who farm: ${label.toLowerCase()}, ${f.field.title.toLowerCase()}.`);
}

const caveat = (lang: Lang) => t(lang, "Es una pista del radar: nadie lo ha verificado en el terreno todavía.", "It is a lead from the radar: nobody has checked it on the ground yet.");
const caseButtons = (f: CaseFact): ChatAction[] => [
  { kind: "fly", id: f.id, label: f.name },
  { kind: "story", id: f.id, label: f.name },
];

function summary(lang: Lang, f: CaseFact): string {
  const place = `${f.region}, ${countryName(lang, f.country)}`;
  const when = t(lang, `Entre el ${date(lang, f.start)} y el ${date(lang, f.end)}`, `Between ${date(lang, f.start)} and ${date(lang, f.end)}`);
  const what = t(lang, `${when}, el radar ${f.sensor} vio que ${areaPhrase(lang, f)}.`, `${when}, the ${f.sensor} radar saw that ${areaPhrase(lang, f)}.`);
  return [`${f.name} (${place}) · ${typeName(lang, f.type)}.`, what, causeLine(lang, f), peopleLine(lang, f), fieldLine(lang, f), caveat(lang)].filter(Boolean).join(" ");
}

function aspect(lang: Lang, q: string, f: CaseFact): string | null {
  if (has(q, /\b(gente|personas|poblacion|habitantes|afectad\w*|viven|people|population|living|affected|lives)\b/)) {
    return peopleLine(lang, f) || t(lang, `No tenemos datos de población para ${f.name}.`, `We have no population figures for ${f.name}.`);
  }
  if (has(q, /\b(por que|causa\w*|lluvia|llovio|llueve|viento|rafaga|calor|temperatura|why|cause\w*|rain\w*|gust|hot)\b/)) {
    const c = causeLine(lang, f);
    return c
      ? `${c} ${t(lang, "Es el registro del clima o de sismos alrededor de la fecha clave; apoya la explicación, no la prueba píxel a píxel.", "That is the weather or earthquake record around the key date; it supports the explanation, it does not prove it pixel by pixel.")}`
      : t(lang, `No tenemos un registro de clima o sismos que explique ${f.name}.`, `We have no weather or earthquake record that explains ${f.name}.`);
  }
  if (has(q, /\b(cuando|fecha\w*|dia|when|date\w*)\b/)) {
    return t(lang, `Analizamos ${f.name} entre el ${date(lang, f.start)} y el ${date(lang, f.end)}${f.keyDate ? `; la fecha clave es el ${date(lang, f.keyDate)}` : ""}.`, `We analysed ${f.name} from ${date(lang, f.start)} to ${date(lang, f.end)}${f.keyDate ? `; the key date is ${date(lang, f.keyDate)}` : ""}.`);
  }
  if (has(q, /\b(verificad\w*|confirmad\w*|confiable|fiable|seguro|real|cierto|verified|confirmed|true|sure|accurate|reliable|trust\w*)\b/)) {
    return t(lang, `Lo de ${f.name} sale de comparar imágenes de radar reales con un método que explicamos en Methods, pero nadie lo ha comprobado en el terreno. Tómalo como una pista seria para mirar de cerca, no como un veredicto.`, `${f.name} comes from comparing real radar images with a method we explain under Methods, but nobody has checked it on the ground. Treat it as a serious lead worth a closer look, not a verdict.`);
  }
  if (has(q, /\b(cultiv\w*|cosecha\w*|agricult\w*|campo\w*|produccion|crop\w*|farm\w*|harvest\w*)\b/)) {
    return fieldLine(lang, f) || t(lang, `En ${f.name} no hay campos que vigilar en nuestro análisis.`, `${f.name} has no fields to watch in our analysis.`);
  }
  return null;
}

/* --------------------------------- advice --------------------------------- */

const ADVICE: Partial<Record<ChangeType, [string[], string[]]>> = {
  flood: [
    ["Ten clara la ruta hacia un lugar alto antes de la lluvia; guarda documentos y medicinas en una bolsa sellada.", "Nunca cruces agua en movimiento, ni a pie ni en carro: 30 cm pueden arrastrar un vehículo.", "Después, hierve o trata el agua de beber y evita caminar descalzo en el agua: transmite enfermedades."],
    ["Know your way to higher ground before the rain; keep papers and medicine in a sealed bag.", "Never walk or drive through moving water: 30 cm can carry a car away.", "Afterwards, boil or treat drinking water and avoid wading barefoot: floodwater spreads disease."],
  ],
  storm: [
    ["Amarra techos y objetos sueltos antes de la tormenta.", "Aléjate de cables caídos y árboles dañados.", "Fotografía los cultivos dañados con la fecha: ayuda al pedir ayuda o seguro."],
    ["Tie down roofs and loose objects before the storm.", "Keep away from fallen power lines and damaged trees.", "Photograph damaged fields with the date: it helps when asking for aid or insurance."],
  ],
  drought: [
    ["Guarda el agua tapada: los recipientes abiertos crían el mosquito del dengue.", "Trabaja afuera temprano o tarde y bebe agua seguido; la confusión y la piel seca y caliente son señales de golpe de calor.", "No quemes campos ni basura con tiempo seco y ventoso."],
    ["Store water covered: open containers breed the mosquitoes that carry dengue.", "Work outdoors early or late and drink often; confusion and hot dry skin are signs of heat stroke.", "Do not burn fields or rubbish in dry, windy weather."],
  ],
  landslide: [
    ["Vigila grietas nuevas en paredes o suelo, postes y árboles inclinados, o manantiales que se enturbian.", "Sal de laderas empinadas y del pie de cañadas durante lluvias fuertes y largas.", "Evita construir en taludes cortados o al borde de una cañada."],
    ["Watch for new cracks in walls or ground, tilting poles and trees, or springs turning muddy.", "Leave steep slopes and the foot of ravines during long, heavy rain.", "Avoid building on cut slopes or close to a ravine edge."],
  ],
  wildfire: [
    ["Nunca quemes campos o basura en días secos y con viento.", "Mantén limpia de hierba seca una franja alrededor de la casa.", "Avisa pronto si ves humo: un fuego pequeño es fácil de parar."],
    ["Never burn fields or rubbish on dry, windy days.", "Keep a strip around the house clear of dry grass.", "Report smoke early: a small fire is easy to stop."],
  ],
  earthquake: [
    ["Durante el temblor: agáchate, cúbrete bajo una mesa firme y agárrate.", "Acuerda con tu familia un punto de encuentro antes de que pase.", "Después, espera réplicas, revisa fugas de gas y no entres en edificios agrietados."],
    ["During the shaking: drop, cover under a sturdy table and hold on.", "Agree on a meeting point with your family before it happens.", "Afterwards, expect aftershocks, check for gas leaks and stay out of cracked buildings."],
  ],
};
function advice(lang: Lang, type: ChangeType, inDR: boolean): string {
  const list = ADVICE[type]?.[lang === "es" ? 0 : 1];
  if (!list) return "";
  const call = inDR
    ? t(lang, "Emergencias: 9-1-1. Sigue las alertas del COE y la Defensa Civil.", "Emergency: 9-1-1. Follow the alerts of the COE and Defensa Civil.")
    : t(lang, "En una emergencia, llama al número local y sigue las alertas de protección civil.", "In an emergency, call your local number and follow civil protection alerts.");
  return `${list.map((a) => `- ${a}`).join("\n")}\n${call}`;
}

/* -------------------------------- concepts -------------------------------- */

const CONCEPTS: Array<{ test: RegExp; es: string; en: string }> = [
  {
    test: /\b(que es nisar|nisar|satelite|satellite)\b/,
    es: "NISAR es un satélite de radar de la NASA y la ISRO, la agencia espacial de India. Usa ondas de unos 24 cm (banda L) y fotografía casi toda la tierra y el hielo cada 12 días, de día o de noche y a través de las nubes. Ese ritmo permite comparar el mismo lugar en fechas distintas.",
    en: "NISAR is a radar satellite from NASA and ISRO, India's space agency. It uses waves about 24 cm long (L-band) and images almost all land and ice every 12 days, by day or night and through clouds. That rhythm lets us compare the same place on different dates.",
  },
  {
    test: /\b(nube\w*|noche|cloud\w*|night|dark side)\b/,
    es: "Las gotas de las nubes miden centésimas de milímetro; la onda del radar de NISAR mide unos 24 cm, así que pasa como si no estuvieran. Además lleva su propia señal, por eso funciona de noche. Prueba la lupa de nubes para ver la diferencia.",
    en: "Cloud droplets are hundredths of a millimetre; NISAR's radar wave is about 24 cm long, so it passes as if they were not there. It also brings its own signal, so it works at night. Try the cloud lens to see the difference.",
  },
  {
    test: /\b(agua.*oscur\w*|oscur\w*|negr\w*|water.*dark|dark|black)\b/,
    es: "El agua en calma es un espejo para el radar: el pulso rebota lejos del satélite y casi nada vuelve, así que se ve oscura. El suelo rugoso y las plantas dispersan el pulso y devuelven una parte, por eso se ven claros. Una inundación aparece como una mancha que se oscurece entre dos fechas.",
    en: "Calm water is a mirror for radar: the pulse bounces away and almost nothing comes back, so it looks dark. Rough ground and plants scatter the pulse and send some back, so they look bright. A flood shows up as a patch that turns dark between two dates.",
  },
  {
    test: /\b(color\w*|colour\w*|verde|azul|green|blue|polariz\w*|hh|hv)\b/,
    es: "Los colores del radar son falso color, no lo que vería una cámara. En la capa NISAR, el verde suele ser vegetación, el naranja o amarillo zona urbana o suelo con poca vegetación, y el azul agua en calma, arena seca o suelo helado. Mezcla polarizaciones: HH (la onda vuelve igual) y HV (vuelve girada, típico de hojas y ramas).",
    en: "Radar colours are false colour, not what a camera sees. In the NISAR layer green is usually vegetation, orange or yellow urban or sparsely vegetated ground, and blue calm water, dry sand or frozen ground. It mixes polarisations: HH (the wave comes back the same) and HV (it comes back turned, typical of leaves and branches).",
  },
  {
    test: /\b(decibel\w*|db)\b/,
    es: "El decibel cuenta la fuerza del eco multiplicando: cada 3 dB menos es la mitad del eco. Una caída de 6 dB significa que solo volvió una cuarta parte.",
    en: "A decibel counts echo strength by multiplying: every 3 dB less is half the echo. A 6 dB drop means only a quarter came back.",
  },
  {
    test: /\b(12 dias|doce dias|12 days|twelve days|cada cuanto|how often|orbita|orbit)\b/,
    es: "NISAR repite la misma ruta cada 12 días, con el mismo ángulo. Así, si dos imágenes cambian, el cambio viene del suelo y no de cómo se tomó la foto. Puedes ver un ciclo real de 12 días con el botón del baile del satélite.",
    en: "NISAR repeats the same path every 12 days, at the same angle. So if two images differ, the change comes from the ground, not from how the picture was taken. You can watch one real 12-day cycle with the satellite's dance button.",
  },
  {
    test: /\b(franja\w*|anillo\w*|interferom\w*|insar|fringe\w*|ring\w*)\b/,
    es: "Los anillos de colores salen de comparar el tiempo exacto que tarda la onda en dos visitas. Si el suelo se movió, ese tiempo cambia. Cada ciclo completo de colores equivale a unos 12 cm de movimiento hacia o desde el satélite.",
    en: "The coloured rings come from comparing the exact travel time of the wave on two visits. If the ground moved, that time shifts. Each full colour cycle is about 12 cm of motion toward or away from the satellite.",
  },
  {
    test: /\b(como cont\w*|estima\w*|ghsl|censo|census|how.*count)\b/,
    es: "Usamos el mapa de población GHSL de la Comisión Europea, que divide el planeta en cuadros de 1 km con una estimación de cuánta gente vive en cada uno. Sumamos la gente de los puntos donde nuestro radar marcó cambio. Es una estimación, no un censo.",
    en: "We use the GHSL population map from the European Commission, which splits the planet into 1 km squares with an estimate of how many people live in each. We add up the people on the spots where our radar flagged change. It is an estimate, not a census.",
  },
  {
    test: /\b(verificad\w*|confiable|fiable|seguro|exact\w*|verified|reliable|accurate|trust)\b/,
    es: "Todos los números salen de imágenes de radar reales procesadas por nuestro equipo, pero ninguno se ha comprobado en el terreno. Un cambio marcado es una pista, no un veredicto. El clima (ERA5) y los sismos (USGS) son registros independientes que apoyan la explicación.",
    en: "Every number comes from real radar images processed by our team, but none has been checked on the ground. A flagged change is a lead, not a verdict. Weather (ERA5) and earthquakes (USGS) are independent records that support the explanation.",
  },
  {
    test: /\b(radar|sar|como funciona|funciona|how does|how it works|work)\b/,
    es: "Un radar envía sus propios pulsos de microondas al suelo y escucha el eco. Como lleva su propia luz, funciona de noche, y las microondas atraviesan nubes y humo. La fuerza del eco dice cómo es la superficie: lisa, mojada, rugosa o con plantas.",
    en: "A radar sends its own microwave pulses to the ground and listens to the echo. Because it brings its own light it works at night, and microwaves pass through clouds and smoke. How strong the echo is tells us about the surface: smooth, wet, rough or covered in plants.",
  },
  {
    test: /\b(como uso|como se usa|usar|navegar|boton\w*|capa\w*|how do i|how to use|navigate|button\w*|layer\w*)\b/,
    es: "Arrastra el globo para girarlo y usa la rueda para acercar. Toca un marcador para abrir un caso y \"Tell me the story\" para que te lo cuente paso a paso. Arriba tienes la casita (¿mi comunidad está en riesgo?), la lupa de nubes y el baile del satélite; abajo, la leyenda, las capas y la línea de tiempo. También puedes pedirme: \"llévame a Capotillo\".",
    en: "Drag the globe to turn it and scroll to zoom. Tap a marker to open a case and \"Tell me the story\" to hear it step by step. At the top: the house (is my community at risk?), the cloud lens and the satellite's dance; at the bottom, the legend, layers and timeline. You can also ask me: \"take me to Capotillo\".",
  },
  {
    test: /\b(quien\w* (hizo|creo|son)|equipo|challenge|reto|space apps|who (made|built)|team)\b/,
    es: "Esta web la hizo el equipo \"Dancing with the SARs\" para el NASA Space Apps Challenge 2026, con datos reales de NISAR procesados por nuestra propia cadena de análisis, desde República Dominicana hacia el mundo.",
    en: "This site was made by the \"Dancing with the SARs\" team for the NASA Space Apps Challenge 2026, with real NISAR data processed by our own analysis pipeline, from the Dominican Republic out to the world.",
  },
];

export const SUGGESTIONS: Record<Lang, string[]> = {
  es: ["¿Qué pasó en Capotillo?", "¿Dónde hay más gente afectada?", "Llévame al terremoto de Venezuela", "¿Mi comunidad está en riesgo?", "¿Por qué el agua se ve oscura?"],
  en: ["What happened in Capotillo?", "Where are the most people affected?", "Take me to the Venezuela earthquake", "Is my community at risk?", "Why does water look dark?"],
};

/* ---------------------------------- main ---------------------------------- */

const GO = /\b(llevame|lleva\w*|vuela|vamos|ve a|ir a|muestra\w*|ensena\w*|abre|abrir|ver\b|show|take me|go to|fly|open|zoom)\b/;
const STORY = /\b(historia|cuenta\w*|relato|story|tell me)\b/;
const RISK = /\b(riesgo|peligro|mi zona|mi comunidad|mi casa|mi barrio|mi pueblo|donde vivo|cerca de mi|at risk|risk|danger|my area|my community|near me|where i live|safe)\b/;
const SAFETY = /\b(que hago|que hacer|que debo|como me preparo|prepar\w*|protej\w*|emergencia|consejo\w*|what should i do|what do i do|prepare|stay safe|advice|emergency)\b/;
const MOST = /\b(mas|mayor|peor|grande|fuerte|rapido|record|most|biggest|largest|worst|strongest|fastest|highest)\b/;
const LIST = /\b(cuant\w*|lista\w*|cuales|que casos|casos|todos|hay|how many|list|which|what cases|cases|all)\b/;
const CONCEPT_Q = /^(que es|que son|que significa|que significan|como funciona|como|por que|what is|what are|what does|how does|how do|how can|why|explain|explica\w*)\b/;
const ASPECT = /\b(gente|personas|poblacion|viven|afectad\w*|por que|causa\w*|lluvia|llovio|cuando|fecha\w*|verificad\w*|confiable|fiable|seguro|cierto|esto|eso|cultiv\w*|cosecha\w*|people|population|why|cause\w*|rain\w*|when|date\w*|verified|reliable|true|crops?|farm\w*|harvest\w*|it|that)\b/;
const THIS = /\b(aqui|ahi|alli|este caso|ese caso|este lugar|esa zona|esta zona|here|there|this case|that case|this place)\b/;

export function answer(question: string, facts: CaseFact[], ctx: { lastId?: string | null; openId?: string | null }): AssistantReply {
  const lang = languageOf(question);
  const q = normalise(question);
  const none: AssistantReply = { text: "", actions: [], run: [] };

  if (!q) return none;
  if (/^(hola|buenas|buenos dias|buenas tardes|hey|hi|hello|good (morning|afternoon|evening))\b/.test(q) && q.split(" ").length <= 4) {
    return { ...none, text: t(lang, "¡Hola! Conozco los 31 lugares que analizamos con el radar NISAR: inundaciones, viento, calor, deslizamientos, incendios, terremotos, glaciares y campos. Pregúntame por un lugar, por la gente afectada o por cómo funciona el radar, o pídeme que te lleve a un caso.", "Hi! I know the 31 places we analysed with the NISAR radar: floods, wind, heat, landslides, fires, earthquakes, glaciers and fields. Ask me about a place, the people affected or how radar works, or ask me to take you to a case.") };
  }
  if (/^(gracias|muchas gracias|thanks|thank you|ok|vale|perfecto|genial|great)\b/.test(q) && q.split(" ").length <= 4) {
    return { ...none, text: t(lang, "¡Con gusto! Si quieres, pregúntame por otro lugar.", "You're welcome! Ask me about another place whenever you like.") };
  }

  // App actions asked by name.
  if (has(q, /\b(lupa|a traves de las nubes|bajo las nubes|quitar las nubes|see through|cloud lens|under the clouds|remove the clouds)\b/)) {
    const a: ChatAction = { kind: "lens" };
    return { text: t(lang, "Activé la lupa de nubes: mueve el puntero sobre el globo y dentro del círculo verás el suelo que las nubes tapan ese día. El radar de NISAR ve así siempre, con nubes o de noche.", "I turned on the cloud lens: move the pointer over the globe and inside the circle you will see the ground the clouds hide that day. NISAR's radar always sees like this, through clouds or at night."), actions: [a], run: [a] };
  }
  if (has(q, /\b(baile|danza|dance|ciclo de 12|12 day cycle|pasadas del satelite|satellite passes)\b/)) {
    const a: ChatAction = { kind: "dance" };
    return { text: t(lang, "Ahí va el baile del satélite: un ciclo real de 12 días de escenas de NISAR cubriendo el planeta, pasada a pasada.", "Here is the satellite's dance: one real 12-day cycle of NISAR scenes covering the planet, pass by pass."), actions: [a], run: [a] };
  }
  if (has(q, /\b(tour|recorrido|demo|visita guiada|guided)\b/)) {
    const a: ChatAction = { kind: "demo" };
    return { text: t(lang, "Empieza el recorrido guiado: dos minutos, sin tocar nada.", "Starting the guided tour: two minutes, hands free."), actions: [a], run: [a] };
  }

  const found = findCases(q, facts);
  const types = typesIn(q);
  const country = countryIn(q);
  const contextCase = THIS.test(q) || (!found.length && !types.length && !country && ASPECT.test(q) && q.split(" ").length <= 8)
    ? facts.find((f) => f.id === (ctx.lastId ?? ctx.openId)) ?? null
    : null;
  const focus = found[0] ?? contextCase;

  // Safety advice.
  if (has(q, SAFETY)) {
    const type = types[0] ?? focus?.type ?? "flood";
    const text = advice(lang, type, (focus?.country ?? "Dominican Republic") === "Dominican Republic");
    if (text) return { ...none, text: `${t(lang, `Ante ${typeName(lang, type) === "inundación" ? "una inundación" : typeName(lang, type)}:`, `For ${typeName(lang, type)}:`)}\n${text}` };
  }

  // Risk for a place.
  if (has(q, RISK)) {
    const place = found[0] ?? null;
    if (place) {
      const near = facts.filter((f) => haversineKm(place.lat, place.lon, f.lat, f.lon) <= 40).sort((a, b) => haversineKm(place.lat, place.lon, a.lat, a.lon) - haversineKm(place.lat, place.lon, b.lat, b.lon));
      const kinds = [...new Set(near.map((f) => typeName(lang, f.type)))].join(", ");
      return {
        text: t(lang, `Cerca de ${place.region} (40 km) nuestro radar encontró señales de: ${kinds}. ${peopleLine(lang, place)} Para un punto exacto, abre "¿Mi comunidad está en riesgo?" y toca tu lugar en el globo. Que no haya señal no significa que no haya riesgo.`, `Within 40 km of ${place.region} our radar found signs of: ${kinds}. ${peopleLine(lang, place)} For an exact spot, open "Is my community at risk?" and tap your place on the globe. No signal does not mean no risk.`),
        actions: [...near.slice(0, 3).map((f): ChatAction => ({ kind: "fly", id: f.id, label: f.name })), { kind: "community" }],
        run: [],
        topicId: place.id,
      };
    }
    const a: ChatAction = { kind: "community" };
    return { text: t(lang, "Abrí el panel \"¿Mi comunidad está en riesgo?\". Usa tu ubicación o toca tu comunidad en el globo y te digo qué encontró nuestro radar cerca, cuánta gente vive ahí y qué hacer. Solo cuenta lo que analizamos: que no haya señal no significa que no haya riesgo.", "I opened \"Is my community at risk?\". Use your location or tap your community on the globe and it will show what our radar found nearby, how many people live there and what to do. It only knows what we analysed: no signal does not mean no risk."), actions: [a], run: [a] };
  }

  // Go / story commands on a case.
  if (focus && has(q, STORY)) {
    const a: ChatAction = { kind: "story", id: focus.id, label: focus.name };
    return { text: t(lang, `Te cuento la historia de ${focus.name} paso a paso en el globo. Baja o pulsa "Next" para avanzar; en cada paso hay un botón "¿Por qué?" con la ciencia detrás.`, `Here is the story of ${focus.name}, step by step on the globe. Scroll or press "Next"; every step has a "Why?" button with the science behind it.`), actions: [a], run: [a], topicId: focus.id };
  }
  if (focus && has(q, GO)) {
    const a: ChatAction = { kind: "fly", id: focus.id, label: focus.name };
    return { text: `${t(lang, `Vamos a ${focus.name}.`, `Flying to ${focus.name}.`)} ${summary(lang, focus)}`, actions: [{ kind: "story", id: focus.id, label: focus.name }], run: [a], topicId: focus.id };
  }

  // Superlatives.
  if (has(q, MOST) && !found.length) {
    const pool = facts.filter((f) => (!types.length || types.includes(f.type)) && (!country || f.country === country));
    let pick: CaseFact | undefined;
    let line = "";
    if (has(q, /\b(gente|personas|poblacion|afectad\w*|people|population|affected)\b/)) {
      pick = [...pool].filter((f) => f.exposed).sort((a, b) => (b.exposed ?? 0) - (a.exposed ?? 0))[0];
      if (pick) line = t(lang, `Donde más gente vive en tierra que cambió: ${pick.name}, con ${people(lang, pick.exposed ?? 0)} personas.`, `The most people living on changed land are in ${pick.name}: ${people(lang, pick.exposed ?? 0)}.`);
    } else if (has(q, /\b(terremoto\w*|sismo\w*|magnitud|earthquake\w*|quake\w*|magnitude)\b/)) {
      pick = [...pool].filter((f) => f.quake).sort((a, b) => (b.quake?.mag ?? 0) - (a.quake?.mag ?? 0))[0];
      if (pick?.quake) line = t(lang, `El sismo más fuerte de nuestros casos: ${pick.name}, magnitud ${pick.quake.mag} el ${date(lang, pick.quake.date)} (USGS).`, `The strongest earthquake among our cases is ${pick.name}: magnitude ${pick.quake.mag} on ${date(lang, pick.quake.date)} (USGS).`);
    } else if (has(q, /\b(lluvia|llovio|rain\w*)\b/)) {
      pick = [...pool].filter((f) => f.rainWeekMm !== undefined).sort((a, b) => (b.rainWeekMm ?? 0) - (a.rainWeekMm ?? 0))[0];
      if (pick) line = t(lang, `La semana más lluviosa antes de una fecha clave fue en ${pick.name}: ${pick.rainWeekMm} mm.`, `The wettest week before a key date was in ${pick.name}: ${pick.rainWeekMm} mm.`);
    } else if (has(q, /\b(rapido|velocidad|hielo|fast\w*|speed|ice)\b/)) {
      pick = [...pool].filter((f) => f.iceMDay).sort((a, b) => (b.iceMDay ?? 0) - (a.iceMDay ?? 0))[0];
      if (pick) line = t(lang, `El hielo más rápido está en ${pick.name}: ${num(lang, pick.iceMDay ?? 0)} m por día.`, `The fastest ice is at ${pick.name}: ${num(lang, pick.iceMDay ?? 0)} m a day.`);
    } else {
      pick = [...pool].filter((f) => f.type !== "glacier" && f.type !== "earthquake").sort((a, b) => b.km2 - a.km2)[0];
      if (pick) line = t(lang, `El área más grande marcada es ${pick.name}: ${num(lang, pick.km2)} km².`, `The largest flagged area is ${pick.name}: ${num(lang, pick.km2)} km².`);
    }
    if (pick && line) return { text: `${line} ${caveat(lang)}`, actions: caseButtons(pick), run: [], topicId: pick.id };
  }

  // A case: one aspect, or the whole summary.
  if (focus && !(CONCEPT_Q.test(q) && !found.length && !THIS.test(q) && CONCEPTS.some((c) => c.test.test(q)))) {
    const part = aspect(lang, q, focus);
    return { text: part ?? summary(lang, focus), actions: caseButtons(focus), run: [], topicId: focus.id };
  }

  // Science questions.
  const concept = CONCEPT_Q.test(q) || !(types.length || country) ? CONCEPTS.find((c) => c.test.test(q)) : undefined;
  if (concept) return { ...none, text: concept[lang] };

  // Lists by kind and/or country.
  if (types.length || country || has(q, LIST)) {
    const pool = facts.filter((f) => (!types.length || types.includes(f.type)) && (!country || f.country === country));
    if (pool.length) {
      const what = [types.length ? types.map((ty) => TYPE_PLURAL[ty][lang === "es" ? 0 : 1]).join(", ") : t(lang, "casos", "cases"), country ? t(lang, `en ${countryName(lang, country)}`, `in ${countryName(lang, country)}`) : ""].filter(Boolean).join(" ");
      const lines = pool.slice(0, 8).map((f) => `- ${f.name} (${countryName(lang, f.country)}), ${date(lang, f.start)}`);
      return {
        text: `${t(lang, `Tenemos ${pool.length} ${what}:`, `We have ${pool.length} ${what}:`)}\n${lines.join("\n")}${pool.length > 8 ? t(lang, `\n…y ${pool.length - 8} más.`, `\n…and ${pool.length - 8} more.`) : ""}\n${t(lang, "Pregúntame por cualquiera o pídeme que te lleve.", "Ask me about any of them or ask me to take you there.")}`,
        actions: pool.slice(0, 3).map((f): ChatAction => ({ kind: "fly", id: f.id, label: f.name })),
        run: [],
      };
    }
    return { ...none, text: t(lang, "No tenemos casos de ese tipo en ese lugar todavía.", "We do not have cases of that kind in that place yet.") };
  }

  return {
    ...none,
    text: t(lang, `No estoy seguro de haber entendido. Puedo contarte qué pasó en cualquiera de los 31 lugares, cuánta gente vive ahí, qué lo causó, qué hacer ante una inundación o un sismo, o cómo funciona el radar. Prueba: "${SUGGESTIONS.es[0]}" o "${SUGGESTIONS.es[2]}".`, `I'm not sure I understood. I can tell you what happened in any of the 31 places, how many people live there, what caused it, what to do in a flood or an earthquake, or how radar works. Try: "${SUGGESTIONS.en[0]}" or "${SUGGESTIONS.en[2]}".`),
  };
}
