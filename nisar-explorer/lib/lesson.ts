import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType, EventSummary } from "@/data/types";
import { msg, t } from "@/i18n/core";
import { formatDate, formatNumber, formatValue } from "@/lib/format";

/**
 * The study guide of one case, built only from the case's own numbers and from
 * a few templates per kind of change. Nothing is written by an AI at run time:
 * the same case always gives the same guide, in either language.
 */

const DAY_MS = 86_400_000;
const PITCHES_PER_KM2 = 140;

/** Just what the guide needs from a case, small enough to ship to the browser. */
export interface LessonSource {
  id: string;
  type: ChangeType;
  name: string;
  region: string;
  country: string;
  sensors: EventSummary["sensors"];
  startDate: string;
  endDate: string;
  changedAreaKm2: number;
  /** The two passes compared and the land that changed, when the case has a change map. */
  analyses: Array<{ pre: { date: string }; post: { date: string }; land: { changedAreaKm2: number } }>;
  /** Pictures from the analysis for the guide (before and after, or the map). */
  figures: Array<{ src: string; caption: string }>;
}

export interface Lesson {
  title: string;
  place: string;
  typeLabel: string;
  facts: Array<[label: string, value: string]>;
  whatHappened: string;
  howSeen: Array<{ title: string; body: string }>;
  caution: string;
  objectives: string[];
  terms: Array<{ term: string; meaning: string }>;
  steps: Array<{ minutes: number; title: string; body: string }>;
  questions: Array<{ kind: string; question: string; answer: string }>;
  activity: { title: string; body: string };
  quiz: Array<{ question: string; options: string[]; answer: number }>;
  resources: Array<{ name: string; url: string; note: string }>;
}

interface Topic {
  objective: string;
  term: [string, string];
  observe: string;
  explain: string;
  interpret1: [string, string];
  interpret2: [string, string];
  activity: [string, string];
}

