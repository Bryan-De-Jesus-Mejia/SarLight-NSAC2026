"use client";

import { useEffect, useRef, useState } from "react";
import type { EventDetail } from "@/data/types";
import { formatDate } from "@/lib/format";
import { SAR_IMAGE_HEIGHT, SAR_IMAGE_WIDTH, renderSarImage } from "@/lib/syntheticSar";

interface BeforeAfterProps {
  detail: EventDetail;
}

const CAPTIONS: Record<"backscatter" | "interferogram", string> = {
  backscatter: "Radar backscatter — brighter means a stronger echo. Calm water is dark.",
  interferogram:
    "Interferogram — each full colour cycle is about 12 cm of motion along the satellite's line of sight.",
};

/** Before/after comparison with a draggable (and keyboard-operable) divider. */
export function BeforeAfter({ detail }: BeforeAfterProps) {
  const beforeRef = useRef<HTMLCanvasElement | null>(null);
  const afterRef = useRef<HTMLCanvasElement | null>(null);
  const [position, setPosition] = useState(50);

  const { imagery } = detail;
  const series = detail.metric.series;
  const beforeDate = detail.metric.baselineEndDate;
  const afterDate = series[series.length - 1].date;
  const synthetic = imagery.kind === "synthetic";

  useEffect(() => {
    if (imagery.kind !== "synthetic") return;
    const options = {
      seed: imagery.seed,
      style: imagery.style,
      type: detail.type,
      magnitude: detail.magnitude,
      direction: detail.change.direction,
    };
    if (beforeRef.current) renderSarImage(beforeRef.current, options, "before");
    if (afterRef.current) renderSarImage(afterRef.current, options, "after");
  }, [imagery, detail.type, detail.magnitude, detail.change.direction]);

  const clip = { clipPath: `inset(0 ${100 - position}% 0 0)` };
  const layer = "absolute inset-0 h-full w-full";

  return (
    <figure>
      <div
        className="relative overflow-hidden rounded-xl border border-line bg-black has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
        style={{ aspectRatio: `${SAR_IMAGE_WIDTH} / ${SAR_IMAGE_HEIGHT}` }}
      >
        {imagery.kind === "synthetic" ? (
          <>
            <canvas ref={afterRef} className={layer} aria-hidden="true" />
            <canvas ref={beforeRef} className={layer} style={clip} aria-hidden="true" />
          </>
        ) : (
          <>
            <div
              className={`${layer} bg-cover bg-center`}
              style={{ backgroundImage: `url("${imagery.afterUrl}")` }}
            />
            <div
              className={`${layer} bg-cover bg-center`}
              style={{ backgroundImage: `url("${imagery.beforeUrl}")`, ...clip }}
            />
          </>
        )}

        <span className="ge-compare-tag left-2">Before · {formatDate(beforeDate)}</span>
        <span className="ge-compare-tag right-2">After · {formatDate(afterDate)}</span>
        {synthetic && (
          <span className="ge-compare-tag ge-compare-tag--simulated left-2">
            Simulated imagery
          </span>
        )}

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
          aria-label="Compare before and after images"
          aria-valuetext={`${position}% before, ${100 - position}% after`}
          className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      {synthetic && (
        <figcaption className="mt-2 text-xs leading-relaxed text-muted">
          {CAPTIONS[imagery.style]}
        </figcaption>
      )}
    </figure>
  );
}
