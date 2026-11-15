"use client";

import { useMemo, useState, type PointerEvent } from "react";
import type { SensorAnalysis } from "@/data/types";
import { useElementSize } from "@/hooks/useElementSize";
import { useT } from "@/i18n/core";
import { formatDate, formatMonth, formatNumber } from "@/lib/format";

interface BackscatterChartProps {
  analysis: SensorAnalysis;
  /** Colour of the flagged-land series (the change type's colour). */
  color: string;
}

const HEIGHT = 200;
const MARGIN = { top: 18, right: 14, bottom: 24, left: 46 };
const REST_COLOR = "#9ba7bb";

const toMs = (iso: string): number => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** Round tick positions (1, 2 or 5 × 10ⁿ apart) covering [min, max]. */
function niceTicks(min: number, max: number, target = 4): number[] {
  const span = max - min || 1;
  const rough = span / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / pow;
  const step = (unit >= 5 ? 5 : unit >= 2 ? 2 : 1) * pow;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : Number(v.toFixed(6)));
  }
  return ticks;
}

/**
 * Median backscatter on every pass of the track, for two groups of pixels:
 * the land that was flagged as changed, and the rest of the land. If the
 * flagged land moves while the rest holds still, the change is local and not
 * something that affected the whole scene (rain, calibration, season).
 */
