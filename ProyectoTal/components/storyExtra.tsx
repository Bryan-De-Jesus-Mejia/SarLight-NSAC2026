import type { ReactNode } from "react";
import type { EventDetail, ExtraAnalysis } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";
import { globeApi } from "@/lib/globeApi";

/**
 * Story steps for the analyses that are not radar change maps (farming, ice,
 * ground movement). Same shape as the change-map story, built from the
 * measurements in `detail.extra`; no hand-written numbers.
 */

const WIDE = 0.42;
const MID = 0.034;

export interface ExtraStep {
  key: string;
  kicker: string;
  title: string;
  body: ReactNode;
  figure?: { value: string; unit: string; note: string };
  extra?: ReactNode;
  enter: () => void | (() => void);
}

const km = (v: number): string => formatValue(v);

function Picture({ src, size, alt }: { src: string; size: [number, number]; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size[0]}
      height={size[1]}
      alt={alt}
      loading="lazy"
      className="w-full rounded-lg border border-line bg-black/30"
    />
  );
}

export function buildExtraSteps(
  detail: EventDetail,
  extra: ExtraAnalysis,
  setDrape: (image: { url: string; opacity: number } | null) => void,
): ExtraStep[] {
  const fly = (altitude: number) => () => {
    setDrape(null);
    globeApi.current?.frameCase(altitude);
  };

  const place: ExtraStep = {
    key: "place",
    kicker: "The place",
    title: detail.name.replace(" analysis", ""),
    body: (
      <>
        <p>
          {detail.region}, {detail.country}.{" "}
          {extra.kind === "agriculture"
            ? "We followed this area pass after pass, to see when its fields change."
            : extra.kind === "glacier"
              ? "We measured how fast this ice moves by following its pattern from one pass to the next."
              : "We compared the radar phase of two passes to measure how far the ground moved."}
        </p>
        <p className="mt-3 text-muted">Scroll, or press Next, to follow what the radar saw.</p>
      </>
    ),
    enter: fly(WIDE),
  };

  const care = (text: string): ExtraStep => ({
    key: "care",
    kicker: "Read with care",
    title: "What this does not tell us",
    body: (
      <>
        <p>{text}</p>
        <p className="mt-3 text-muted">None of this has been verified on the ground.</p>
      </>
    ),
    enter: fly(MID),
  });

  if (extra.kind === "displacement") {
    const pair = extra.pairs[0];
    return [
      place,
      {
        key: "moved",
        kicker: `${formatDate(pair.ref)} → ${formatDate(pair.sec)}`,
        title: "How far the ground moved",
        figure: { value: String(pair.towardMaxCm), unit: "cm", note: "toward the satellite, at most" },
        body: (
          <p>
            Along the satellite&rsquo;s line of sight the ground moved up to {pair.towardMaxCm} cm toward it and{" "}
            {Math.abs(pair.awayMaxCm)} cm away from it, between two passes {pair.days} days apart.
          </p>
        ),
        extra: <Picture src={pair.images.displacement} size={pair.images.displacementSize} alt="Map of the ground movement" />,
        enter: fly(MID),
      },
      {
        key: "area",
        kicker: "How much ground",
        title: "Where it moved over 5 cm",
        figure: { value: km(pair.area5Km2), unit: "km²", note: `of ground moved more than 5 cm (${km(pair.area10Km2)} km² over 10 cm)` },
        body: (
          <p>
            The coloured fringes are the raw measurement: each full colour cycle is {pair.fringeCm} cm of movement.
            The more cycles packed together, the more the ground moved.
          </p>
        ),
        extra: <Picture src={pair.images.fringes} size={pair.images.fringesSize} alt="Interferogram fringes" />,
        enter: fly(MID),
      },
      care(
        pair.reliablePct < 30
          ? `Only ${pair.reliablePct}% of this picture could be measured reliably. Over water, steep or leafy ground the radar lost the thread, so this is a partial view.`
          : `${pair.reliablePct}% of this picture could be measured reliably. The rest, such as water or dense vegetation, is left blank.`,
      ),
    ];
  }

  if (extra.kind === "glacier") {
    const group = extra.groups[0];
    return [
      place,
      {
        key: "speed",
        kicker: "The speed",
        title: "How fast the ice moves",
        figure: { value: String(group.maxSpeedMDay), unit: "m/day", note: `fastest point · typical ${group.typicalSpeedMDay} m/day` },
        body: (
          <p>
            Following the surface pattern between passes, the fastest ice moved {group.maxSpeedMDay} m a day. Most of
            the area was far slower.
          </p>
        ),
        extra: <Picture src={group.map} size={group.mapSize} alt="Map of ice speed" />,
        enter: fly(MID),
      },
      {
        key: "fast",
        kicker: "How much ice",
        title: "The fast part",
        figure: { value: km(group.fastAreaKm2), unit: "km²", note: `moving faster than ${group.fastThresholdMs} m/day` },
        body: (
          <p>
            Across {extra.pairsAnalysed} pairs of passes, this is the area that moved faster than the threshold. It
            shows where the glacier flows quickest.
          </p>
        ),
        enter: fly(MID),
      },
      care(
        `The measurement noise is about ${group.noiseMDay} m/day, so very slow ice cannot be told apart from standing still.`,
      ),
    ];
  }

  const orbit = extra.orbits[0];
  const lead: ExtraStep =
    orbit.mode === "harvest"
      ? {
          key: "changed",
          kicker: "Along the season",
          title: "Fields that dropped",
          figure: { value: km(orbit.harvestedKm2), unit: "km²", note: `${orbit.harvestedPct}% of the ${km(orbit.vegetatedKm2)} km² of vegetation` },
          body: (
            <p>
              The echo of these fields fell between passes, which is what harvest, burning or clearing tends to
              look like. The biggest drop came in the interval ending {formatDate(orbit.peakIntervalEnd)}.
            </p>
          ),
          extra: <Picture src={orbit.map} size={orbit.mapSize} alt="Map of the fields that changed" />,
          enter: fly(MID),
        }
      : {
          key: "changed",
          kicker: `Peak · ${formatDate(orbit.peakDate)}`,
          title: "Land under water",
          figure: { value: km(orbit.peakFloodKm2), unit: "km²", note: `${km(orbit.peakNewWaterKm2)} km² new open water, ${km(orbit.peakFloodedVegKm2)} km² flooded vegetation` },
          body: (
            <p>
              Compared with the passes before, this much land turned to open water or to flooded vegetation at the
              peak of the season.
            </p>
          ),
          extra: <Picture src={orbit.map} size={orbit.mapSize} alt="Map of the flooded area" />,
          enter: fly(MID),
        };
  return [
    place,
    lead,
    care(
      "The radar sees the echo change, not the reason. What this place is doing, farming, burning or flooding, is our reading of the site.",
    ),
  ];
}
