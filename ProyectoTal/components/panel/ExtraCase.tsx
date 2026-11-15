"use client";

import { useState, type ReactNode } from "react";
import { SeriesChart } from "@/components/panel/SeriesChart";
import { Drivers } from "@/components/panel/Drivers";
import { Impact } from "@/components/panel/Impact";
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
import { getLang, msg, useT, type TFunction } from "@/i18n/core";
import { formatDate, formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

/**
 * The case panel for the analyses that are not radar change maps: farming, ice
 * flow and ground movement. The same measured numbers appear in both views;
 * the simple view says them in plain words, the technical one adds the method.
 */

const km = formatValue;
const COLORS = { main: "#a3e635", second: "#7dd3fc", warm: "#fb923c", water: "#60a5fa", veg: "#2dd4bf" };

/** "Track 54 · frame 83 · descending", in the language on screen. */
function trackLabel(t: TFunction, label: string): string {
  const match = /^Track (\d+) · frame (\d+) · (ascending|descending)$/.exec(label);
  if (!match) return label;
  return t("Track {track} · frame {frame} · {direction}", {
    track: match[1],
    frame: match[2],
    direction: t(match[3]),
  });
}

/** The glacier method text is written in Spanish in the data; show it in the language on screen. */
function methodText(text: string): string {
  if (getLang() === "es") return text;
  return text
    .replace("offsets de píxeles NISAR GUNW", "NISAR GUNW pixel offsets")
    .replace("rampa robusta restada", "robust ramp subtracted")
    .replace("incidencia supuesta", "assumed incidence")
    .replace("flujo horizontal", "horizontal flow");
}

// Marked here so the extraction check sees the direction words used above.
const DIRECTIONS = [msg("ascending"), msg("descending")];
void DIRECTIONS;

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
  const t = useT();
  const [picked, setPicked] = useState(frames.length - 1);
  if (frames.length === 0) return null;
  const frame = frames[Math.min(picked, frames.length - 1)];
  return (
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frame.src} alt={t("Radar image of {date}", { date: formatDate(frame.date) })} loading="lazy" className="w-full rounded-xl border border-line bg-black" />
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={t("Pass date")}>
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
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];
  return (
    <div className="space-y-2.5">
      <div className="ge-segments" role="tablist">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" role="tab" aria-selected={tab.key === current.key} onClick={() => setActive(tab.key)} className="ge-segment">
            {tab.label}
          </button>
        ))}
      </div>
      {current.body}
    </div>
  );
}

