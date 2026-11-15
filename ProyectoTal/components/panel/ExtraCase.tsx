"use client";

import { useState, type ReactNode } from "react";
import { SeriesChart } from "@/components/panel/SeriesChart";
import { Drivers } from "@/components/panel/Drivers";
import type {
  ChangeExtra,
  ChangeOrbit,
  DisplacementExtra,
  DisplacementPair,
  FarmExtra,
  FarmOrbit,
  FramePoint,
  GlacierExtra,
  IceGroup,
} from "@/data/extraTypes";
import type { EventDetail } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

/**
 * The case panel for the analyses that are not radar change maps: farming, ice
 * flow and ground movement. The same measured numbers appear in both views;
 * the simple view says them in plain words, the technical one adds the method.
 */

const km = formatValue;
const COLORS = { main: "#a3e635", second: "#7dd3fc", warm: "#fb923c", water: "#60a5fa", veg: "#2dd4bf" };

function Title({ children }: { children: ReactNode }) {
  return <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</h3>;
}

function Stat({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-medium leading-tight text-ink">{children}</dd>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-muted">{note}</p>}
    </div>
  );
}

const Unit = ({ children }: { children: ReactNode }) => <span className="text-sm font-normal text-muted">{children}</span>;

function Switcher<T extends { key: string }>({
  items,
  value,
  label,
  onPick,
  text,
}: {
  items: T[];
  value: string;
  label: string;
  onPick: (key: string) => void;
  text: (item: T) => string;
}) {
  if (items.length < 2) return null;
  return (
    <div className="ge-scroll flex gap-1 overflow-x-auto" role="group" aria-label={label}>
      {items.map((item) => (
        <button key={item.key} type="button" aria-pressed={item.key === value} onClick={() => onPick(item.key)} className="ge-chip shrink-0">
          {text(item)}
        </button>
      ))}
    </div>
  );
}

/** A picture drawn by the pipeline, on white because its axes and colour bar are dark on light. */
function Figure({ src, size, alt, caption }: { src: string; size: [number, number]; alt: string; caption: ReactNode }) {
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={size[0]}
        height={size[1]}
        loading="lazy"
        className="w-full rounded-xl border border-line bg-white"
        style={{ aspectRatio: `${size[0]} / ${size[1]}` }}
      />
      <figcaption className="mt-1.5 text-xs leading-snug text-muted">{caption}</figcaption>
    </figure>
  );
}

/** One false-colour image per pass, with the dates to flip through. */
function Passes({ frames, caption }: { frames: FramePoint[]; caption: ReactNode }) {
  const [picked, setPicked] = useState(frames.length - 1);
  if (frames.length === 0) return null;
  const frame = frames[Math.min(picked, frames.length - 1)];
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frame.src} alt={`Radar image of ${formatDate(frame.date)}`} loading="lazy" className="w-full rounded-xl border border-line bg-black" />
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Pass date">
        {frames.map((f, i) => (
          <button key={f.date} type="button" aria-pressed={i === picked} onClick={() => setPicked(i)} className="ge-chip">
            {formatDate(f.date)}
          </button>
        ))}
      </div>
      <figcaption className="mt-1.5 text-xs leading-snug text-muted">{caption}</figcaption>
    </figure>
  );
}

function Tabs({ tabs }: { tabs: Array<{ key: string; label: string; body: ReactNode }> }) {
  const [active, setActive] = useState(tabs[0].key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="space-y-2.5">
      <div className="ge-segments" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.key === current.key} onClick={() => setActive(t.key)} className="ge-segment">
            {t.label}
          </button>
        ))}
      </div>
      {current.body}
    </div>
  );
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <details className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs text-muted">
      <summary className="cursor-pointer select-none rounded font-mono text-[11px] uppercase tracking-[0.18em] hover:text-ink">How this was measured</summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="text-ink/85">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const doyToIso = (doy: number, year: string): string =>
  new Date(Date.UTC(Number(year), 0, 1) + (doy - 1) * 86_400_000).toISOString().slice(0, 10);

/* -------------------------------- farming -------------------------------- */

const SETTING_NOTE: Record<NonNullable<FarmExtra["setting"]>, string> = {
  river: "This is the riverside, where homes sit close to the water.",
  town: "This is a dense neighbourhood: even a small flooded area here means streets and homes under water.",
  coast: "Here the river meets the sea, among towns, cane fields and roads.",
  valley: "In a mountain valley, water gathers fast in the low land along the river.",
};

