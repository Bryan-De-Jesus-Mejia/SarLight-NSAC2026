"use client";

import { useState } from "react";
import type { SensorAnalysis } from "@/data/types";
import { formatDate } from "@/lib/format";

interface SarViewerProps {
  analysis: SensorAnalysis;
}

type Mode = "swipe" | "diff" | "change";

const MODES: readonly { id: Mode; label: string }[] = [
  { id: "swipe", label: "Before / after" },
  { id: "diff", label: "Difference" },
  { id: "change", label: "Flagged" },
];

const day = (iso: string): string => iso.slice(0, 10);

/** Real radar images of one comparison: swipe between the two passes, or see what changed. */
export function SarViewer({ analysis }: SarViewerProps) {
  const [mode, setMode] = useState<Mode>("swipe");
  const [position, setPosition] = useState(50);

  const { images, imageSize, method } = analysis;
  const [lo, hi] = analysis.dbRange;
  const layer = "absolute inset-0 h-full w-full object-fill";
  const clip = { clipPath: `inset(0 ${100 - position}% 0 0)` };
  const before = formatDate(day(analysis.pre.date));
  const after = formatDate(day(analysis.post.date));
  const threshold = `${method.thresholdDb} dB`;

  return (
    <figure>
      <div className="ge-segments mb-2" role="group" aria-label="Image view">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className="ge-segment"
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-line bg-black has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
        style={{ aspectRatio: `${imageSize[0]} / ${imageSize[1]}` }}
      >
        {mode === "swipe" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.post} alt={`Radar backscatter on ${after}`} className={layer} draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.pre} alt={`Radar backscatter on ${before}`} className={layer} style={clip} draggable={false} />
            <span className="ge-compare-tag left-2">Before · {before}</span>
            <span className="ge-compare-tag right-2">After · {after}</span>

            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            >
              <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-[rgb(10_14_24/0.85)] text-white shadow-lg">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
                </svg>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              aria-label="Compare the before and after radar images"
              aria-valuetext={`${position}% before, ${100 - position}% after`}
              className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </>
        )}

        {mode === "diff" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images.diff}
              alt={`Change in backscatter between ${before} and ${after}`}
              className={layer}
              draggable={false}
            />
            <span className="ge-compare-tag left-2">After − before</span>
          </>
        )}

        {mode === "change" && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images.post} alt={`Radar backscatter on ${after}`} className={layer} draggable={false} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images.change}
              alt={`Pixels that changed by at least ${threshold}`}
              className={layer}
              draggable={false}
            />
            <span className="ge-compare-tag left-2">Changed ≥ {threshold}</span>
          </>
        )}
      </div>

      {/* Legend: what the shades mean. */}
      <div className="mt-2.5 text-xs leading-relaxed text-muted">
        {mode === "swipe" && (
          <>
            <span className="flex items-center gap-2">
              <span className="font-mono">{lo.toFixed(0)} dB</span>
              <span
                className="h-2 flex-1 rounded-full border border-line"
                style={{ background: "linear-gradient(90deg, #000, #fff)" }}
                aria-hidden="true"
              />
              <span className="font-mono">{hi.toFixed(0)} dB</span>
            </span>
            <span className="mt-1.5 block">
              Radar backscatter: brighter is a stronger echo (rough ground, buildings, vegetation); dark is calm
              water or smooth ground. Drag to compare the two passes.
            </span>
          </>
        )}
        {mode === "diff" && (
          <>
            <span className="flex items-center gap-2">
              <span className="font-mono">−6 dB</span>
              <span
                className="h-2 flex-1 rounded-full border border-line"
                style={{ background: "linear-gradient(90deg, #67001f, #f7f7f7, #053061)" }}
                aria-hidden="true"
              />
              <span className="font-mono">+6 dB</span>
            </span>
            <span className="mt-1.5 block">
              Red: the echo got weaker between the two passes. Blue: it got stronger. White: no change. Smoothed
              with a {method.medianFilterPx}-pixel median filter.
            </span>
          </>
        )}
        {mode === "change" && (
          <span className="block">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#ff6b3d" }} aria-hidden="true" />
              Weaker by ≥ {threshold}
            </span>
            {method.direction !== "decrease" && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#38bdf8" }} aria-hidden="true" />
                Stronger by ≥ {threshold}
              </span>
            )}
            <span className="mt-1.5 block">
              Pixels that crossed the threshold, drawn over the after image.
              {method.direction === "decrease" && " Only decreases were searched for in this analysis."}
            </span>
          </span>
        )}
      </div>
    </figure>
  );
}