/** What is different about each kind of change; everything else in the guide is shared. */
const TOPICS: Record<ChangeType, Topic> = {
  flood: {
    objective: msg("Explain why flooded land looks dark in a radar image."),
    term: [msg("Flood"), msg("Land that is normally dry and is covered by water.")],
    observe: msg("Look for patches that are dark in the second image and were not dark in the first one."),
    explain: msg("Calm water acts like a mirror: the radar pulse bounces away and little echo returns. Which patches could be water, and which could be wet soil or crops?"),
    interpret1: [msg("Why does calm water look dark to a radar?"), msg("Because it reflects the pulse away from the satellite like a mirror, so almost no echo comes back.")],
    interpret2: [msg("Why can wetter soil or growing crops be confused with a flood?"), msg("They also change the echo, but they usually make it brighter, not darker, so the direction of the change matters.")],
    activity: [msg("Plan for the next rain"), msg("On a sketch of your neighbourhood, mark where water would gather, the way to higher ground and where you would keep important papers. Compare it with the dark patches in the radar image.")],
  },
  wildfire: {
    objective: msg("Explain what a fire removes from the land and why the radar echo weakens."),
    term: [msg("Burn scar"), msg("The mark left on the land after a fire: leaves and branches are gone and bare soil shows.")],
    observe: msg("Look for patches whose echo got weaker between the two passes."),
    explain: msg("Leaves and branches scatter the radar pulse back to the satellite. Without them the echo drops. What else could remove leaves, and how would you tell it apart from a fire?"),
    interpret1: [msg("Why does burned forest send back a weaker echo?"), msg("Leaves and branches scatter the pulse; once they are gone, less energy returns to the satellite.")],
    interpret2: [msg("What other event could make the echo weaker in the same place?"), msg("Clearing or logging, or a very dry spell. Heat hot spots or optical images on the same dates help tell them apart.")],
    activity: [msg("A fire-safe home"), msg("Draw your home and mark a strip of at least a few metres cleared of dry grass and branches. List three things your community can do to prevent fires.")],
  },
  earthquake: {
    objective: msg("Explain how comparing two radar passes shows how far the ground moved."),
    term: [msg("Fringe"), msg("One full cycle of colour in an interferogram: about half a radar wavelength of ground motion.")],
    observe: msg("Count how many colour rings you can see and where they are closest together."),
    explain: msg("Each full colour cycle is about 12 cm of movement along the line of sight. Where are the rings packed tightest, and what does that say about the movement?"),
    interpret1: [msg("What does one full cycle of colour mean?"), msg("About half the radar wavelength of motion along the line of sight, around 12 cm for NISAR.")],
    interpret2: [msg("Why do some areas appear blank?"), msg("The radar lost the thread there, often over water or dense forest, so those pixels could not be measured.")],
    activity: [msg("Family earthquake plan"), msg("With your family or class, agree on a meeting point, a safe spot in each room (under a sturdy table, away from windows) and what to pack in an emergency bag.")],
  },
  agriculture: {
    objective: msg("Explain how a radar can follow a crop through the season."),
    term: [msg("Crop cycle"), msg("The stages of a crop over time: planting, growth, harvest and bare soil.")],
    observe: msg("Compare the first and last visits: which fields changed, and when?"),
    explain: msg("Tall plants send back a strong echo and bare fields send back much less. If a field drops sharply between two visits, what might have happened on it?"),
    interpret1: [msg("Why does a harvested field send back less echo?"), msg("Standing plants scatter the radar pulse; bare soil or stubble scatters much less.")],
    interpret2: [msg("Why is a single drop not enough to be sure it was a harvest?"), msg("Burning, clearing or flooding can look similar, so the place, the calendar and the whole series of passes matter.")],
    activity: [msg("A field calendar"), msg("Make a simple calendar of planting, growth, harvest and losses for one field or garden, with one row per month. Add what you would want a satellite to tell you.")],
  },
  glacier: {
    objective: msg("Explain how a radar measures the speed of moving ice."),
    term: [msg("Glacier"), msg("A large body of ice that flows slowly downhill, often to the sea.")],
    observe: msg("Find the fastest part of the ice on the speed map and the parts that barely move."),
    explain: msg("The radar finds the same cracks in two images and measures how far they travelled. Distance divided by days gives speed. Why does ice reaching the sea matter to every coast?"),
    interpret1: [msg("How is the speed of the ice measured?"), msg("By finding the same cracks and textures in two passes and dividing how far they moved by the days between them.")],
    interpret2: [msg("Why does a glacier flowing into the sea matter for the Caribbean?"), msg("Ice that reaches the ocean adds water and raises sea level on every coast.")],
    activity: [msg("Ice and sea level"), msg("Fill a glass with ice and water to the brim, then another with a block of ice resting on a plate above the water line. Which one overflows when the ice melts, and what does that say about glaciers on land?")],
  },
  wetland: {
    objective: msg("Explain how radar tells open water from flooded vegetation."),
    term: [msg("Wetland"), msg("Land that is covered or soaked with water for part of the year, home to special plants and animals.")],
    observe: msg("Look for areas that changed between the passes near rivers, lakes or the coast."),
    explain: msg("Open water turns dark, but flooded vegetation can turn bright because the pulse bounces off the water and then the stems. What could each look like here?"),
    interpret1: [msg("Why can flooded vegetation look bright in radar?"), msg("The pulse bounces off the water and then off the stems back to the satellite, a strong 'double bounce'.")],
    interpret2: [msg("Why do wetlands matter for people?"), msg("They soak up floodwater, filter water and shelter wildlife and fish.")],
    activity: [msg("Local water map"), msg("List the rivers, ponds and low areas near you and where water goes after heavy rain. Mark which ones people depend on.")],
  },
  deformation: {
    objective: msg("Explain how radar can notice ground that sinks or rises slowly."),
    term: [msg("Subsidence"), msg("A slow sinking of the ground, for example when water or gas is taken from below.")],
    observe: msg("Look for smooth areas of colour that change slowly across the map."),
    explain: msg("Tiny changes in the radar wave's timing reveal movements of millimetres. Why can this show damage long before it can be seen with the eye?"),
    interpret1: [msg("Why can radar detect movements too small to see?"), msg("It measures the timing of the wave very precisely, so even millimetres of change show up between passes.")],
    interpret2: [msg("Who could use a map of sinking ground?"), msg("Engineers, city planners and water managers, to protect buildings, roads and pipes.")],
    activity: [msg("Check the signs"), msg("Walk around your school or street and look for cracks in walls, tilted poles or uneven ground. Photograph and map them.")],
  },
  landslide: {
    objective: msg("Explain how radar can show that a slope moved."),
    term: [msg("Landslide"), msg("Soil, rock or mud sliding down a slope, often after heavy rain or an earthquake.")],
    observe: msg("Look for patches on slopes where the echo or the ground position changed."),
    explain: msg("Fresh scars and debris change how rough the surface is, so the echo shifts where the ground moved. Which slopes near you could be at risk after long rain?"),
    interpret1: [msg("What can set off a landslide?"), msg("Heavy or long rain that soaks the soil, an earthquake, or building on steep or cut slopes.")],
    interpret2: [msg("Why is it useful to watch slopes from space?"), msg("It shows where ground moved even where roads are cut or clouds hide the land.")],
    activity: [msg("Slope safety walk"), msg("Identify steep slopes near your home or school. Note new cracks, tilted trees or muddy springs, and decide where people should not stay in long rain.")],
  },
  storm: {
    objective: msg("Explain how radar shows crops and trees flattened by wind."),
    term: [msg("Gust"), msg("A short burst of strong wind, much faster than the average wind.")],
    observe: msg("Look for patches where the echo weakened after the wind, compared with the visits before."),
    explain: msg("Standing plants send back a strong echo; flattened ones lose that structure. How would a farmer or an insurer use a map of where the wind hit?"),
    interpret1: [msg("Why does flattened vegetation send back a weaker echo?"), msg("Standing plants scatter the pulse strongly; once flattened they lose that structure.")],
    interpret2: [msg("Who could use a map of wind damage?"), msg("Farmers, insurers and local authorities, to decide where to look and help first.")],
    activity: [msg("Storm-ready home"), msg("List what you would tie down, store or move before a storm, and photograph with the date any damage after it: it helps when asking for aid.")],
  },
  drought: {
    objective: msg("Explain how radar can notice land drying out in the heat."),
    term: [msg("Drought"), msg("A long period with far less water than normal for the soil, plants and people.")],
    observe: msg("Look for large areas where the echo weakened gradually over several visits."),
    explain: msg("Water makes surfaces bright to radar, so drying soil and plants send back less echo. The radar does not feel heat: it sees what heat does. What can people do to save water?"),
    interpret1: [msg("Why does drier land send back a weaker echo?"), msg("Water makes soil and plants bright to radar; as they dry, less energy returns.")],
    interpret2: [msg("Does the radar measure temperature?"), msg("No. It only sees what heat does to the ground and the plants.")],
    activity: [msg("A water budget"), msg("Count the litres your family uses in a day for drinking, washing and cooking, and find three ways to save water in a dry season.")],
  },
};

