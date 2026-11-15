"use client";

import type { ChangeType, EventDetail } from "@/data/types";
import { msg, t, useT } from "@/i18n/core";
import { rich } from "@/i18n/rich";
import { formatDate, formatNumber, formatValue } from "@/lib/format";

/**
 * "For people": who lives there, what it means for those who farm, and what
 * to do. People come from the GHSL population grid crossed with our own change
 * masks; the field watch reads the radar series; the advice is general safety
 * guidance for each kind of event. Nothing here replaces official alerts.
 */

/** Round a head count the way people say it. */
export function aboutPeople(n: number): string {
  if (n < 100) return t("fewer than 100");
  const digits = Math.floor(Math.log10(n)) - 1;
  const rounded = Math.round(n / 10 ** digits) * 10 ** digits;
  return t("about {n}", { n: formatNumber(rounded) });
}

const ON_LAND: Partial<Record<ChangeType, string>> = {
  flood: msg("live on land where water appeared"),
  storm: msg("live on land where crops and trees lost their echo after the wind"),
  drought: msg("live on land that dried out"),
  landslide: msg("live on slopes whose surface changed"),
  wildfire: msg("live in or right next to the burned land"),
  agriculture: msg("live among the fields that went under water"),
};

type Level = "alert" | "watch" | "normal";
interface FieldWatch {
  level: Level;
  title: string;
  body: string;
}

const LEVEL_STYLE: Record<Level, { label: string; color: string }> = {
  alert: { label: msg("Alert"), color: "#f87171" },
  watch: { label: msg("Watch"), color: "#fbbf24" },
  normal: { label: msg("Seasonal"), color: "#4ade80" },
};

/** What the radar series says for those who farm the area, or null where there are no fields. */
export function fieldWatchOf(detail: EventDetail): FieldWatch | null {
  const x = detail.extra;
  if (!x) return null;
  const km = (v: number) => `${formatValue(v)} km²`;
  if (x.kind === "change" && (x.cause === "wind" || x.cause === "heat" || x.cause === "drought")) {
    const o = x.orbits[0];
    const params = { area: km(o.peakDropKm2), event: formatDate(x.eventDate), peak: formatDate(o.peakDropDate) };
    return x.cause === "wind"
      ? {
          level: "alert",
          title: t("Possible crop loss"),
          body: t(
            "{area} of crops and trees lost their echo after the wind of {event}, the most by {peak}. Flattened plants send back less. Expect a smaller harvest there.",
            params,
          ),
        }
      : {
          level: "alert",
          title: t("Fields drying"),
          body:
            x.cause === "drought"
              ? t(
                  "{area} of land lost echo during the dry spell, the most by {peak}. Dry soil and wilting crops send back less. Watch for a weaker harvest and thirsty livestock.",
                  params,
                )
              : t(
                  "{area} of land lost echo during the heat, the most by {peak}. Dry soil and wilting crops send back less. Watch for a weaker harvest and thirsty livestock.",
                  params,
                ),
        };
  }
  if (x.kind !== "agriculture" || detail.type !== "agriculture") return null;
  const o = x.orbits[0];
  if (o.mode === "flood") {
    return {
      level: "watch",
      title: t("Fields under water"),
      body: t(
        "At the peak, on {date}, {total} were under water, {veg} of it with plants standing in it. Rice wants some water; weeks of deep water can drown it.",
        { date: formatDate(o.peakDate), total: km(o.peakFloodKm2), veg: km(o.peakFloodedVegKm2) },
      ),
    };
  }
  if (x.activity === "harvest") {
    return {
      level: "normal",
      title: t("Harvest under way"),
      body: t(
        "{pct}% of the crops the satellite watched ({area}) were cut by {last}; the busiest stretch ended on {peak}. This is the season's normal rhythm, not a loss.",
        { pct: o.harvestedPct, area: km(o.harvestedKm2), last: formatDate(o.dates[o.dates.length - 1]), peak: formatDate(o.peakIntervalEnd) },
      ),
    };
  }
  return {
    level: "watch",
    title: x.activity === "burning" ? t("Fields cleared, likely by fire") : t("Forest or plantation cleared"),
    body:
      x.activity === "burning"
        ? t(
            "{area} of fields lost their cover after the harvest. Burning the stubble is fast, but it fills the air with smoke and takes nutrients from the soil.",
            { area: km(o.harvestedKm2) },
          )
        : t("{area} lost their tall cover. Land cleared of trees holds less water and soil, and stores less carbon.", {
            area: km(o.harvestedKm2),
          }),
  };
}