const ACTIVITY_WORD: Record<FarmExtra["activity"], string> = {
  harvest: "looks harvested",
  flood: "flooded",
  burning: "looks burned or cleared",
  clearing: "looks cleared of trees or crops",
};

function FarmView({ extra, technical }: { extra: FarmExtra; technical: boolean }) {
  const [picked, setPicked] = useState(extra.orbits[0].key);
  const orbit: FarmOrbit = extra.orbits.find((o) => o.key === picked) ?? extra.orbits[0];
  const first = orbit.dates[0];
  const last = orbit.dates[orbit.dates.length - 1];

  const summary =
    orbit.mode === "harvest"
      ? `${km(orbit.harvestedKm2)} km² of land (${orbit.harvestedPct}% of the vegetation the satellite watched) ${ACTIVITY_WORD[extra.activity]}: its radar echo dropped between ${formatDate(first)} and ${formatDate(last)}. The busiest stretch ended on ${formatDate(orbit.peakIntervalEnd)}, when ${km(orbit.peakIntervalDropKm2)} km² changed in one step.`
      : `At its peak, on ${formatDate(orbit.peakDate)}, about ${km(orbit.peakFloodKm2)} km² were under water: ${km(orbit.peakNewWaterKm2)} km² of new open water and ${km(orbit.peakFloodedVegKm2)} km² of flooded vegetation, compared with the weeks before.${extra.setting ? ` ${SETTING_NOTE[extra.setting]}` : " In rice country fields are also flooded on purpose, so not all of it is a disaster."}`;

  const stats =
    orbit.mode === "harvest" ? (
      <>
        <Stat label="Land that changed" note={`${orbit.harvestedPct}% of the vegetated land`}>
          {km(orbit.harvestedKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="Busiest stretch" note={`${km(orbit.peakIntervalDropKm2)} km² in 12 days`}>
          <span className="text-sm">until {formatDate(orbit.peakIntervalEnd)}</span>
        </Stat>
        <Stat label="Half had changed by" note="median date of the change">
          <span className="text-sm">{formatDate(doyToIso(orbit.medianHarvestDoy, first.slice(0, 4)))}</span>
        </Stat>
        <Stat label="Passes used" note={`${formatDate(first)} – ${formatDate(last)}`}>
          {orbit.dates.length}
        </Stat>
      </>
    ) : (
      <>
        <Stat label="Flooded at peak" note={formatDate(orbit.peakDate)}>
          {km(orbit.peakFloodKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="New open water" note="was dry in the baseline">
          {km(orbit.peakNewWaterKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="Flooded vegetation" note="water under crops or trees">
          {km(orbit.peakFloodedVegKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="Always water" note="rivers and ponds, left out">
          {km(orbit.permanentWaterKm2)} <Unit>km²</Unit>
        </Stat>
      </>
    );

  const chart =
    orbit.mode === "harvest" ? (
      <div className="space-y-4">
        <div>
          <Title>Land that has changed, pass by pass</Title>
          <div className="mt-2">
            <SeriesChart
              unit="km², running total"
              zero
              decimals={0}
              series={[{ name: "Changed so far", color: COLORS.main, points: orbit.series.map((p) => ({ x: p.date, y: p.cumulativeKm2 })) }]}
            />
          </div>
        </div>
        {technical && (
          <div>
            <Title>Median echo of the whole area</Title>
            <div className="mt-2">
              <SeriesChart
                unit="dB"
                series={[
                  { name: `${orbit.coPol} (co-pol)`, color: COLORS.second, points: orbit.series.map((p) => ({ x: p.date, y: p.coDb })) },
                  { name: `${orbit.crossPol} (cross-pol)`, color: COLORS.warm, points: orbit.series.map((p) => ({ x: p.date, y: p.crossDb })) },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    ) : (
      <div>
        <Title>Water by pass</Title>
        <div className="mt-2">
          <SeriesChart
            unit="km²"
            zero
            decimals={0}
            series={[
              { name: "New open water", color: COLORS.water, points: orbit.series.map((p) => ({ x: p.date, y: p.newWaterKm2, hollow: p.baseline })) },
              { name: "Flooded vegetation", color: COLORS.veg, points: orbit.series.map((p) => ({ x: p.date, y: p.floodedVegKm2, hollow: p.baseline })) },
            ]}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">Empty rings are the baseline passes the others are compared with.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">{summary}</p>

      {technical && (
        <Switcher items={extra.orbits} value={orbit.key} label="Satellite track" onPick={setPicked} text={(o) => o.label} />
      )}

      <dl className="grid grid-cols-2 gap-2.5">{stats}</dl>

      <Tabs
        key={orbit.key}
        tabs={[
          {
            key: "map",
            label: orbit.mode === "harvest" ? "Map of change dates" : "Map of the flooding",
            body: (
              <Figure
                src={orbit.map}
                size={orbit.mapSize}
                alt={orbit.mode === "harvest" ? "Map of when each patch of land changed" : "Map of new water and flooded vegetation"}
                caption={
                  orbit.mode === "harvest"
                    ? "Each patch is coloured by the date its echo dropped (see the bar). Blank land did not change."
                    : "Blue is new open water, green is flooded vegetation, on a grey radar image of the dry season."
                }
              />
            ),
          },
          {
            key: "passes",
            label: "Each pass",
            body: <Passes frames={orbit.frames} caption="False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Vegetation tends to look green; bare or wet ground looks darker." />,
          },
        ]}
      />

      {chart}

      <p className="text-xs leading-relaxed text-muted">
        The radar sees the echo weaken or strengthen. That this was {extra.activity === "flood" ? "flooding" : extra.activity === "harvest" ? "harvest" : extra.activity} is our reading of the place, not something the radar tells apart.
      </p>

      {technical && (
        <Facts
          rows={[
            ["Satellite", `NISAR, ${orbit.label}`],
            ["Polarisations", `${orbit.coPol} and ${orbit.crossPol}`],
            ["Threshold", orbit.thresholdDb === null ? "—" : `${orbit.thresholdDb} dB`],
            ["Vegetation above", orbit.vegMinDb === null ? "—" : `${orbit.vegMinDb} dB`],
            ["Water below", orbit.waterMaxDb === null ? "—" : `${orbit.waterMaxDb} dB`],
            ["Median filter", orbit.medianFilterPx === null ? "—" : `${orbit.medianFilterPx} px`],
            ["Pixel", `${orbit.pixelM} m · ${orbit.crs}`],
            ...(orbit.mode === "harvest"
              ? ([["Mean largest drop", `${orbit.meanMaxDropDb} dB`]] as Array<[string, ReactNode]>)
              : ([["Baseline passes", orbit.baselineDates.map((d) => formatDate(d)).join(", ")]] as Array<[string, ReactNode]>)),
          ]}
        />
      )}
    </div>
  );
}

/* -------------------------------- glaciers -------------------------------- */

function GlacierView({ extra, technical }: { extra: GlacierExtra; technical: boolean }) {
  const [picked, setPicked] = useState(extra.groups[0].key);
  const group: IceGroup = extra.groups.find((g) => g.key === picked) ?? extra.groups[0];
  const days = group.series[0]?.days ?? 12;
  const first = group.series[0].ref;
  const last = group.series[group.series.length - 1].sec;

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">
        The ice here moves up to {group.maxSpeedMDay} m a day at its fastest, about {km(group.maxSpeedMDay * days)} m between two passes {days} days apart. Roughly {km(group.fastAreaKm2)} km² of it moves faster than {group.fastThresholdMs} m a day. The speed comes from tracking how the radar speckle pattern slides from one pass to the next.
      </p>

      {technical && <Switcher items={extra.groups} value={group.key} label="Satellite track" onPick={setPicked} text={(g) => g.label} />}

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Fastest ice" note="top speed in the scene">
          {group.maxSpeedMDay} <Unit>m/day</Unit>
        </Stat>
        <Stat label="Typical" note="half the scene is slower">
          {group.typicalSpeedMDay} <Unit>m/day</Unit>
        </Stat>
        <Stat label={`Faster than ${group.fastThresholdMs} m/day`} note="average over the pairs">
          {km(group.fastAreaKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="Passes compared" note={`${formatDate(first)} – ${formatDate(last)}`}>
          {group.series.length} <Unit>pairs</Unit>
        </Stat>
      </dl>

      <Tabs
        key={group.key}
        tabs={[
          {
            key: "map",
            label: "Speed map",
            body: (
              <Figure
                src={group.map}
                size={group.mapSize}
                alt="Map of the ice speed"
                caption="Median speed over all the pairs, in metres a day, on a logarithmic scale: dark blue is nearly still, red is fastest. Dark patches are ground the method could not read."
              />
            ),
          },
          { key: "passes", label: "Each pass", body: <Passes frames={group.frames} caption="False colour of single passes: red and blue carry the co-polarised echo, green the cross-polarised one." /> },
        ]}
      />

      <div>
        <Title>Speed over time</Title>
        <div className="mt-2">
          <SeriesChart
            unit="m per day"
            series={[
              { name: "Fast edge (95th percentile)", color: COLORS.warm, points: group.series.map((p) => ({ x: p.date, y: p.p95 })) },
              { name: `Median of ice > ${group.fastThresholdMs} m/day`, color: COLORS.second, points: group.series.map((p) => ({ x: p.date, y: p.fastMedian })) },
            ]}
          />
        </div>
      </div>

      {technical && (
        <Facts
          rows={[
            ["Satellite", `NISAR, ${group.label}`],
            ["Method", extra.method],
            ["Assumed incidence", `${group.incidenceDeg}°`],
            ["Noise on still ground", `${group.noiseMDay} m/day`],
            ["Pixel", `${group.pixelM} m · ${group.crs}`],
            ["Fastest pair", extra.maxSpeedPair],
          ]}
        />
      )}
    </div>
  );
}

/* --------------------------- earthquakes, landslides ----------------------- */

function DisplacementView({ detail, extra, technical }: { detail: EventDetail; extra: DisplacementExtra; technical: boolean }) {
  const [picked, setPicked] = useState(extra.pairs[0].key);
  const pair: DisplacementPair = extra.pairs.find((p) => p.key === picked) ?? extra.pairs[0];
  const slide = detail.type === "landslide";

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">
        Between {formatDate(pair.ref)} and {formatDate(pair.sec)}, the ground moved up to {pair.towardMaxCm} cm toward the satellite and {Math.abs(pair.awayMaxCm)} cm away from it, along the satellite&rsquo;s line of sight. About {km(pair.area5Km2)} km² moved more than 5 cm.{" "}
        {pair.reliablePct < 30
          ? `Only ${pair.reliablePct}% of this picture could be measured reliably: over water, steep or leafy ground the radar lost the thread, so read it as a partial view.`
          : `${pair.reliablePct}% of this picture could be measured reliably.`}
      </p>

      {technical && (
        <Switcher items={extra.pairs} value={pair.key} label="Pair of passes" onPick={setPicked} text={(p) => `${p.label.split(" · ")[0]} · ${p.direction === "ascending" ? "asc" : "desc"}`} />
      )}

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Toward the satellite" note="up and/or toward it">
          {pair.towardMaxCm} <Unit>cm</Unit>
        </Stat>
        <Stat label="Away from it" note="down and/or away">
          {Math.abs(pair.awayMaxCm)} <Unit>cm</Unit>
        </Stat>
        <Stat label="Moved over 5 cm" note={`${km(pair.area10Km2)} km² over 10 cm`}>
          {km(pair.area5Km2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={slide ? "Collapse on" : "Event on"} note={`${pair.days} days between the passes`}>
          <span className="text-sm">{formatDate(extra.eventDate)}</span>
        </Stat>
      </dl>

      <Tabs
        key={pair.key}
        tabs={[
          {
            key: "move",
            label: "Ground movement",
            body: (
              <Figure
                src={pair.images.displacement}
                size={pair.images.displacementSize}
                alt="Map of the ground movement in centimetres"
                caption="Red: the ground moved toward the satellite. Blue: away from it. Blank areas could not be measured. Axes are kilometres on the ground."
              />
            ),
          },
          {
            key: "fringes",
            label: "Fringes",
            body: (
              <Figure
                src={pair.images.fringes}
                size={pair.images.fringesSize}
                alt="Interferogram fringes"
                caption={`Each full colour cycle is ${pair.fringeCm} cm of movement along the line of sight. The more cycles close together, the more the ground moved.`}
              />
            ),
          },
        ]}
      />

      {technical && (
        <Facts
          rows={[
            ["Satellite", `NISAR, ${pair.label}`],
            ["Pair", `${formatDate(pair.ref)} → ${formatDate(pair.sec)} (${pair.days} days), ${pair.pol}`],
            ["Wavelength", `${pair.wavelengthCm} cm`],
            ["Coverage of the area", `${pair.coveragePct}%`],
            ["Reliable pixels", `${pair.reliablePct}%`],
            ["Median coherence", pair.coherence],
            ["Lost coherence", `${km(pair.decorrelatedKm2)} km²`],
            ["Moved over 20 cm", `${km(pair.area20Km2)} km²`],
            ["Ionosphere removed", pair.ionosphereRemoved ? "yes" : "no"],
            ["Pixel", `${pair.pixelM} m`],
          ]}
        />
      )}
    </div>
  );
}

/** Entry point: picks the view that matches the kind of analysis. */

/* ------------------------- dated events (change mode) -------------------- */

const CAUSE_WORD: Record<ChangeExtra["cause"], { event: string; weaker: string }> = {
  wind: { event: "the windstorm", weaker: "standing crops and trees that lost their echo, as if knocked down" },
  heat: { event: "the start of the heat wave", weaker: "land whose echo weakened, as soil and plants dried" },
  landslide: { event: "the date of the landslide reports", weaker: "slopes whose echo changed, where ground may have moved" },
};

function ChangeView({ extra, technical }: { extra: ChangeExtra; technical: boolean }) {
  const [picked, setPicked] = useState(extra.orbits[0].key);
  const orbit: ChangeOrbit = extra.orbits.find((o) => o.key === picked) ?? extra.orbits[0];
  const words = CAUSE_WORD[extra.cause];
  const summary = `Before ${formatDate(extra.eventDate)}, ${words.event}, the satellite passed ${orbit.baselineDates.length} times to learn what normal looks like here. On ${formatDate(orbit.peakDropDate)}, ${km(orbit.peakDropKm2)} km² were ${words.weaker}. ${km(orbit.lastRiseKm2)} km² became brighter, which can be regrowth, wetter soil or debris.`;

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">{summary}</p>
      {technical && (
        <Switcher items={extra.orbits} value={orbit.key} label="Satellite track" onPick={setPicked} text={(o) => o.label} />
      )}
      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Weaker echo" note={`on ${formatDate(orbit.peakDropDate)}`}>
          {km(orbit.peakDropKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="Stronger echo" note={`on ${formatDate(orbit.lastDate)}`}>
          {km(orbit.lastRiseKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label="First look after" note={`${km(orbit.firstPostDropKm2)} km² weaker`}>
          <span className="text-sm">{formatDate(orbit.firstPostDate)}</span>
        </Stat>
        <Stat label="Event" note={`${orbit.baselineDates.length} passes before it`}>
          <span className="text-sm">{formatDate(extra.eventDate)}</span>
        </Stat>
      </dl>
      <Tabs
        key={orbit.key}
        tabs={[
          {
            key: "map",
            label: "Map of the change",
            body: (
              <Figure
                src={orbit.map}
                size={orbit.mapSize}
                alt="Map of where the radar echo changed after the event"
                caption="Where the echo got weaker or stronger after the event, compared with the passes before it."
              />
            ),
          },
          {
            key: "passes",
            label: "Each pass",
            body: <Passes frames={orbit.frames} caption="False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Standing vegetation tends to look green." />,
          },
        ]}
      />
      <div>
        <Title>Land that changed, pass by pass</Title>
        <div className="mt-2">
          <SeriesChart
            unit="km²"
            zero
            decimals={1}
            series={[
              { name: "Weaker echo", color: COLORS.warm, points: orbit.series.map((p) => ({ x: p.date, y: p.dropKm2, hollow: p.baseline })) },
              { name: "Stronger echo", color: COLORS.second, points: orbit.series.map((p) => ({ x: p.date, y: p.riseKm2, hollow: p.baseline })) },
            ]}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">Empty rings are the passes before the event, which set what is normal.</p>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        The date of the event was set by our team from public reports. The radar sees the echo change; linking it to {words.event} is our reading.
      </p>
      {technical && (
        <Facts
          rows={[
            ["Satellite", `NISAR, ${orbit.label}`],
            ["Polarisations", `${orbit.coPol} and ${orbit.crossPol}`],
            ["Threshold", orbit.thresholdDb === null ? "—" : `${orbit.thresholdDb} dB`],
            ["Median filter", orbit.medianFilterPx === null ? "—" : `${orbit.medianFilterPx} px`],
            ["Pixel", `${orbit.pixelM} m · ${orbit.crs}`],
            ["Baseline passes", orbit.baselineDates.map((d) => formatDate(d)).join(", ")],
          ]}
        />
      )}
    </div>
  );
}

export function ExtraBody({ detail }: { detail: EventDetail }) {
  const technical = useAppStore((s) => s.audience === "technical");
  const extra = detail.extra;
  if (!extra) return null;
  const body =
    extra.kind === "agriculture" ? (
      <FarmView extra={extra} technical={technical} />
    ) : extra.kind === "glacier" ? (
      <GlacierView extra={extra} technical={technical} />
    ) : extra.kind === "change" ? (
      <ChangeView extra={extra} technical={technical} />
    ) : (
      <DisplacementView detail={detail} extra={extra} technical={technical} />
    );
  return (
    <div className="space-y-7">
      {body}
      <div className="rounded-2xl border border-line bg-white/[0.03] p-4">
        <Drivers detail={detail} />
      </div>
    </div>
  );
}
