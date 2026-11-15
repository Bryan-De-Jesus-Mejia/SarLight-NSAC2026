"use client";

import { useState, type ReactNode } from "react";
import type { ChangeType, EventDetail, SensorAnalysis } from "@/data/types";
import { getLang, msg, useT } from "@/i18n/core";
import { rich } from "@/i18n/rich";
import { formatDate, formatNumber, formatValue } from "@/lib/format";

const km = (v: number): string => formatValue(v);
const pct = (v: number): string => formatNumber(v, 1);
const day = (iso: string): string => iso.slice(0, 10);
const signed = (v: number): string => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatNumber(Math.abs(v), 1, 1)}`;

const bold = { b: (chunk: string) => <b className="font-medium text-ink">{chunk}</b> };

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
  const t = useT();
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
      {rich(
        t("Between the two passes the flagged land moved <b>{inside} dB</b>, while the rest of the land moved <b>{outside} dB</b>.", {
          inside: signed(inside),
          outside: signed(outside),
        }),
        bold,
      )}{" "}
      {local
        ? t("The change is local: it did not come from something that shifted the whole scene.")
        : t("The whole scene shifted by a comparable amount, so part of this may be scene-wide (rain, season or calibration).")}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Which channel sees it                                               */
/* ------------------------------------------------------------------ */

const POL_NOTE: Record<string, string> = {
  HH: msg("co-polarised: sensitive to surfaces, soil moisture and water under vegetation"),
  VV: msg("co-polarised: sensitive to surfaces, soil moisture and rough water"),
  HV: msg("cross-polarised: sensitive to vegetation volume (leaves, branches)"),
  VH: msg("cross-polarised: sensitive to vegetation volume (leaves, branches)"),
};

export function Channels({ detail, analysis, color }: { detail: EventDetail; analysis: SensorAnalysis; color: string }) {
  const t = useT();
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
    if (ratio < 1.3) {
      verdict = t("Both channels flag a similar area, which points to a change that affects the surface and the vegetation alike.");
    } else if (Number.isFinite(ratio)) {
      verdict = t("{big} flags {ratio}× more land than {small}: the change is mostly in what {big} responds to.", {
        big: big.pol,
        small: small.pol,
        ratio: formatNumber(ratio, 1, 1),
      });
    } else {
      verdict = t("{big} flags far more land than {small}: the change is mostly in what {big} responds to.", {
        big: big.pol,
        small: small.pol,
      });
    }
  }

  return (
    <section aria-labelledby="case-channels">
      <Title>
        <span id="case-channels">{t("Which channel sees it")}</span>
      </Title>
      {rows.length >= 2 && (
        <>
          <ul className="mt-2.5 space-y-2.5">
            {rows.map((r) => (
              <li key={r.pol}>
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink">
                    <span className="font-mono">{r.pol}</span>
                    {r.analysed && <span className="ml-1.5 text-xs text-muted">({t("analysed")})</span>}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-ink">{km(r.flaggedAreaKm2)} km²</span>
                </span>
                <span className="mt-1 block">
                  <Bar value={r.flaggedAreaKm2} max={max} color={color} muted={!r.analysed} />
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted">{t(POL_NOTE[r.pol])}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
            {t("Same two passes, same land, same {thr} dB threshold.", { thr: analysis.method.thresholdDb })} {verdict}
          </p>
        </>
      )}
      {others.length > 0 && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
          {t("Other wavelength:")}{" "}
          {others.map((o, i) => (
            <span key={o.key}>
              {i > 0 && "; "}
              {rich(
                t("{label} ({band}-band, {pol}) flags <b>{area} km²</b> on land between {d1} and {d2}", {
                  label: o.label,
                  band: o.band,
                  pol: o.pol,
                  area: km(o.land.changedAreaKm2),
                  d1: formatDate(day(o.pre.date)),
                  d2: formatDate(day(o.post.date)),
                }),
                bold,
              )}
            </span>
          ))}
          {t(
            ", against {area} km² here. The dates differ, so read it as a second opinion, not a like-for-like test. L-band (24 cm) passes through leaves to trunks and soil; C-band (5.6 cm) mostly sees the top of the canopy.",
            { area: km(analysis.land.changedAreaKm2) },
          )}
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
  const t = useT();
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
        <span id="case-cover">{t("What was on the ground")}</span>
      </Title>
      <ul className="mt-2.5 space-y-2.5">
        {rows.map((c) => (
          <li key={c.code}>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COVER_COLOR[c.code] ?? "#9a9aa4" }} aria-hidden="true" />
                {t(c.label)}
              </span>
              <span className="font-mono text-xs tabular-nums text-ink">
                {pct(c.flaggedPct)}% <span className="text-muted">· {km(c.flaggedKm2)} km²</span>
              </span>
            </span>
            <span className="mt-1 block space-y-0.5">
              <Bar value={c.flaggedPct} max={max} color={COVER_COLOR[c.code] ?? "#9a9aa4"} />
              <Bar value={c.scenePct} max={max} color="#9a9aa4" muted />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-ink" /> {t("share of the flagged land")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-4 rounded-full bg-muted/50" /> {t("share of all the land analysed")}
        </span>
      </p>
      {standout && standout.lift >= 1.5 && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
          {rich(
            t("<b>{label}</b> is {scene}% of the land analysed but {flagged}% of what changed: {lift}× over-represented.", {
              label: t(standout.c.label),
              scene: pct(standout.c.scenePct),
              flagged: pct(standout.c.flaggedPct),
              lift: formatNumber(standout.lift, 1, 1),
            }),
            bold,
          )}
        </p>
      )}
      <p className="mt-1.5 text-[11px] leading-snug text-muted">
        {t("Land cover: {source}, a 2021 map. The ground may have changed since.", { source: cover.source })}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compared with normal variation                                      */
/* ------------------------------------------------------------------ */

export function Baseline({ analysis }: { analysis: SensorAnalysis }) {
  const t = useT();
  const b = analysis.baseline;
  const passes = analysis.series.filter((p) => p.usable).length;
  return (
    <section aria-labelledby="case-baseline">
      <Title>
        <span id="case-baseline">{t("Compared with normal variation")}</span>
      </Title>
      {b ? (
        <>
          <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
            {t(
              "This track has {passes} passes. From {pairs} other pairs of consecutive passes we measured how much each pixel normally moves from one pass to the next (typically ±{sigma} dB).",
              { passes: b.passes, pairs: b.pairs, sigma: b.sigmaMedianDb === null ? "?" : formatNumber(b.sigmaMedianDb, 1, 1) },
            )}
          </p>
          <p className="mt-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-ink/90">
            {rich(
              t("<b>{pct}% of the flagged land ({area} km²)</b> changed by more than 3 times its own normal variation.", {
                pct: pct(b.beyond3SigmaPct),
                area: km(b.beyond3SigmaKm2),
              }),
              bold,
            )}{" "}
            {b.beyond3SigmaPct >= 50
              ? t("For those pixels this is unusual behaviour, not their ordinary flicker.")
              : t("The rest sits on pixels that often move this much, so it is weaker evidence.")}
          </p>
        </>
      ) : (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">
          {t(
            "Not measured here: this track has only {passes} passes over the area, and a per-pixel baseline needs at least 7. As NISAR keeps returning every 12 days, this check becomes possible.",
            { passes },
          )}
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
    { cause: msg("Fire removed leaves and branches, so less energy is scattered back in the cross-polarised channel."), check: msg("Thermal hot spots (NASA FIRMS) or a burn scar in optical imagery on the same dates.") },
    { cause: msg("Clearing or logging, a human driver, would look much the same to the radar."), check: msg("Straight edges and roads nearby in optical imagery; local land-use records.") },
    { cause: msg("Drying: less water in soil and plants lowers the echo without any loss of vegetation."), check: msg("Rainfall and soil-moisture records. Drying affects wide areas, not sharp patches.") },
  ],
  flood: [
    { cause: msg("Standing water on open ground or crops turned a rough surface into a mirror, so the echo dropped."), check: msg("Rainfall and river records, NASA's OPERA surface-water product (DSWx), local reports.") },
    { cause: msg("Wetter soil and growing crops raise the echo: a stronger return is not flooding."), check: msg("Crop calendars and rainfall. Rises that follow field boundaries point to farming.") },
    { cause: msg("Farming itself: irrigation, harvest or ploughing between the two passes."), check: msg("Whether the patches match field shapes and the local crop cycle (rice paddies are flooded on purpose).") },
  ],
  wetland: [
    { cause: msg("Open water expanded or retreated with the seasons."), check: msg("Rainfall and river levels; OPERA surface-water maps.") },
  ],
};

export function Hypotheses({ type }: { type: ChangeType }) {
  const t = useT();
  const list = HYPOTHESES[type];
  if (!list) return null;
  return (
    <section aria-labelledby="case-hypotheses">
      <Title>
        <span id="case-hypotheses">{t("What could be driving it")}</span>
      </Title>
      <p className="mt-1.5 text-xs text-muted">{t("Hypotheses, each with the evidence that would confirm or rule it out.")}</p>
      <ol className="mt-2.5 space-y-3">
        {list.map((h, i) => (
          <li key={h.cause} className="flex gap-3 text-sm leading-relaxed">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-muted">
              {i + 1}
            </span>
            <span>
              <span className="text-ink/90">{t(h.cause)}</span>
              <span className="mt-0.5 block text-xs text-muted">{t("To check: {check}", { check: t(h.check) })}</span>
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

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ShareBar({ detail, analysis }: { detail: EventDetail; analysis: SensorAnalysis }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("case", detail.id);
    // The link opens in the language of whoever shares it.
    url.searchParams.set("lang", getLang());
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t("Copy this link"), url.toString());
    }
  };

  const geojson = () => {
    const ring = [...analysis.footprint.polygon, analysis.footprint.polygon[0]];
    const feature = {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        id: detail.id,
        name: detail.name,
        type: detail.type,
        sensor: analysis.label,
        polarisation: analysis.pol,
        before: analysis.pre.date,
        after: analysis.post.date,
        thresholdDb: analysis.method.thresholdDb,
        changedOnLandKm2: analysis.land.changedAreaKm2,
        weakerKm2: analysis.land.decreaseAreaKm2,
        strongerKm2: analysis.land.increaseAreaKm2,
        note: "Radar change analysis, not verified on the ground.",
      },
    };
    download(`${detail.id}-${analysis.key}.geojson`, JSON.stringify(feature, null, 2), "application/geo+json");
  };

  return (
    <div className="flex flex-wrap gap-2 border-t border-line pt-4">
      <button type="button" onClick={() => void copyLink()} className="ge-pill">
        {copied ? t("Link copied") : t("Copy link to this case")}
      </button>
      <button
        type="button"
        onClick={() => download(`${detail.id}.json`, JSON.stringify(detail, null, 2), "application/json")}
        className="ge-pill"
      >
        {t("Download data (JSON)")}
      </button>
      <button type="button" onClick={geojson} className="ge-pill">
        {t("Download area (GeoJSON)")}
      </button>
    </div>
  );
}