export function BackscatterChart({ analysis, color }: BackscatterChartProps) {
  const t = useT();
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const series = analysis.series;
  const usable = useMemo(() => series.filter((p) => p.usable && p.outsideDb !== null), [series]);
  const hasInside = usable.some((p) => p.insideDb !== null);
  const width = size.width;
  const preDay = analysis.pre.date.slice(0, 10);
  const postDay = analysis.post.date.slice(0, 10);

  const model = useMemo(() => {
    if (usable.length < 2) return null;
    const times = usable.map((p) => toMs(p.date));
    const values = usable.flatMap((p) => [p.outsideDb, p.insideDb]).filter((v): v is number => v !== null);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max((rawMax - rawMin) * 0.18, 0.4);
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;
    return { times, yMin, yMax, ticks: niceTicks(yMin, yMax) };
  }, [usable]);

  if (!model) {
    return (
      <p className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-muted">
        {t(
          "Only {n, plural, one {# pass} other {# passes}} of this track cover the area well enough, so there is no time series to draw.",
          { n: usable.length },
        )}
      </p>
    );
  }

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const t0 = model.times[0];
  const t1 = model.times[model.times.length - 1];
  const x = (ms: number): number => MARGIN.left + ((ms - t0) / (t1 - t0 || 1)) * plotW;
  const y = (v: number): number => MARGIN.top + (1 - (v - model.yMin) / (model.yMax - model.yMin)) * plotH;

  const points = usable.map((p, i) => ({
    px: x(model.times[i]),
    inY: p.insideDb === null ? null : y(p.insideDb),
    outY: y(p.outsideDb as number),
    p,
  }));
  const path = (pick: (pt: (typeof points)[number]) => number | null): string => {
    let d = "";
    let pen = false;
    for (const pt of points) {
      const v = pick(pt);
      if (v === null) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${pt.px.toFixed(1)} ${v.toFixed(1)} `;
      pen = true;
    }
    return d;
  };

  const marks = [
    { day: preDay, label: t("Before") },
    { day: postDay, label: t("After") },
  ].filter((m) => toMs(m.day) >= t0 && toMs(m.day) <= t1);

  const xTicks = [0, Math.floor((points.length - 1) / 2), points.length - 1]
    .filter((i, n, all) => all.indexOf(i) === n)
    .map((i) => ({ px: points[i].px, text: formatMonth(points[i].p.date) }));

  const handleMove = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left + MARGIN.left;
    let nearest = 0;
    for (let i = 1; i < points.length; i += 1) {
      if (Math.abs(points[i].px - px) < Math.abs(points[nearest].px - px)) nearest = i;
    }
    setHover(nearest);
  };

  const active = hover !== null ? points[hover] : null;
  const tooltipLeft = active ? Math.min(Math.max(active.px, 84), Math.max(width - 84, 84)) : 0;
  const last = points[points.length - 1];
  const fmt = (v: number | null): string => (v === null ? "—" : formatNumber(v, 2, 2));

  return (
    <div>
      <div ref={wrapRef} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={t(
              "Median radar backscatter in dB on each pass, for the flagged land and for the rest of the land, from {from} to {to}. A table of the values follows.",
              { from: formatDate(usable[0].date), to: formatDate(usable[usable.length - 1].date) },
            )}
            className="block overflow-visible"
          >
            {model.ticks.map((tick) => (
              <g key={tick}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(tick)} y2={y(tick)} stroke="rgb(255 255 255 / 0.08)" />
                <text x={MARGIN.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="ge-chart-tick">
                  {tick}
                </text>
              </g>
            ))}

            {xTicks.map((tick, i) => (
              <text
                key={tick.px}
                x={tick.px}
                y={HEIGHT - 6}
                textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
                className="ge-chart-tick"
              >
                {tick.text}
              </text>
            ))}

            {/* The two compared passes */}
            {marks.map((m, i) => {
              const mx = x(toMs(m.day));
              const nearEdge = mx > MARGIN.left + plotW - 56;
              const anchorEnd = i === 0 || nearEdge;
              return (
                <g key={m.label}>
                  <line x1={mx} x2={mx} y1={MARGIN.top - 4} y2={MARGIN.top + plotH} stroke="rgb(242 184 102 / 0.75)" strokeDasharray="3 4" />
                  <text
                    x={mx + (anchorEnd ? -5 : 5)}
                    y={MARGIN.top + 6 + (i === 1 && nearEdge ? 13 : 0)}
                    textAnchor={anchorEnd ? "end" : "start"}
                    className="ge-chart-note"
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}

            {/* Rest of the land: the reference */}
            <path d={path((pt) => pt.outY)} fill="none" stroke={REST_COLOR} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
            {points.map((pt) => (
              <circle key={`o${pt.p.date}`} cx={pt.px} cy={pt.outY} r={2.5} fill="#0a0e18" stroke={REST_COLOR} strokeWidth={1.5} />
            ))}

            {/* Flagged land */}
            {hasInside && (
              <>
                <path d={path((pt) => pt.inY)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {points.map((pt) =>
                  pt.inY === null ? null : (
                    <circle
                      key={`i${pt.p.date}`}
                      cx={pt.px}
                      cy={pt.inY}
                      r={pt.p.date === preDay || pt.p.date === postDay ? 4.5 : 3}
                      fill={pt.p.date === preDay || pt.p.date === postDay ? color : "#0a0e18"}
                      stroke={color}
                      strokeWidth={2}
                    />
                  ),
                )}
              </>
            )}

            {active && (
              <line x1={active.px} x2={active.px} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="rgb(233 237 245 / 0.4)" pointerEvents="none" />
            )}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={handleMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}

        {active && (
          <div
            className="ge-chart-tooltip"
            style={{ left: tooltipLeft, top: Math.max(Math.min(active.inY ?? active.outY, active.outY) - 12, 0) }}
            aria-hidden="true"
          >
            <div className="text-muted">{formatDate(active.p.date)}</div>
            {hasInside && (
              <div className="text-ink">
                {t("Flagged land")} <span className="font-medium">{fmt(active.p.insideDb)}</span> dB
              </div>
            )}
            <div className="text-ink">
              {t("Rest of land")} <span className="font-medium">{fmt(active.p.outsideDb)}</span> dB
            </div>
          </div>
        )}
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {hasInside && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />
            {t("Flagged land")}
            {last.p.insideDb !== null ? ` (${fmt(last.p.insideDb)} dB)` : ""}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: REST_COLOR }} />
          {t("Rest of the land ({db} dB)", { db: fmt(last.p.outsideDb) })}
        </span>
        <span>
          {analysis.pol} · {t("{n} passes", { n: usable.length })}
        </span>
      </p>

      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none rounded hover:text-ink">{t("View data table")}</summary>
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
            <caption className="sr-only">{t("Median backscatter on each pass, in dB.")}</caption>
            <thead className="sticky top-0 bg-[#0d121d] text-muted">
              <tr>
                <th scope="col" className="px-2.5 py-1.5 font-normal">{t("Date")}</th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-normal">{t("Flagged")}</th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-normal">{t("Rest")}</th>
                <th scope="col" className="px-2.5 py-1.5 font-normal">{t("Note")}</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {series.map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-2.5 py-1">{p.date}</td>
                  <td className="px-2.5 py-1 text-right">{fmt(p.insideDb)}</td>
                  <td className="px-2.5 py-1 text-right">{fmt(p.outsideDb)}</td>
                  <td className="px-2.5 py-1 text-muted">
                    {p.date === preDay
                      ? t("Before")
                      : p.date === postDay
                        ? t("After")
                        : p.usable
                          ? ""
                          : t("Partial pass ({pct}%)", { pct: p.validPct.toFixed(0) })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