const RESOURCES: Lesson["resources"] = [
  { name: msg("NISAR mission"), url: "https://nisar.jpl.nasa.gov", note: msg("NASA and ISRO's radar mission: what it measures and why.") },
  { name: msg("NASA Earthdata"), url: "https://www.earthdata.nasa.gov", note: msg("Free NASA satellite data and learning material.") },
  { name: msg("Alaska Satellite Facility (ASF)"), url: "https://asf.alaska.edu", note: msg("Where NISAR and Sentinel-1 radar scenes are stored and shared.") },
  { name: msg("NASA Space Apps Challenge"), url: "https://www.spaceappschallenge.org", note: msg("The hackathon this project was made for.") },
];

const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / DAY_MS);

/** The correct answer goes in a different slot per question, so the answer is not always "A". */
function options(correct: string, wrong: string[], slot: number): { options: string[]; answer: number } {
  const list = [...wrong];
  const at = slot % (wrong.length + 1);
  list.splice(at, 0, correct);
  return { options: list, answer: at };
}

/** The facts every part of the guide shares. */
function factsOf(detail: LessonSource) {
  const a = detail.analyses[0];
  const from = a ? a.pre.date.slice(0, 10) : detail.startDate;
  const to = a ? a.post.date.slice(0, 10) : detail.endDate;
  const area = a ? a.land.changedAreaKm2 : detail.changedAreaKm2;
  return {
    from,
    to,
    span: Math.max(daysBetween(from, to), 1),
    area,
    pitches: formatNumber(Math.max(1, Math.round(area * PITCHES_PER_KM2))),
    sensor: detail.sensors.includes("nisar") ? "NISAR" : "Sentinel-1",
  };
}

