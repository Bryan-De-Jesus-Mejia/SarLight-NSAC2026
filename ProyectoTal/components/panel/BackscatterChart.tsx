"use client";

import { useMemo, useState, type PointerEvent } from "react";
import type { SensorAnalysis } from "@/data/types";
import { useElementSize } from "@/hooks/useElementSize";
import { formatDate, formatMonth } from "@/lib/format";

interface BackscatterChartProps {
  analysis: SensorAnalysis;
  /** Series colour (the change type's colour). */
  color: string;
}

const HEIGHT = 190;
const MARGIN = { top: 16, right: 14, bottom: 24, left: 46 };

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
 * Median radar backscatter of the whole area on every pass of the same track
 * and polarisation. The two passes that were compared are marked. This is the
 * area-wide level, so it moves little when only a small patch changes.
 */
export function BackscatterChart({ analysis, color }: BackscatterChartProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const series = analysis.series;
  const usable = useMemo(() => series.filter((p) => p.usable), [series]);
  const width = size.width;
  const preDay = analysis.pre.date.slice(0, 10);
  const postDay = analysis.post.date.slice(0, 10);

  const model = useMemo(() => {
    if (usable.length < 2) return null;
    const times = usable.map((p) => toMs(p.date));
    const values = usable.map((p) => p.medianDb);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max((rawMax - rawMin) * 0.25, 0.4);
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;
    return { times, yMin, yMax, ticks: niceTicks(yMin, yMax) };
  }, [usable]);

  if (!model) {
    return (
      <p className="rounded-lg border border-line bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-muted">
        Only {usable.length} pass{usable.length === 1 ? "" : "es"} of this track cover the area well enough, so
        there is no time series to draw.
      </p>
    );
  }

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const t0 = model.times[0];
  const t1 = model.times[model.times.length - 1];
  const x = (ms: number): number => MARGIN.left + ((ms - t0) / (t1 - t0 || 1)) * plotW;
  const y = (v: number): number =>
    MARGIN.top + (1 - (v - model.yMin) / (model.yMax - model.yMin)) * plotH;

  const points = usable.map((p, i) => ({ px: x(model.times[i]), py: y(p.medianDb), p }));
  const linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.px.toFixed(1)} ${pt.py.toFixed(1)}`).join(" ");

  const marks = [
    { day: preDay, label: "Before" },
    { day: postDay, label: "After" },
  ].filter((m) => {
    const ms = toMs(m.day);
    return ms >= t0 && ms <= t1;
  });

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
  const tooltipLeft = active ? Math.min(Math.max(active.px, 70), Math.max(width - 70, 70)) : 0;

  return (
    <div>
      <div ref={wrapRef} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Median radar backscatter of the area on each pass, in dB, from ${formatDate(usable[0].date)} to ${formatDate(usable[usable.length - 1].date)}. A table of the values follows.`}
            className="block overflow-visible"
          >
            {model.ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotW}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="rgb(255 255 255 / 0.08)"
                />
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
              // "Before" sits left of its line. "After" sits right of its line, or
              // below the first label and left of its line when the edge is near.
              const nearEdge = mx > MARGIN.left + plotW - 56;
              const anchorEnd = i === 0 || nearEdge;
              return (
                <g key={m.label}>
                  <line
                    x1={mx}
                    x2={mx}
                    y1={MARGIN.top}
                    y2={MARGIN.top + plotH}
                    stroke="rgb(242 184 102 / 0.75)"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={mx + (anchorEnd ? -5 : 5)}
                    y={MARGIN.top + 10 + (i === 1 && nearEdge ? 14 : 0)}
                    textAnchor={anchorEnd ? "end" : "start"}
                    className="ge-chart-note"
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}

            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((pt) => {
              const compared = pt.p.date === preDay || pt.p.date === postDay;
              return (
                <circle
                  key={pt.p.date}
                  cx={pt.px}
                  cy={pt.py}
                  r={compared ? 4.5 : 3}
                  fill={compared ? color : "#0a0e18"}
                  stroke={color}
                  strokeWidth={compared ? 2 : 1.5}
                />
              );
            })}

            {active && (
              <g pointerEvents="none">
                <line
                  x1={active.px}
                  x2={active.px}
                  y1={MARGIN.top}
                  y2={MARGIN.top + plotH}
                  stroke="rgb(233 237 245 / 0.4)"
                />
                <circle cx={active.px} cy={active.py} r={5} fill={color} stroke="#0a0e18" strokeWidth={2} />
              </g>
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
            style={{ left: tooltipLeft, top: Math.max(active.py - 12, 0) }}
            aria-hidden="true"
          >
            <div className="text-muted">{formatDate(active.p.date)}</div>
            <div className="text-ink">
              <span className="font-medium">{active.p.medianDb.toFixed(2)}</span> dB
              <span className="text-muted"> · {active.p.validPct.toFixed(0)}% covered</span>
            </div>
          </div>
        )}
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: color, background: color }} />
          Passes compared
        </span>
        <span>{analysis.group} · {analysis.pol} · {usable.length} passes</span>
      </p>

      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none rounded hover:text-ink">View data table</summary>
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
            <caption className="sr-only">Median backscatter of the area on each pass, in dB.</caption>
            <thead className="sticky top-0 bg-[#0d121d] text-muted">
              <tr>
                <th scope="col" className="px-2.5 py-1.5 font-normal">Date</th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-normal">Median (dB)</th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-normal">Covered</th>
                <th scope="col" className="px-2.5 py-1.5 font-normal">Note</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {series.map((p) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-2.5 py-1">{p.date}</td>
                  <td className="px-2.5 py-1 text-right">{p.medianDb.toFixed(2)}</td>
                  <td className="px-2.5 py-1 text-right">{p.validPct.toFixed(0)}%</td>
                  <td className="px-2.5 py-1 text-muted">
                    {p.date === preDay ? "Before" : p.date === postDay ? "After" : p.usable ? "" : "Partial pass"}
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