function Facts({ rows }: { rows: Array<[string, ReactNode]> }) {
  const t = useT();
  return (
    <details className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-xs text-muted">
      <summary className="cursor-pointer select-none rounded font-mono text-[11px] uppercase tracking-[0.18em] hover:text-ink">{t("How this was measured")}</summary>
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
  river: msg("This is the riverside, where homes sit close to the water."),
  town: msg("This is a dense neighbourhood: even a small flooded area here means streets and homes under water."),
  coast: msg("Here the river meets the sea, among towns, cane fields and roads."),
  valley: msg("In a mountain valley, water gathers fast in the low land along the river."),
};

const ACTIVITY_WORD: Record<FarmExtra["activity"], string> = {
  harvest: msg("looks harvested"),
  flood: msg("flooded"),
  burning: msg("looks burned or cleared"),
  clearing: msg("looks cleared of trees or crops"),
};

const ACTIVITY_NOUN: Record<FarmExtra["activity"], string> = {
  harvest: msg("harvest"),
  flood: msg("flooding"),
  burning: msg("burning"),
  clearing: msg("clearing"),
};

function FarmView({ extra, technical }: { extra: FarmExtra; technical: boolean }) {
  const t = useT();
  const [picked, setPicked] = useState(extra.orbits[0].key);
  const orbit: FarmOrbit = extra.orbits.find((o) => o.key === picked) ?? extra.orbits[0];
  const first = orbit.dates[0];
  const last = orbit.dates[orbit.dates.length - 1];

  const summary =
    orbit.mode === "harvest"
      ? t(
          "{area} km² of land ({pct}% of the vegetation the satellite watched) {activity}: its radar echo dropped between {d1} and {d2}. The busiest stretch ended on {peak}, when {drop} km² changed in one step.",
          {
            area: km(orbit.harvestedKm2),
            pct: orbit.harvestedPct,
            activity: t(ACTIVITY_WORD[extra.activity]),
            d1: formatDate(first),
            d2: formatDate(last),
            peak: formatDate(orbit.peakIntervalEnd),
            drop: km(orbit.peakIntervalDropKm2),
          },
        )
      : t(
          "At its peak, on {date}, about {total} km² were under water: {fresh} km² of new open water and {veg} km² of flooded vegetation, compared with the weeks before. {note}",
          {
            date: formatDate(orbit.peakDate),
            total: km(orbit.peakFloodKm2),
            fresh: km(orbit.peakNewWaterKm2),
            veg: km(orbit.peakFloodedVegKm2),
            note: extra.setting
              ? t(SETTING_NOTE[extra.setting])
              : t("In rice country fields are also flooded on purpose, so not all of it is a disaster."),
          },
        );

  const stats =
    orbit.mode === "harvest" ? (
      <>
        <Stat label={t("Land that changed")} note={t("{pct}% of the vegetated land", { pct: orbit.harvestedPct })}>
          {km(orbit.harvestedKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("Busiest stretch")} note={t("{area} km² in 12 days", { area: km(orbit.peakIntervalDropKm2) })}>
          <span className="text-sm">{t("until {date}", { date: formatDate(orbit.peakIntervalEnd) })}</span>
        </Stat>
        <Stat label={t("Half had changed by")} note={t("median date of the change")}>
          <span className="text-sm">{formatDate(doyToIso(orbit.medianHarvestDoy, first.slice(0, 4)))}</span>
        </Stat>
        <Stat label={t("Passes used")} note={`${formatDate(first)} – ${formatDate(last)}`}>
          {orbit.dates.length}
        </Stat>
      </>
    ) : (
      <>
        <Stat label={t("Flooded at peak")} note={formatDate(orbit.peakDate)}>
          {km(orbit.peakFloodKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("New open water")} note={t("was dry in the baseline")}>
          {km(orbit.peakNewWaterKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("Flooded vegetation")} note={t("water under crops or trees")}>
          {km(orbit.peakFloodedVegKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("Always water")} note={t("rivers and ponds, left out")}>
          {km(orbit.permanentWaterKm2)} <Unit>km²</Unit>
        </Stat>
      </>
    );

  const chart =
    orbit.mode === "harvest" ? (
      <div className="space-y-4">
        <div>
          <Title>{t("Land that has changed, pass by pass")}</Title>
          <div className="mt-2">
            <SeriesChart
              unit={t("km², running total")}
              zero
              decimals={0}
              series={[{ name: t("Changed so far"), color: COLORS.main, points: orbit.series.map((p) => ({ x: p.date, y: p.cumulativeKm2 })) }]}
            />
          </div>
        </div>
        {technical && (
          <div>
            <Title>{t("Median echo of the whole area")}</Title>
            <div className="mt-2">
              <SeriesChart
                unit="dB"
                series={[
                  { name: `${orbit.coPol} (${t("co-pol")})`, color: COLORS.second, points: orbit.series.map((p) => ({ x: p.date, y: p.coDb })) },
                  { name: `${orbit.crossPol} (${t("cross-pol")})`, color: COLORS.warm, points: orbit.series.map((p) => ({ x: p.date, y: p.crossDb })) },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    ) : (
      <div>
        <Title>{t("Water by pass")}</Title>
        <div className="mt-2">
          <SeriesChart
            unit="km²"
            zero
            decimals={0}
            series={[
              { name: t("New open water"), color: COLORS.water, points: orbit.series.map((p) => ({ x: p.date, y: p.newWaterKm2, hollow: p.baseline })) },
              { name: t("Flooded vegetation"), color: COLORS.veg, points: orbit.series.map((p) => ({ x: p.date, y: p.floodedVegKm2, hollow: p.baseline })) },
            ]}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">{t("Empty rings are the baseline passes the others are compared with.")}</p>
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">{summary}</p>

      {technical && (
        <Switcher items={extra.orbits} value={orbit.key} label={t("Satellite track")} onPick={setPicked} text={(o) => trackLabel(t, o.label)} />
      )}

      <dl className="grid grid-cols-2 gap-2.5">{stats}</dl>

      <Tabs
        key={orbit.key}
        tabs={[
          {
            key: "map",
            label: orbit.mode === "harvest" ? t("Map of change dates") : t("Map of the flooding"),
            body: (
              <Figure
                src={orbit.map}
                size={orbit.mapSize}
                alt={orbit.mode === "harvest" ? t("Map of when each patch of land changed") : t("Map of new water and flooded vegetation")}
                caption={
                  orbit.mode === "harvest"
                    ? t("Each patch is coloured by the date its echo dropped (see the bar). Blank land did not change.")
                    : t("Blue is new open water, green is flooded vegetation, on a grey radar image of the dry season.")
                }
              />
            ),
          },
          {
            key: "passes",
            label: t("Each pass"),
            body: (
              <Passes
                frames={orbit.frames}
                caption={t(
                  "False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Vegetation tends to look green; bare or wet ground looks darker.",
                )}
              />
            ),
          },
        ]}
      />

      {chart}

      <p className="text-xs leading-relaxed text-muted">
        {t("The radar sees the echo weaken or strengthen. That this was {what} is our reading of the place, not something the radar tells apart.", {
          what: t(ACTIVITY_NOUN[extra.activity]),
        })}
      </p>

      {technical && (
        <Facts
          rows={[
            [t("Satellite"), `NISAR, ${trackLabel(t, orbit.label)}`],
            [t("Polarisations"), t("{a} and {b}", { a: orbit.coPol, b: orbit.crossPol })],
            [t("Threshold"), orbit.thresholdDb === null ? "—" : `${orbit.thresholdDb} dB`],
            [t("Vegetation above"), orbit.vegMinDb === null ? "—" : `${orbit.vegMinDb} dB`],
            [t("Water below"), orbit.waterMaxDb === null ? "—" : `${orbit.waterMaxDb} dB`],
            [t("Median filter"), orbit.medianFilterPx === null ? "—" : `${orbit.medianFilterPx} px`],
            [t("Pixel"), `${orbit.pixelM} m · ${orbit.crs}`],
            ...(orbit.mode === "harvest"
              ? ([[t("Mean largest drop"), `${orbit.meanMaxDropDb} dB`]] as Array<[string, ReactNode]>)
              : ([[t("Baseline passes"), orbit.baselineDates.map((d) => formatDate(d)).join(", ")]] as Array<[string, ReactNode]>)),
          ]}
        />
      )}
    </div>
  );
}

/* -------------------------------- glaciers -------------------------------- */

function GlacierView({ extra, technical }: { extra: GlacierExtra; technical: boolean }) {
  const t = useT();
  const [picked, setPicked] = useState(extra.groups[0].key);
  const group: IceGroup = extra.groups.find((g) => g.key === picked) ?? extra.groups[0];
  const days = group.series[0]?.days ?? 12;
  const first = group.series[0].ref;
  const last = group.series[group.series.length - 1].sec;

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">
        {t(
          "The ice here moves up to {max} m a day at its fastest, about {between} m between two passes {days} days apart. Roughly {area} km² of it moves faster than {thr} m a day. The speed comes from tracking how the radar speckle pattern slides from one pass to the next.",
          {
            max: group.maxSpeedMDay,
            between: km(group.maxSpeedMDay * days),
            days,
            area: km(group.fastAreaKm2),
            thr: group.fastThresholdMs,
          },
        )}
      </p>

      {technical && <Switcher items={extra.groups} value={group.key} label={t("Satellite track")} onPick={setPicked} text={(g) => trackLabel(t, g.label)} />}

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label={t("Fastest ice")} note={t("top speed in the scene")}>
          {group.maxSpeedMDay} <Unit>{t("m/day")}</Unit>
        </Stat>
        <Stat label={t("Typical")} note={t("half the scene is slower")}>
          {group.typicalSpeedMDay} <Unit>{t("m/day")}</Unit>
        </Stat>
        <Stat label={t("Faster than {thr} m/day", { thr: group.fastThresholdMs })} note={t("average over the pairs")}>
          {km(group.fastAreaKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("Passes compared")} note={`${formatDate(first)} – ${formatDate(last)}`}>
          {group.series.length} <Unit>{t("pairs")}</Unit>
        </Stat>
      </dl>

      <Tabs
        key={group.key}
        tabs={[
          {
            key: "map",
            label: t("Speed map"),
            body: (
              <Figure
                src={group.map}
                size={group.mapSize}
                alt={t("Map of the ice speed")}
                caption={t(
                  "Median speed over all the pairs, in metres a day, on a logarithmic scale: dark blue is nearly still, red is fastest. Dark patches are ground the method could not read.",
                )}
              />
            ),
          },
          {
            key: "passes",
            label: t("Each pass"),
            body: <Passes frames={group.frames} caption={t("False colour of single passes: red and blue carry the co-polarised echo, green the cross-polarised one.")} />,
          },
        ]}
      />

      <div>
        <Title>{t("Speed over time")}</Title>
        <div className="mt-2">
          <SeriesChart
            unit={t("m per day")}
            series={[
              { name: t("Fast edge (95th percentile)"), color: COLORS.warm, points: group.series.map((p) => ({ x: p.date, y: p.p95 })) },
              { name: t("Median of ice > {thr} m/day", { thr: group.fastThresholdMs }), color: COLORS.second, points: group.series.map((p) => ({ x: p.date, y: p.fastMedian })) },
            ]}
          />
        </div>
      </div>

      {technical && (
        <Facts
          rows={[
            [t("Satellite"), `NISAR, ${trackLabel(t, group.label)}`],
            [t("Method"), methodText(extra.method)],
            [t("Assumed incidence"), `${group.incidenceDeg}°`],
            [t("Noise on still ground"), `${group.noiseMDay} ${t("m/day")}`],
            [t("Pixel"), `${group.pixelM} m · ${group.crs}`],
            [t("Fastest pair"), extra.maxSpeedPair],
          ]}
        />
      )}
    </div>
  );
}

/* --------------------------- earthquakes, landslides ----------------------- */

function DisplacementView({ detail, extra, technical }: { detail: EventDetail; extra: DisplacementExtra; technical: boolean }) {
  const t = useT();
  const [picked, setPicked] = useState(extra.pairs[0].key);
  const pair: DisplacementPair = extra.pairs.find((p) => p.key === picked) ?? extra.pairs[0];
  const slide = detail.type === "landslide";

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">
        {t(
          "Between {d1} and {d2}, the ground moved up to {toward} cm toward the satellite and {away} cm away from it, along the satellite’s line of sight. About {area} km² moved more than 5 cm.",
          {
            d1: formatDate(pair.ref),
            d2: formatDate(pair.sec),
            toward: pair.towardMaxCm,
            away: Math.abs(pair.awayMaxCm),
            area: km(pair.area5Km2),
          },
        )}{" "}
        {pair.reliablePct < 30
          ? t("Only {pct}% of this picture could be measured reliably: over water, steep or leafy ground the radar lost the thread, so read it as a partial view.", { pct: pair.reliablePct })
          : t("{pct}% of this picture could be measured reliably.", { pct: pair.reliablePct })}
      </p>

      {technical && (
        <Switcher
          items={extra.pairs}
          value={pair.key}
          label={t("Pair of passes")}
          onPick={setPicked}
          text={(p) => `${trackLabel(t, p.label).split(" · ")[0]} · ${p.direction === "ascending" ? t("asc") : t("desc")}`}
        />
      )}

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label={t("Toward the satellite")} note={t("up and/or toward it")}>
          {pair.towardMaxCm} <Unit>cm</Unit>
        </Stat>
        <Stat label={t("Away from it")} note={t("down and/or away")}>
          {Math.abs(pair.awayMaxCm)} <Unit>cm</Unit>
        </Stat>
        <Stat label={t("Moved over 5 cm")} note={t("{area} km² over 10 cm", { area: km(pair.area10Km2) })}>
          {km(pair.area5Km2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={slide ? t("Collapse on") : t("Event on")} note={t("{days} days between the passes", { days: pair.days })}>
          <span className="text-sm">{formatDate(extra.eventDate)}</span>
        </Stat>
      </dl>

      <Tabs
        key={pair.key}
        tabs={[
          {
            key: "move",
            label: t("Ground movement"),
            body: (
              <Figure
                src={pair.images.displacement}
                size={pair.images.displacementSize}
                alt={t("Map of the ground movement in centimetres")}
                caption={t("Red: the ground moved toward the satellite. Blue: away from it. Blank areas could not be measured. Axes are kilometres on the ground.")}
              />
            ),
          },
          {
            key: "fringes",
            label: t("Fringes"),
            body: (
              <Figure
                src={pair.images.fringes}
                size={pair.images.fringesSize}
                alt={t("Interferogram fringes")}
                caption={t("Each full colour cycle is {cm} cm of movement along the line of sight. The more cycles close together, the more the ground moved.", { cm: pair.fringeCm })}
              />
            ),
          },
        ]}
      />

      {technical && (
        <Facts
          rows={[
            [t("Satellite"), `NISAR, ${trackLabel(t, pair.label)}`],
            [t("Pair"), `${formatDate(pair.ref)} → ${formatDate(pair.sec)} (${t("{days} days", { days: pair.days })}), ${pair.pol}`],
            [t("Wavelength"), `${pair.wavelengthCm} cm`],
            [t("Coverage of the area"), `${pair.coveragePct}%`],
            [t("Reliable pixels"), `${pair.reliablePct}%`],
            [t("Median coherence"), pair.coherence],
            [t("Lost coherence"), `${km(pair.decorrelatedKm2)} km²`],
            [t("Moved over 20 cm"), `${km(pair.area20Km2)} km²`],
            [t("Ionosphere removed"), pair.ionosphereRemoved ? t("yes") : t("no")],
            [t("Pixel"), `${pair.pixelM} m`],
          ]}
        />
      )}
    </div>
  );
}

/** Entry point: picks the view that matches the kind of analysis. */

/* ------------------------- dated events (change mode) -------------------- */

const CAUSE_WORD: Record<ChangeExtra["cause"], { event: string; weaker: string }> = {
  wind: { event: msg("the windstorm"), weaker: msg("standing crops and trees that lost their echo, as if knocked down") },
  heat: { event: msg("the start of the heat wave"), weaker: msg("land whose echo weakened, as soil and plants dried") },
  landslide: { event: msg("the date of the landslide reports"), weaker: msg("slopes whose echo changed, where ground may have moved") },
};

function ChangeView({ extra, technical }: { extra: ChangeExtra; technical: boolean }) {
  const t = useT();
  const [picked, setPicked] = useState(extra.orbits[0].key);
  const orbit: ChangeOrbit = extra.orbits.find((o) => o.key === picked) ?? extra.orbits[0];
  const words = CAUSE_WORD[extra.cause];
  const summary = t(
    "Before {event_date}, {event}, the satellite passed {n} times to learn what normal looks like here. On {peak_date}, {drop} km² were {weaker}. {rise} km² became brighter, which can be regrowth, wetter soil or debris.",
    {
      event_date: formatDate(extra.eventDate),
      event: t(words.event),
      n: orbit.baselineDates.length,
      peak_date: formatDate(orbit.peakDropDate),
      drop: km(orbit.peakDropKm2),
      weaker: t(words.weaker),
      rise: km(orbit.lastRiseKm2),
    },
  );

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/90">{summary}</p>
      {technical && (
        <Switcher items={extra.orbits} value={orbit.key} label={t("Satellite track")} onPick={setPicked} text={(o) => trackLabel(t, o.label)} />
      )}
      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label={t("Weaker echo")} note={t("on {date}", { date: formatDate(orbit.peakDropDate) })}>
          {km(orbit.peakDropKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("Stronger echo")} note={t("on {date}", { date: formatDate(orbit.lastDate) })}>
          {km(orbit.lastRiseKm2)} <Unit>km²</Unit>
        </Stat>
        <Stat label={t("First look after")} note={t("{area} km² weaker", { area: km(orbit.firstPostDropKm2) })}>
          <span className="text-sm">{formatDate(orbit.firstPostDate)}</span>
        </Stat>
        <Stat label={t("Event")} note={t("{n} passes before it", { n: orbit.baselineDates.length })}>
          <span className="text-sm">{formatDate(extra.eventDate)}</span>
        </Stat>
      </dl>
      <Tabs
        key={orbit.key}
        tabs={[
          {
            key: "map",
            label: t("Map of the change"),
            body: (
              <Figure
                src={orbit.map}
                size={orbit.mapSize}
                alt={t("Map of where the radar echo changed after the event")}
                caption={t("Where the echo got weaker or stronger after the event, compared with the passes before it.")}
              />
            ),
          },
          {
            key: "passes",
            label: "Each pass",
            body: (
              <Passes
                frames={orbit.frames}
                caption={t("False colour: red and blue carry the co-polarised echo, green the cross-polarised one. Standing vegetation tends to look green.")}
              />
            ),
          },
        ]}
      />
      <div>
        <Title>{t("Land that has changed, pass by pass")}</Title>
        <div className="mt-2">
          <SeriesChart
            unit="km²"
            zero
            decimals={1}
            series={[
              { name: t("Weaker echo"), color: COLORS.warm, points: orbit.series.map((p) => ({ x: p.date, y: p.dropKm2, hollow: p.baseline })) },
              { name: t("Stronger echo"), color: COLORS.second, points: orbit.series.map((p) => ({ x: p.date, y: p.riseKm2, hollow: p.baseline })) },
            ]}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted">{t("Empty rings are the passes before the event, which set what is normal.")}</p>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        {t("The date of the event was set by our team from public reports. The radar sees the echo change; linking it to {event} is our reading.", { event: t(words.event) })}
      </p>
      {technical && (
        <Facts
          rows={[
            [t("Satellite"), `NISAR, ${trackLabel(t, orbit.label)}`],
            [t("Polarisations"), t("{a} and {b}", { a: orbit.coPol, b: orbit.crossPol })],
            [t("Threshold"), orbit.thresholdDb === null ? "—" : `${orbit.thresholdDb} dB`],
            [t("Median filter"), orbit.medianFilterPx === null ? "—" : `${orbit.medianFilterPx} px`],
            [t("Pixel"), `${orbit.pixelM} m · ${orbit.crs}`],
            [t("Baseline passes"), orbit.baselineDates.map((d) => formatDate(d)).join(", ")],
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
      <Impact detail={detail} />
    </div>
  );
}