export function lessonTitle(detail: LessonSource): string {
  return t(detail.name.replace(/ analysis$/i, ""));
}

export function buildLesson(detail: LessonSource): Lesson {
  const topic = TOPICS[detail.type];
  const f = factsOf(detail);
  const typeLabel = t(CHANGE_TYPES[detail.type].label);
  const params = { place: t(detail.region), d1: formatDate(f.from), d2: formatDate(f.to), span: f.span, area: formatValue(f.area), pitches: f.pitches };

  const questions: Lesson["questions"] = [
    {
      kind: t("Read it"),
      question: t("On which two dates did the satellite look at this place?"),
      answer: t("{d1} and {d2}, {span} days apart.", params),
    },
    {
      kind: t("Read it"),
      question: t("How much land changed, and how big is that in football pitches?"),
      answer: t("About {area} km², roughly {pitches} football pitches.", params),
    },
    { kind: t("Explain it"), question: t(topic.interpret1[0]), answer: t(topic.interpret1[1]) },
    { kind: t("Explain it"), question: t(topic.interpret2[0]), answer: t(topic.interpret2[1]) },
    {
      kind: t("Think about it"),
      question: t("The radar shows that something changed. Why can it not tell us why?"),
      answer: t("Different events can leave a similar echo. Only extra evidence, such as weather records or a visit to the place, can confirm the cause."),
    },
    {
      kind: t("Think about it"),
      question: t("What would you check on the ground to confirm what the radar found?"),
      answer: t("Photos and dates from people who live there, rain or heat records, and a visit to the patches with the biggest change."),
    },
  ];

  const q1 = options(t("{span} days", params), [t("{n} days", { n: f.span + 12 }), t("{n} days", { n: Math.max(f.span - 6, 1) }), t("{n} days", { n: f.span + 30 })], 0);
  const q2 = options(t("NASA and ISRO (India)"), [t("ESA and JAXA"), t("NASA and ESA"), t("Only NASA")], 1);
  const q3 = options(t("Dark, because the pulse bounces away"), [t("Bright, because water shines"), t("The same as the land around it"), t("Invisible, because water has no echo")], 2);
  const area = f.area;
  const q4 = options(t("About {area} km²", params), [
    t("About {area} km²", { area: formatValue(area * 10) }),
    t("About {area} km²", { area: formatValue(Math.max(area / 10, 0.1)) }),
    t("About {area} km²", { area: formatValue(area * 100) }),
  ], 3);
  const q5 = options(t("No: it shows that something changed, not why"), [t("Yes, always"), t("Yes, if the area is large"), t("Only at night")], 4);

  return {
    title: lessonTitle(detail),
    place: `${t(detail.region)}, ${t(detail.country)}`,
    typeLabel,
    facts: [
      [t("Kind of change"), typeLabel],
      [t("Satellite passes"), `${formatDate(f.from)} → ${formatDate(f.to)}`],
      [t("Days between them"), `${f.span}`],
      [t("Land that changed"), t("{area} km² (about {pitches} football pitches)", params)],
      [t("Instrument"), `${f.sensor} · ${t("radar, day and night")}`],
    ],
    whatHappened: t(
      "A radar satellite passed over {place} on {d1}, and again {span} days later. About {area} km² of land (roughly {pitches} football pitches) looked different the second time.",
      params,
    ),
    howSeen: [
      { title: t("It makes its own light"), body: t("Like a bat, it sends a signal and listens for the echo.") },
      { title: t("Clouds do not stop it"), body: t("It works at night, in rain and through smoke.") },
      { title: t("Water looks dark"), body: t("Calm water is a mirror. Forests and towns look bright.") },
    ],
    caution: t("These figures come from radar images read by our team. Nobody has checked them on the ground yet: treat them as clues, not conclusions."),
    objectives: [
      t("Describe in your own words what happened in {place}.", params),
      t("Read a before and after radar image and say what changed."),
      t(topic.objective),
    ],
    terms: [
      { term: t("Pass"), meaning: t("One visit of the satellite over a place. NISAR returns every 12 days.") },
      { term: t("Echo (backscatter)"), meaning: t("The part of the radar pulse that bounces back to the satellite. Rough or leafy ground returns more; calm water returns almost none.") },
      { term: t("False colour"), meaning: t("Colours chosen to show what the radar measured. They are not what a camera would see.") },
      { term: t(topic.term[0]), meaning: t(topic.term[1]) },
    ],
    steps: [
      { minutes: 10, title: t("Observe"), body: t("Look at the before and after images without any explanation. {look}", { look: t(topic.observe) }) },
      { minutes: 10, title: t("Compare"), body: t("Drag the line to compare the two visits. Write down three differences and where they are.") },
      { minutes: 15, title: t("Explain"), body: t(topic.explain) },
      { minutes: 10, title: t("Check"), body: t("Answer the questions and the quiz, then share one idea with the class: what would you want to know next?") },
    ],
    questions,
    activity: { title: t(topic.activity[0]), body: t(topic.activity[1]) },
    quiz: [
      { question: t("How many days passed between the two radar visits?"), ...q1 },
      { question: t("Which space agencies built NISAR?"), ...q2 },
      { question: t("How does calm water look in a radar image?"), ...q3 },
      { question: t("About how much land changed here?"), ...q4 },
      { question: t("Can the radar alone prove what caused the change?"), ...q5 },
    ],
    resources: RESOURCES.map((r) => ({ ...r, name: t(r.name), note: t(r.note) })),
  };
}

