import type { ChangeType, EventDetail } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";

/**
 * What a case means for people: head counts (GHSL grid crossed with our change
 * masks), the field watch for those who farm, and general safety advice.
 * Pure functions, shared by the "For people" card and the assistant.
 */

/** Round a head count the way people say it. */
export function aboutPeople(n: number): string {
  if (n < 100) return "fewer than 100";
  const digits = Math.floor(Math.log10(n)) - 1;
  const rounded = Math.round(n / 10 ** digits) * 10 ** digits;
  return `about ${rounded.toLocaleString("en-US")}`;
}

const ON_LAND: Partial<Record<ChangeType, string>> = {
  flood: "live on land where water appeared",
  storm: "live on land where crops and trees lost their echo after the wind",
  drought: "live on land that dried out",
  landslide: "live on slopes whose surface changed",
  wildfire: "live in or right next to the burned land",
  agriculture: "live among the fields that went under water",
};

export type Level = "alert" | "watch" | "normal";
export interface FieldWatch {
  level: Level;
  title: string;
  body: string;
}

/** What the radar series says for those who farm the area, or null where there are no fields. */
export function fieldWatchOf(detail: EventDetail): FieldWatch | null {
  const x = detail.extra;
  if (!x) return null;
  const km = (v: number) => `${formatValue(v)} km²`;
  if (x.kind === "change" && (x.cause === "wind" || x.cause === "heat")) {
    const o = x.orbits[0];
    return x.cause === "wind"
      ? {
          level: "alert",
          title: "Possible crop loss",
          body: `${km(o.peakDropKm2)} of crops and trees lost their echo after the wind of ${formatDate(x.eventDate)}, the most by ${formatDate(o.peakDropDate)}. Flattened plants send back less. Expect a smaller harvest there.`,
        }
      : {
          level: "alert",
          title: "Fields drying",
          body: `${km(o.peakDropKm2)} of land lost echo during the heat, the most by ${formatDate(o.peakDropDate)}. Dry soil and wilting crops send back less. Watch for a weaker harvest and thirsty livestock.`,
        };
  }
  if (x.kind !== "agriculture" || detail.type !== "agriculture") return null;
  const o = x.orbits[0];
  if (o.mode === "flood") {
    return {
      level: "watch",
      title: "Fields under water",
      body: `At the peak, on ${formatDate(o.peakDate)}, ${km(o.peakFloodKm2)} were under water, ${km(o.peakFloodedVegKm2)} of it with plants standing in it. Rice wants some water; weeks of deep water can drown it.`,
    };
  }
  if (x.activity === "harvest") {
    return {
      level: "normal",
      title: "Harvest under way",
      body: `${o.harvestedPct}% of the crops the satellite watched (${km(o.harvestedKm2)}) were cut by ${formatDate(o.dates[o.dates.length - 1])}; the busiest stretch ended on ${formatDate(o.peakIntervalEnd)}. This is the season's normal rhythm, not a loss.`,
    };
  }
  return {
    level: "watch",
    title: x.activity === "burning" ? "Fields cleared, likely by fire" : "Forest or plantation cleared",
    body:
      x.activity === "burning"
        ? `${km(o.harvestedKm2)} of fields lost their cover after the harvest. Burning the stubble is fast, but it fills the air with smoke and takes nutrients from the soil.`
        : `${km(o.harvestedKm2)} lost their tall cover. Land cleared of trees holds less water and soil, and stores less carbon.`,
  };
}

/** General safety guidance per kind of event. */
export const ACTIONS: Partial<Record<ChangeType, string[]>> = {
  flood: [
    "Know your way to higher ground before the rain; keep papers and medicine in a sealed bag.",
    "Never walk or drive through moving water: 30 cm can carry a car away.",
    "After the flood, boil or treat drinking water and avoid wading barefoot: floodwater spreads disease.",
  ],
  storm: [
    "Tie down roofs and loose objects before a storm is forecast.",
    "Keep away from fallen power lines and damaged trees.",
    "Photograph damaged fields with the date: it helps when asking for aid or insurance.",
  ],
  drought: [
    "Store water covered: open containers breed the mosquitoes that carry dengue.",
    "Work outdoors early or late and drink often; confusion and hot dry skin are signs of heat stroke.",
    "Do not burn fields or rubbish in dry, windy weather.",
  ],
  landslide: [
    "Watch for new cracks in walls or ground, tilting poles and trees, or springs turning muddy.",
    "Leave steep slopes and the foot of ravines during long, heavy rain.",
    "Avoid building on cut slopes or close to a ravine edge.",
  ],
  wildfire: [
    "Never burn fields or rubbish on dry, windy days.",
    "Keep a strip around the house clear of dry grass and branches.",
    "Report smoke early: a small fire is easy to stop.",
  ],
  earthquake: [
    "During the shaking: drop, cover under a sturdy table, and hold on.",
    "Agree on a meeting point with your family before it happens.",
    "Afterwards, expect aftershocks, check for gas leaks and stay out of cracked buildings.",
  ],
  agriculture: [
    "Share these maps with your cooperative or extension office to plan the next season.",
    "Keep a simple calendar of planting, harvest and losses for each field.",
  ],
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The people line of a case, or null when there is nobody to count. */
export function peopleLine(detail: EventDetail): string | null {
  const p = detail.people;
  if (!p || p.areaPeople < 1) return null;
  const exposed = p.exposedPeople;
  const verb = ON_LAND[detail.type];
  if (exposed !== undefined && exposed > 0 && verb) {
    return `${cap(aboutPeople(exposed))} people ${verb}, out of ${aboutPeople(p.areaPeople)} in the whole area we watched.`;
  }
  if (detail.type === "earthquake") return `${cap(aboutPeople(p.areaPeople))} people live in the area the radar watched move.`;
  if (detail.type === "glacier") return null;
  return `${cap(aboutPeople(p.areaPeople))} people live in the area we watched.`;
}

