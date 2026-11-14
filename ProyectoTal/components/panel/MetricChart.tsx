"use client";

import { useMemo, useState, type PointerEvent } from "react";
import type { EventDetail } from "@/data/types";
import { useElementSize } from "@/hooks/useElementSize";
import { formatDate, formatMonth, formatValue } from "@/lib/format";

interface MetricChartProps {
  detail: EventDetail;
  /** Series colour (the change type's colour). */
  color: string;
}

const HEIGHT = 196;
const MARGIN = { top: 14, right: 12, bottom: 24, left: 44 };

const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** Round tick positions (1, 2 or 5 × 10ⁿ apart) covering [min, max]. */
function niceTicks(min: number, max: number, target = 4): number[] {
  const span = max - min || 1;
  const rough = span / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / pow;
  const step = (unit >= 5 ? 5 : unit >= 2 ? 2 : 1) * pow;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) {
    ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  }
  return ticks;
}

/**
 * Change over time for one case: a single series with its uncertainty band,
 * the baseline period shaded, and the baseline mean as a dashed reference.
 */
export function MetricChart({ detail, color }: MetricChartProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const { series, unit, label, baselineEndDate } = detail.metric;
  const width = size.width;

  const model = useMemo(() => {
    const times = series.map((p) => toMs(p.date));
    const lows = series.map((p) => p.value - (p.uncertainty ?? 0));
    const highs = series.map((p) => p.value + (p.uncertainty ?? 0));
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs);
    const pad = (rawMax - rawMin || 1) * 0.08;
    const yMin = rawMin - pad;
    const yMax = rawMax + pad;

    const baselineCount = series.filter((p) => p.date <= baselineEndDate).length;
    const baselineMean =
      series.slice(0, baselineCount).reduce((sum, p) => sum + p.value, 0) / Math.max(baselineCount, 1);

    return { times, yMin, yMax, baselineCount, baselineMean, ticks: niceTicks(yMin, yMax) };
  }, [series, baselineEndDate]);

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const t0 = model.times[0];
  const t1 = model.times[model.times.length - 1];

  const x = (ms: number): number => MARGIN.left + ((ms - t0) / (t1 - t0 || 1)) * plotW;
  const y = (v: number): number =>
    MARGIN.top + (1 - (v - model.yMin) / (model.yMax - model.yMin)) * plotH;

  const points = series.map((p, i) => ({ px: x(model.times[i]), py: y(p.value), p }));
  const linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.px.toFixed(1)} ${pt.py.toFixed(1)}`).join(" ");
  const bandPath =
    points
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.px.toFixed(1)} ${y(pt.p.value + (pt.p.uncertainty ?? 0)).toFixed(1)}`)
      .join(" ") +
    " " +
    [...points]
      .reverse()
      .map((pt) => `L${pt.px.toFixed(1)} ${y(pt.p.value - (pt.p.uncertainty ?? 0)).toFixed(1)}`)
      .join(" ") +
    " Z";

  // The baseline period ends halfway between the last baseline pass and the first event pass.
  const lastBaseline = points[model.baselineCount - 1];
  const firstEvent = points[model.baselineCount];
  const baselineEndX = firstEvent ? (lastBaseline.px + firstEvent.px) / 2 : lastBaseline.px;
  const baselineY = y(model.baselineMean);
  const last = points[points.length - 1];

  const xTicks = [0, model.baselineCount, points.length - 1]
    .filter((i, n, all) => i < points.length && all.indexOf(i) === n)
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
  const tooltipLeft = active ? Math.min(Math.max(active.px, 76), Math.max(width - 76, 76)) : 0;

  return (
    <div>
      <div ref={wrapRef} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${label} over time, in ${unit}. Simulated data. A table of the values follows.`}
            className="block overflow-visible"
          >
            {/* Baseline period */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={Math.max(baselineEndX - MARGIN.left, 0)}
              height={plotH}
              fill="rgb(255 255 255 / 0.045)"
            />
            <text x={MARGIN.left + 6} y={MARGIN.top + 13} className="ge-chart-note">
              Baseline
            </text>
            <text
              x={Math.max(baselineEndX + 6, MARGIN.left + 70)}
              y={MARGIN.top + 13}
              className="ge-chart-note"
            >
              Event
            </text>

            {/* Grid + y axis */}
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
                  {formatValue(tick)}
                </text>
              </g>
            ))}

            {/* x axis */}
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

            {/* Baseline mean reference */}
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={baselineY}
              y2={baselineY}
              stroke="rgb(233 237 245 / 0.55)"
              strokeDasharray="4 4"
            />

            {/* Uncertainty band + series */}
            <path d={bandPath} fill={color} fillOpacity={0.16} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={last.px} cy={last.py} r={4.5} fill={color} stroke="#0a0e18" strokeWidth={2} />

            {/* Hover layer */}
            {active && (
              <g pointerEvents="none">
                <line
                  x1={active.px}
                  x2={active.px}
                  y1={MARGIN.top}
                  y2={MARGIN.top + plotH}
                  stroke="rgb(233 237 245 / 0.4)"
                />
                <circle cx={active.px} cy={active.py} r={4.5} fill={color} stroke="#0a0e18" strokeWidth={2} />
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
              <span className="font-medium">{formatValue(active.p.value)}</span> {unit}
              {active.p.uncertainty !== undefined && (
                <span className="text-muted"> ± {formatValue(active.p.uncertainty)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: color, opacity: 0.3 }} />
          ±1σ uncertainty
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed border-ink/60" />
          Baseline mean
        </span>
        <span>One point per 12-day pass</span>
      </p>

      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer select-none rounded hover:text-ink">View data table</summary>
        <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left font-mono text-[11px] tabular-nums">
            <caption className="sr-only">
              {label} per satellite pass ({unit}). Simulated data.
            </caption>
            <thead className="sticky top-0 bg-[#0d121d] text-muted">
              <tr>
                <th scope="col" className="px-2.5 py-1.5 font-normal">Date</th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-normal">Value ({unit})</th>
                <th scope="col" className="px-2.5 py-1.5 text-right font-normal">± 1σ</th>
                <th scope="col" className="px-2.5 py-1.5 font-normal">Period</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {series.map((p, i) => (
                <tr key={p.date} className="border-t border-line">
                  <td className="px-2.5 py-1">{p.date}</td>
                  <td className="px-2.5 py-1 text-right">{formatValue(p.value)}</td>
                  <td className="px-2.5 py-1 text-right">
                    {p.uncertainty !== undefined ? formatValue(p.uncertainty) : "—"}
                  </td>
                  <td className="px-2.5 py-1 text-muted">{i < model.baselineCount ? "Baseline" : "Event"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
