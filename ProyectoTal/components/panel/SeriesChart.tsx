"use client";

import { useT } from "@/i18n/core";
import { formatDate, formatNumber } from "@/lib/format";

export interface ChartPoint {
  /** ISO date. */
  x: string;
  y: number | null;
  /** Drawn as an empty ring (used for the baseline passes). */
  hollow?: boolean;
}

export interface ChartSeries {
  name: string;
  color: string;
  points: ChartPoint[];
}

interface SeriesChartProps {
  series: ChartSeries[];
  unit: string;
  height?: number;
  /** Start the vertical axis at zero. */
  zero?: boolean;
  /** Decimals shown on the axis. */
  decimals?: number;
}

const W = 420;
const PAD = { top: 10, right: 12, bottom: 22, left: 40 };
const toMs = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** A small, readable time series: one or more lines over dates, with the legend above it. */
export function SeriesChart({ series, unit, height = 130, zero = false, decimals = 1 }: SeriesChartProps) {
  const t = useT();
  const all = series.flatMap((s) => s.points.filter((p): p is ChartPoint & { y: number } => p.y !== null));
  if (all.length < 2) return null;

  const xs = all.map((p) => toMs(p.x));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = zero ? Math.min(0, ...all.map((p) => p.y)) : Math.min(...all.map((p) => p.y));
  let y1 = Math.max(...all.map((p) => p.y));
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const pad = (y1 - y0) * 0.08;
  if (!zero) y0 -= pad;
  y1 += pad;

  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const px = (ms: number) => PAD.left + (x1 === x0 ? plotW / 2 : ((ms - x0) / (x1 - x0)) * plotW);
  const py = (v: number) => PAD.top + plotH - ((v - y0) / (y1 - y0)) * plotH;

  const yTicks = [y0, (y0 + y1) / 2, y1].map((v) => ({ v, y: py(v) }));
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
  const xTicks = dates.length <= 3 ? dates : [dates[0], dates[Math.floor(dates.length / 2)], dates[dates.length - 1]];

  return (
    <figure>
      <ul className="mb-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/85">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.name}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={t("{names} over time, in {unit}", { names: series.map((s) => s.name).join(", "), unit })}>
        {yTicks.map((tick) => (
          <g key={tick.v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={tick.y} y2={tick.y} stroke="rgb(255 255 255 / 0.1)" />
            <text x={PAD.left - 6} y={tick.y + 3.5} textAnchor="end" className="ge-chart-tick">
              {formatNumber(tick.v, decimals)}
            </text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text
            key={d}
            x={px(toMs(d))}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="ge-chart-tick"
          >
            {formatDate(d).replace(/,?\s*\d{4}$/, "")}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.points.filter((p): p is ChartPoint & { y: number } => p.y !== null);
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(toMs(p.x)).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) => (
                <circle
                  key={p.x}
                  cx={px(toMs(p.x))}
                  cy={py(p.y)}
                  r="3"
                  fill={p.hollow ? "#0a0a0e" : s.color}
                  stroke={s.color}
                  strokeWidth="1.5"
                >
                  <title>{`${formatDate(p.x)}: ${formatNumber(p.y, 2)} ${unit}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{unit}</figcaption>
    </figure>
  );
}