/** General safety guidance per kind of event. */
export const ACTIONS: Partial<Record<ChangeType, string[]>> = {
  flood: [
    msg("Know your way to higher ground before the rain; keep papers and medicine in a sealed bag."),
    msg("Never walk or drive through moving water: 30 cm can carry a car away."),
    msg("After the flood, boil or treat drinking water and avoid wading barefoot: floodwater spreads disease."),
  ],
  storm: [
    msg("Tie down roofs and loose objects before a storm is forecast."),
    msg("Keep away from fallen power lines and damaged trees."),
    msg("Photograph damaged fields with the date: it helps when asking for aid or insurance."),
  ],
  drought: [
    msg("Store water covered: open containers breed the mosquitoes that carry dengue."),
    msg("Work outdoors early or late and drink often; confusion and hot dry skin are signs of heat stroke."),
    msg("Do not burn fields or rubbish in dry, windy weather."),
  ],
  landslide: [
    msg("Watch for new cracks in walls or ground, tilting poles and trees, or springs turning muddy."),
    msg("Leave steep slopes and the foot of ravines during long, heavy rain."),
    msg("Avoid building on cut slopes or close to a ravine edge."),
  ],
  wildfire: [
    msg("Never burn fields or rubbish on dry, windy days."),
    msg("Keep a strip around the house clear of dry grass and branches."),
    msg("Report smoke early: a small fire is easy to stop."),
  ],
  earthquake: [
    msg("During the shaking: drop, cover under a sturdy table, and hold on."),
    msg("Agree on a meeting point with your family before it happens."),
    msg("Afterwards, expect aftershocks, check for gas leaks and stay out of cracked buildings."),
  ],
  wetland: [
    msg("Use water sparingly when the reservoir runs low: fix leaks and water crops early or late."),
    msg("Store drinking water covered: open containers breed the mosquitoes that carry dengue."),
    msg("Follow the water and power authority's notices about rationing."),
  ],
  agriculture: [
    msg("Share these maps with your cooperative or extension office to plan the next season."),
    msg("Keep a simple calendar of planting, harvest and losses for each field."),
  ],
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{title}</p>
      <div className="mt-1.5 text-[13px] leading-relaxed text-ink/90">{children}</div>
    </div>
  );
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The people line of a case, or null when there is nobody to count. */
export function peopleLine(detail: EventDetail): string | null {
  const p = detail.people;
  if (!p || p.areaPeople < 1) return null;
  const exposed = p.exposedPeople;
  const verb = ON_LAND[detail.type];
  if (exposed !== undefined && exposed > 0 && verb) {
    return t("{count} people {verb}, out of {total} in the whole area we watched.", {
      count: cap(aboutPeople(exposed)),
      verb: t(verb),
      total: aboutPeople(p.areaPeople),
    });
  }
  if (detail.type === "earthquake") {
    return t("{count} people live in the area the radar watched move.", { count: cap(aboutPeople(p.areaPeople)) });
  }
  if (detail.type === "glacier") return null;
  return t("{count} people live in the area we watched.", { count: cap(aboutPeople(p.areaPeople)) });
}

export function Impact({ detail, compact = false }: { detail: EventDetail; compact?: boolean }) {
  const tr = useT();
  const people = peopleLine(detail);
  const field = fieldWatchOf(detail);
  const actions = ACTIONS[detail.type];
  const home = detail.country === "Dominican Republic";
  if (!people && !field && !actions) return null;

  const body = (
    <div className="space-y-3">
      {people && (
        <Section title={tr("Who lives there")}>
          <p>{people}</p>
          <p className="mt-1 text-[11px] text-muted">{tr("Estimate from the GHSL population grid (1 km squares, 2025), not a census.")}</p>
        </Section>
      )}
      {field && (
        <Section title={tr("For those who farm")}>
          <p className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#05070d]" style={{ background: LEVEL_STYLE[field.level].color }}>
              {tr(LEVEL_STYLE[field.level].label)}
            </span>
            <span className="font-medium text-ink">{field.title}</span>
          </p>
          <p className="mt-1">{field.body}</p>
        </Section>
      )}
      {actions && (
        <Section title={tr("What you can do")}>
          <ul className="list-disc space-y-1 pl-4 marker:text-muted">
            {actions.map((a) => (
              <li key={a}>{tr(a)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink">
            {home
              ? rich(tr("Emergency: <b>9-1-1</b>. Follow the alerts of the <b>COE</b> and <b>Defensa Civil</b>."), { b: (c) => <b>{c}</b> })
              : tr("In an emergency, call your local emergency number and follow your civil protection's alerts.")}
          </p>
        </Section>
      )}
    </div>
  );

  if (compact) return body;
  return (
    <section aria-label={tr("For people")} className="rounded-xl border border-line p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">{tr("For people")}</p>
      <div className="mt-3">{body}</div>
    </section>
  );
}
