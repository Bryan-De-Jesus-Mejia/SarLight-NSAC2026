"use client";

import type { ReactNode } from "react";
import { Drivers } from "@/components/panel/Drivers";
import { Impact } from "@/components/panel/Impact";
import type { EventDetail } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";
import { globeApi } from "@/lib/globeApi";

/**
 * Story steps for the analyses that are not change maps (floods and farming
 * over time, wind, heat, landslides, earthquakes, glaciers). Same promise as
 * the other stories: every figure is read from the analysis.
 */

export interface StoryStep {
  key: string;
  kicker: string;
  title: string;
  body: ReactNode;
  figure?: { value: string; unit: string; note: string };
  extra?: ReactNode;
  enter: () => void | (() => void);
}

const WIDE = 0.42;
const MID = 0.06;
const km = (v: number) => formatValue(v);

function Pictures({ items }: { items: Array<{ src: string; caption: string }> }) {
  return (
    <div className={`grid gap-2 ${items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {items.map((it) => (
        <figure key={it.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.src} alt={it.caption} className="w-full rounded-lg border border-line bg-black" loading="lazy" />
          <figcaption className="mt-1 font-mono text-[10px] text-muted">{it.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

const PEOPLE: Record<string, string> = {
  flood: "Behind every square kilometre of water there are streets, homes and fields. Knowing where the water went, even through storm clouds, is how help reaches the right door.",
  storm: "A flattened banana field is a family's income for the year. Mapping where the wind hit, field by field, tells farmers and insurers where to look first.",
  drought: "Dry land means smaller harvests and thirsty animals. Seeing drought spread week by week gives farmers and water managers time to act.",
  landslide: "A slope that moves can bury a road or a home. Watching the slopes after heavy rain helps decide where people should not stay.",
  earthquake: "Seeing exactly where the ground moved, and by how much, guides rescuers and engineers to the places that need them most.",
  glacier: "Ice that slides into the sea raises the ocean everywhere, including the Caribbean coast. Watching glaciers is watching our own shorelines.",
  agriculture: "Fields are food. Seeing when and where they change helps forecast harvests, and spot burning and clearing that harm air and forest.",
};

export function buildExtraSteps(detail: EventDetail, setDrape: (d: null) => void): StoryStep[] {
  const x = detail.extra;
  if (!x) return [];
  const place = `${detail.region}, ${detail.country}`;
  const look = (altitude: number) => () => {
    setDrape(null);
    globeApi.current?.frameCase(altitude);
  };
  const steps: StoryStep[] = [];

  const intro: Record<string, string> = {
    agriculture: "We followed these fields pass after pass, to see when they changed.",
    glacier: "We tracked the ice, pass after pass, to measure how fast it slides to the sea.",
    displacement: "We compared radar passes from before and after the shaking, to see how far the ground moved.",
    change: "We let the satellite learn what normal looks like here, then compared it with the passes after the event.",
  };
  steps.push({
    key: "place",
    kicker: "The place",
    title: detail.name,
    body: (
      <>
        <p>
          {place}. {detail.type === "flood" ? "We followed this area pass after pass, to see when water came and how far it spread." : intro[x.kind]}
        </p>
        <p className="mt-3 text-muted">Scroll, or press Next, to follow what the radar saw.</p>
      </>
    ),
    enter: look(WIDE),
  });

  if (x.kind === "agriculture" || x.kind === "change") {
    const o = x.orbits[0];
    const frames = o.frames;
    const first = frames[0];
    const last = frames[frames.length - 1];
    steps.push({
      key: "passes",
      kicker: "What the radar saw",
      title: `${o.dates.length} visits, one place`,
      body: (
        <p>
          Every 12 days NISAR came back. In false colour, standing plants look green, bare or dry ground looks purple
          and calm water looks black. Compare the first visit with the last.
        </p>
      ),
      extra: first && last ? <Pictures items={[{ src: first.src, caption: formatDate(first.date) }, { src: last.src, caption: formatDate(last.date) }]} /> : undefined,
      enter: look(MID),
    });
    const farm = x.kind === "agriculture" ? x.orbits[0] : null;
    const figure =
      x.kind === "change"
        ? { value: km(x.orbits[0].peakDropKm2), unit: "km²", note: `lost their echo by ${formatDate(x.orbits[0].peakDropDate)}` }
        : farm?.mode === "flood"
          ? { value: km(farm.peakFloodKm2), unit: "km²", note: `under water at the peak, ${formatDate(farm.peakDate)}` }
          : farm?.mode === "harvest"
            ? { value: km(farm.harvestedKm2), unit: "km²", note: `of fields changed (${farm.harvestedPct}% of the vegetation)` }
            : undefined;
    steps.push({
      key: "map",
      kicker: "The change",
      title: x.kind === "change" ? "Where the ground changed" : farm?.mode === "flood" ? "Where the water went" : "When each field changed",
      figure,
      body: <p>Each coloured patch is a piece of land whose radar echo changed enough to count, compared with the visits before.</p>,
      extra: <Pictures items={[{ src: o.map, caption: "Map from our analysis" }]} />,
      enter: look(MID),
    });
  } else if (x.kind === "displacement") {
    const p = x.pairs[0];
    steps.push({
      key: "fringes",
      kicker: "Rainbow rings",
      title: "Each ring is 12 centimetres",
      body: (
        <p>
          The radar wave is about {Math.round(p.wavelengthCm)} cm long. Comparing it before and after the earthquake
          draws rings of colour: every full cycle means the ground moved about {Math.round(p.fringeCm)} cm closer to or
          further from the satellite.
        </p>
      ),
      extra: <Pictures items={[{ src: p.images.fringes, caption: `${formatDate(p.ref)} → ${formatDate(p.sec)}` }]} />,
      enter: look(0.3),
    });
    steps.push({
      key: "moved",
      kicker: "How far it moved",
      title: "The ground rose and sank",
      figure: { value: `${Math.round(p.towardMaxCm)}`, unit: "cm", note: `toward the satellite at most · ${km(p.area5Km2)} km² moved more than 5 cm` },
      body: <p>Red moved toward the satellite, blue away from it. Blank areas could not be measured, often because they are water or dense forest.</p>,
      extra: <Pictures items={[{ src: p.images.displacement, caption: "Ground movement from our analysis" }]} />,
      enter: look(0.3),
    });
  } else if (x.kind === "glacier") {
    const g = x.groups[0];
    steps.push({
      key: "speed",
      kicker: "A river of ice",
      title: "How fast the ice slides",
      figure: { value: `${x.maxSpeedMDay}`, unit: "m/day", note: `fastest measured · typical ${g.typicalSpeedMDay} m/day` },
      body: <p>The radar recognises the same cracks and textures on the ice in two visits and measures how far they travelled, even in the months of polar night.</p>,
      extra: <Pictures items={[{ src: g.map, caption: "Ice speed from our analysis" }]} />,
      enter: look(0.3),
    });
  }

  steps.push({
    key: "why",
    kicker: "Why it happened",
    title: "From the sky to the ground",
    body: <Drivers detail={detail} compact />,
    enter: look(MID),
  });

  steps.push({
    key: "people",
    kicker: "Why it matters",
    title: "What this means for people",
    body: (
      <>
        <p>{PEOPLE[x.kind === "displacement" ? detail.type : x.kind === "change" ? detail.type : x.kind === "agriculture" && detail.type === "flood" ? "flood" : x.kind]}</p>
        <div className="mt-4">
          <Impact detail={detail} compact />
        </div>
        <p className="mt-3 text-muted">This is a reading of real radar images. Nobody has checked it on the ground yet.</p>
      </>
    ),
    enter: look(WIDE),
  });
  return steps;
}