/** A ready-to-paste prompt so a student can study the case with any AI assistant of their choice. */
export function buildStudyPrompt(detail: LessonSource): string {
  const f = factsOf(detail);
  const topic = TOPICS[detail.type];
  return t(
    "You are a patient science tutor for a secondary-school student. We are studying a real case seen by the NISAR radar satellite (NASA and ISRO).\n\nCase: {name} in {place}.\nKind of change: {type}.\nThe satellite looked on {d1} and again on {d2} ({span} days later).\nAbout {area} km² of land changed (roughly {pitches} football pitches).\nImportant: these figures come from radar images read by a student team; they have not been verified on the ground.\n\nWhat I should understand: {objective}\n\nHow to help me:\n1. Ask me which grade I am in, then explain with simple words and everyday examples.\n2. Ask me ONE question at a time and wait for my answer before the next one.\n3. If I am wrong, give a hint first and then explain.\n4. Use only the facts above; if something is not known, say so instead of inventing it.\n5. Finish with a 3-question quiz and tell me my score.",
    {
      name: lessonTitle(detail),
      place: t(detail.region) + ", " + t(detail.country),
      type: t(CHANGE_TYPES[detail.type].label),
      d1: formatDate(f.from),
      d2: formatDate(f.to),
      span: f.span,
      area: formatValue(f.area),
      pitches: f.pitches,
      objective: t(topic.objective),
    },
  );
}
