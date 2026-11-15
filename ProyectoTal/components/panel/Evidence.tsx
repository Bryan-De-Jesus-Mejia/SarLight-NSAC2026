"use client";

import { useState, type ReactNode } from "react";
import type { ChangeType, EventDetail, SensorAnalysis } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";

const km = (v: number): string => formatValue(v);
const pct = (v: number): string => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const day = (iso: string): string => iso.slice(0, 10);
const signed = (v: number): string => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;

function Title({ children }: { children: ReactNode }) {
  return <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</h3>;
}

/** One labelled bar. `value` and `max` share a unit. */
function Bar({ value, max, color, muted = false }: { value: number; max: number; color: string; muted?: boolean }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${width}%`, background: color, opacity: muted ? 0.45 : 1 }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Did the flagged land really move?                                   */
/* ------------------------------------------------------------------ */

export function LocalChange({ analysis }: { analysis: SensorAnalysis }) {
  const pre = analysis.series.find((p) => p.date === day(analysis.pre.date));
  const post = analysis.series.find((p) => p.date === day(analysis.post.date));
  if (!pre || !post || pre.insideDb === null || post.insideDb === null || pre.outsideDb === null || post.outsideDb === null) {
    return null;
  }
  const inside = post.insideDb - pre.insideDb;
  const outside = post.outsideDb - pre.outsideDb;
  const local = Math.abs(inside) >= 3 * Math.max(Math.abs(outside), 0.2);
  return (
    <p className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-ink/90">
      Between the two passes the flagged land moved <b className="font-medium text-ink">{signed(inside)} dB</b>,
      while the rest of the land moved <b className="font-medium text-ink">{signed(outside)} dB</b>.{" "}
      {local
        ? "The change is local: it did not come from something that shifted the whole scene."
        : "The whole scene shifted by a comparable amount, so part of this may be scene-wide (rain, season or calibration)."}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Which channel sees it                                               */
/* ------------------------------------------------------------------ */

const POL_NOTE: Record<string, string> = {
  HH: "co-polarised: sensitive to surfaces, soil moisture and water under vegetation",
  VV: "co-polarised: sensitive to surfaces, soil moisture and rough water",
  HV: "cross-polarised: sensitive to vegetation volume (leaves, branches)",
  VH: "cross-polarised: sensitive to vegetation volume (leaves, branches)",
};

export function Channels({ detail, analysis, color }: { detail: EventDetail; analysis: SensorAnalysis; color: string }) {
  const rows = analysis.polarisations;
  const others = detail.analyses.filter((a) => a.key !== analysis.key);
  if (rows.length < 2 && others.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.flaggedAreaKm2), 0.001);
  const [a, b] = rows;
  let verdict = "";
  if (a && b) {
    const big = a.flaggedAreaKm2 >= b.flaggedAreaKm2 ? a : b;
    const small = big === a ? b : a;
    const ratio = small.flaggedAreaKm2 > 0 ? big.flaggedAreaKm2 / small.flaggedAreaKm2 : Infinity;
    verdict =
      ratio < 1.3
        ? `Both channels flag a similar area, which points to a change that affects the surface and the vegetation alike.`
        : `${big.pol} flags ${Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : "far"} more land than ${small.pol}: the change is mostly in what ${big.pol} responds to.`;
  }

  return (
    <section aria-labelledby="case-channels">
      <Title>
        <span id="case-channels">Which channel sees it</span>
      </Title>
      {rows.length >= 2 && (
        <>
          <ul className="mt-2.5 space-y-2.5">
            {rows.map((r) => (
              <li key={r.pol}>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">
                    <span className="font-mono">{r.pol}</span>
                    {r.analysed && <span className="ml-1.5 text-xs text-muted">(analysed)</span>}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink">{km(r.flaggedAreaKm2)} km²</span>
                </span>
                <span className="mt-1 block">
                  <Bar value={r.flaggedAreaKm2} max={max} color={color} muted={!r.analysed} />
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted">{POL_NOTE[r.pol]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
            Same two passes, same land, same {analysis.method.thresholdDb} dB threshold. {verdict}
          </p>
        </>
      )}
      {others.length > 0 && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
          Other wavelength:{" "}
          {others.map((o, i) => (
            <span key={o.key}>
              {i > 0 && "; "}
              {o.label} ({o.band}-band, {o.pol}) flags <b className="font-medium text-ink">{km(o.land.changedAreaKm2)} km²</b> on land
              between {formatDate(day(o.pre.date))} and {formatDate(day(o.post.date))}
            </span>
          ))}
          , against {km(analysis.land.changedAreaKm2)} km² here. The dates differ, so read it as a second opinion, not a
          like-for-like test. L-band (24 cm) passes through leaves to trunks and soil; C-band (5.6 cm) mostly sees the
          top of the canopy.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* What was on the ground                                              */
/* ------------------------------------------------------------------ */

const COVER_COLOR: Record<number, string> = {
  10: "#2f9e44",
  20: "#d9a441",
  30: "#c9d66b",
  40: "#e889c4",
  50: "#e5484d",
  60: "#a8a29e",
  80: "#3b82f6",
  90: "#22b8a6",
  95: "#10b981",
};

export function GroundCover({ analysis }: { analysis: SensorAnalysis }) {
  const cover = analysis.landCover;
  if (!cover) return null;
  const rows = cover.classes.filter((c) => c.flaggedPct >= 0.5 || c.scenePct >= 5).slice(0, 6);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.flatMap((c) => [c.flaggedPct, c.scenePct]));

  // The class that is most over-represented in what changed.
  const standout = rows
    .filter((c) => c.flaggedPct >= 10 && c.scenePct > 0)
    .map((c) => ({ c, lift: c.flaggedPct / c.scenePct }))
    .sort((p, q) => q.lift - p.lift)[0];

  return (
    <section aria-labelledby="case-cover">
      <Title>
        <span id="case-cover">What was on the ground</span>
      </Title>
      <ul className="mt-2.5 space-y-2.5">
        {rows.map((c) => (
          <li key={c.code}>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COVER_COLOR[c.code] ?? "#9ba7bb" }} aria-hidden="true" />
                {c.label}
              </span>
              <span className="font-mono text-xs tabular-nums text-ink">
                {pct(c.flaggedPct)}% <span className="text-muted">· {km(c.flaggedKm2)} km²</span>
              </span>
            </span>
            <span className="mt-1 block space-y-0.5">
              <Bar value={c.flaggedPct} max={max} color={COVER_COLOR[c.code] ?? "#9ba7bb"} />
              <Bar value={c.scenePct} max={max} color="#9ba7bb" muted />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-ink" /> share of the flagged land
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-muted/50" /> share of all the land analysed
        </span>
      </p>
      {standout && standout.lift >= 1.5 && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
          <b className="font-medium text-ink">{standout.c.label}</b> is {pct(standout.c.scenePct)}% of the land analysed
          but {pct(standout.c.flaggedPct)}% of what changed: {standout.lift.toFixed(1)}× over-represented.
        </p>
      )}
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        Land cover: {cover.source}, a 2021 map. The ground may have changed since.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compared with normal variation                                      */
/* ------------------------------------------------------------------ */

export function Baseline({ analysis }: { analysis: SensorAnalysis }) {
  const b = analysis.baseline;
  const passes = analysis.series.filter((p) => p.usable).length;
  return (
    <section aria-labelledby="case-baseline">
      <Title>
        <span id="case-baseline">Compared with normal variation</span>
      </Title>
      {b ? (
        <>
          <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
            This track has {b.passes} passes. From {b.pairs} other pairs of consecutive passes we measured how much
            each pixel normally moves from one pass to the next (typically ±{b.sigmaMedianDb?.toFixed(1)} dB).
          </p>
          <p className="mt-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-ink/90">
            <b className="font-medium text-ink">
              {pct(b.beyond3SigmaPct)}% of the flagged land ({km(b.beyond3SigmaKm2)} km²)
            </b>{" "}
            changed by more than 3 times its own normal variation.{" "}
            {b.beyond3SigmaPct >= 50
              ? "For those pixels this is unusual behaviour, not their ordinary flicker."
              : "The rest sits on pixels that often move this much, so it is weaker evidence."}
          </p>
        </>
      ) : (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
          Not measured here: this track has only {passes} passes over the area, and a per-pixel baseline needs at least
          7. As NISAR keeps returning every 12 days, this check becomes possible.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Hypotheses                                                          */
/* ------------------------------------------------------------------ */

interface Hypothesis {
  cause: string;
  check: string;
}

export const HYPOTHESES: Partial<Record<ChangeType, Hypothesis[]>> = {
  wildfire: [
    { cause: "Fire removed leaves and branches, so less energy is scattered back in the cross-polarised channel.", check: "Thermal hot spots (NASA FIRMS) or a burn scar in optical imagery on the same dates." },
    { cause: "Clearing or logging, a human driver, would look much the same to the radar.", check: "Straight edges and roads nearby in optical imagery; local land-use records." },
    { cause: "Drying: less water in soil and plants lowers the echo without any loss of vegetation.", check: "Rainfall and soil-moisture records. Drying affects wide areas, not sharp patches." },
  ],
  flood: [
    { cause: "Standing water on open ground or crops turned a rough surface into a mirror, so the echo dropped.", check: "Rainfall and river records, NASA's OPERA surface-water product (DSWx), local reports." },
    { cause: "Wetter soil and growing crops raise the echo: a stronger return is not flooding.", check: "Crop calendars and rainfall. Rises that follow field boundaries point to farming." },
    { cause: "Farming itself: irrigation, harvest or ploughing between the two passes.", check: "Whether the patches match field shapes and the local crop cycle (rice paddies are flooded on purpose)." },
  ],
  wetland: [
    { cause: "Open water expanded or retreated with the seasons.", check: "Rainfall and river levels; OPERA surface-water maps." },
  ],
};

export function Hypotheses({ type }: { type: ChangeType }) {
  const list = HYPOTHESES[type];
  if (!list) return null;
  return (
    <section aria-labelledby="case-hypotheses">
      <Title>
        <span id="case-hypotheses">What could be driving it</span>
      </Title>
      <p className="mt-1.5 text-xs text-muted">Hypotheses, each with the evidence that would confirm or rule it out.</p>
      <ol className="mt-2.5 space-y-3">
        {list.map((h, i) => (
          <li key={h.cause} className="flex gap-3 text-sm leading-relaxed">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-muted">
              {i + 1}
            </span>
            <span>
              <span className="text-ink/90">{h.cause}</span>
              <span className="mt-0.5 block text-xs text-muted">To check: {h.check}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Share and export                                                    */
/* ------------------------------------------------------------------ */

export function ShareBar({ detail }: { detail: EventDetail }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("case", detail.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", url.toString());
    }
  };

  return (
    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
      <button type="button" onClick={() => void copyLink()} className="ge-pill">
        {copied ? "Link copied" : "Copy link to this case"}
      </button>
    </div>
  );
}
