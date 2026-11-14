"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import type { SensorAnalysis } from "@/data/types";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatDate } from "@/lib/format";
import { globeApi } from "@/lib/globeApi";
import { useAppStore } from "@/store/useAppStore";

interface SarViewerProps {
  analysis: SensorAnalysis;
}

type Mode = "swipe" | "diff" | "change" | "time";

interface Probe {
  /** Pointer position inside the image, 0–1. */
  x: number;
  y: number;
  diff: number | null;
  before: number | null;
  after: number | null;
}

const FRAME_MS = 900;
/** Camera altitudes (globe radii) for the two zoom levels on the radar image. */
const CLOSE_ALTITUDE = 0.02;
const WIDE_ALTITUDE = 0.085;

const day = (iso: string): string => iso.slice(0, 10);
const co = (pol: string): string => (pol[0] === "V" ? "VV" : "HH");
const cross = (pol: string): string => (pol[0] === "V" ? "VH" : "HV");

/** Decodes the lossless probe image so values can be read under the pointer. */
function useProbeData(url: string): ImageData | null {
  const [loaded, setLoaded] = useState<{ url: string; data: ImageData } | null>(null);
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (!alive) return;
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      setLoaded({ url, data: ctx.getImageData(0, 0, canvas.width, canvas.height) });
    };
    image.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return loaded?.url === url ? loaded.data : null;
}

/**
 * Real radar images of one comparison: swipe between the two passes, see the
 * difference, the flagged pixels, or play every pass of the track as a
 * time-lapse. The same picture can be laid on the globe at its real position.
 */
export function SarViewer({ analysis }: SarViewerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const setDrape = useAppStore((s) => s.setDrape);

  const frames = useMemo(() => analysis.series.filter((p) => p.frame !== null), [analysis.series]);
  const [mode, setMode] = useState<Mode>("swipe");
  const [position, setPosition] = useState(50);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [onGlobe, setOnGlobe] = useState(true);
  const [close, setClose] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [probe, setProbe] = useState<Probe | null>(null);
  const probeData = useProbeData(analysis.images.probe);

  const { images, imageSize, method } = analysis;
  const [lo, hi] = analysis.dbRange;
  const before = formatDate(day(analysis.pre.date));
  const after = formatDate(day(analysis.post.date));
  const threshold = `${method.thresholdDb} dB`;
  const frame = frames[Math.min(frameIndex, Math.max(frames.length - 1, 0))];

  const modes: Array<{ id: Mode; label: string }> = [
    { id: "swipe", label: "Before / after" },
    { id: "diff", label: "Difference" },
    { id: "change", label: "Flagged" },
  ];
  if (frames.length > 1) modes.push({ id: "time", label: "Time-lapse" });

  // Time-lapse clock.
  useEffect(() => {
    if (!playing || mode !== "time" || frames.length < 2) return;
    const timer = setInterval(() => setFrameIndex((i) => (i + 1) % frames.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, mode, frames.length]);

  // Warm the cache so the time-lapse does not flicker.
  useEffect(() => {
    if (mode !== "time") return;
    for (const f of frames) {
      if (f.frame) new Image().src = f.frame;
    }
  }, [mode, frames]);

  // The globe shows the same picture as the viewer.
  const globeImage =
    mode === "diff" ? images.diff : mode === "change" ? images.change : mode === "time" ? (frame?.frame ?? null) : images.post;
  useEffect(() => {
    setDrape(onGlobe && globeImage ? { url: globeImage, opacity: mode === "diff" ? 0.92 : 1 } : null);
  }, [onGlobe, globeImage, mode, setDrape]);
  useEffect(() => () => setDrape(null), [setDrape]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation(); // close the enlarged view, not the case
      setExpanded(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [expanded]);

  const pickMode = (next: Mode) => {
    setMode(next);
    setProbe(null);
    setPlaying(next === "time" && !reducedMotion);
  };

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!probeData || mode === "time") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return setProbe(null);
    const px = Math.min(probeData.width - 1, Math.floor(x * probeData.width));
    const py = Math.min(probeData.height - 1, Math.floor(y * probeData.height));
    const i = (py * probeData.width + px) * 4;
    const [r, g, b] = [probeData.data[i], probeData.data[i + 1], probeData.data[i + 2]];
    const { diff, db } = analysis.probe;
    setProbe({
      x,
      y,
      diff: r === 0 ? null : (r - diff.offset) / diff.scale,
      before: g === 0 ? null : (g - db.offset) / db.scale,
      after: b === 0 ? null : (b - db.offset) / db.scale,
    });
  };

  const zoomGlobe = () => {
    globeApi.current?.frameCase(close ? WIDE_ALTITUDE : CLOSE_ALTITUDE);
    setClose(!close);
  };

  const layer = "absolute inset-0 h-full w-full select-none object-fill";
  const clip = { clipPath: `inset(0 ${100 - position}% 0 0)` };
  const downloadUrl =
    mode === "diff" ? images.diff : mode === "change" ? images.change : mode === "time" ? (frame?.frame ?? images.post) : images.post;

  const stage = (large: boolean) => (
    <div
      className={`relative overflow-hidden border border-line bg-black has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
        large ? "rounded-2xl" : "rounded-xl"
      }`}
      style={
        large
          ? { aspectRatio: `${imageSize[0]} / ${imageSize[1]}`, maxHeight: "100%", maxWidth: "100%", height: "100%" }
          : { aspectRatio: `${imageSize[0]} / ${imageSize[1]}` }
      }
      onPointerMove={handleMove}
      onPointerLeave={() => setProbe(null)}
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
          <img src={images.diff} alt={`Change in backscatter between ${before} and ${after}`} className={layer} draggable={false} />
          <span className="ge-compare-tag left-2">After − before</span>
        </>
      )}

      {mode === "change" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.post} alt={`Radar backscatter on ${after}`} className={layer} draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images.change} alt={`Pixels that changed by at least ${threshold}`} className={layer} draggable={false} />
          <span className="ge-compare-tag left-2">Changed ≥ {threshold}</span>
        </>
      )}

      {mode === "time" && frame?.frame && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frame.frame} alt={`False-colour radar image of ${formatDate(frame.date)}`} className={layer} draggable={false} />
          <span className="ge-compare-tag left-2">{formatDate(frame.date)}</span>
          <span className="ge-compare-tag right-2">
            Pass {frameIndex + 1} / {frames.length}
          </span>
        </>
      )}

      {probe && mode !== "time" && (
        <>
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgb(0_0_0/0.6)]"
            style={{ left: `${probe.x * 100}%`, top: `${probe.y * 100}%` }}
            aria-hidden="true"
          />
          <span className="ge-probe" aria-hidden="true">
            {probe.diff === null ? (
              "no data here"
            ) : (
              <>
                <b>
                  {probe.diff > 0 ? "+" : probe.diff < 0 ? "−" : ""}
                  {Math.abs(probe.diff).toFixed(1)} dB
                </b>
                {probe.before !== null && probe.after !== null && (
                  <span>
                    {" "}
                    · {probe.before.toFixed(1)} → {probe.after.toFixed(1)} dB
                  </span>
                )}
              </>
            )}
          </span>
        </>
      )}
    </div>
  );

  const timeControls = mode === "time" && frames.length > 1 && (
    <div className="mt-2 flex items-center gap-2.5">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        aria-label={playing ? "Pause the time-lapse" : "Play the time-lapse"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/70 bg-accent/10 text-accent transition-colors hover:bg-accent/20"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z" />}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        step={1}
        value={frameIndex}
        onChange={(e) => {
          setPlaying(false);
          setFrameIndex(Number(e.target.value));
        }}
        aria-label="Satellite pass"
        aria-valuetext={frame ? formatDate(frame.date) : undefined}
        className="ge-frames flex-1"
      />
      <span className="w-[5.6rem] shrink-0 text-right font-mono text-[11px] tabular-nums text-ink">
        {frame ? formatDate(frame.date) : ""}
      </span>
    </div>
  );

  const legend = (
    <div className="mt-2.5 text-xs leading-relaxed text-muted">
      {mode === "swipe" && (
        <>
          <span className="flex items-center gap-2">
            <span className="font-mono">{lo.toFixed(0)} dB</span>
            <span className="h-2 flex-1 rounded-full border border-line" style={{ background: "linear-gradient(90deg, #000, #fff)" }} aria-hidden="true" />
            <span className="font-mono">{hi.toFixed(0)} dB</span>
          </span>
          <span className="mt-1.5 block">
            Radar backscatter: brighter is a stronger echo (rough ground, buildings, vegetation); dark is calm
            water or smooth ground. Drag to compare; hover to read a pixel.
          </span>
        </>
      )}
      {mode === "diff" && (
        <>
          <span className="flex items-center gap-2">
            <span className="font-mono">−6 dB</span>
            <span className="h-2 flex-1 rounded-full border border-line" style={{ background: "linear-gradient(90deg, #67001f, #f7f7f7, #053061)" }} aria-hidden="true" />
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
      {mode === "time" && (
        <span className="block">
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#ff4d4d" }} aria-hidden="true" />
            {co(analysis.pol)}
          </span>
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#4ddb5c" }} aria-hidden="true" />
            {cross(analysis.pol)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#5b7bff" }} aria-hidden="true" />
            {co(analysis.pol)} − {cross(analysis.pol)}
          </span>
          <span className="mt-1.5 block">
            Every pass of this track in false colour, on one fixed colour scale. Green and yellow: dense
            vegetation, which scatters the pulse in all directions. Purple and blue: bare ground, low crops and
            other surfaces. Black: calm water. Watch for patches that switch colour between passes.
          </span>
        </span>
      )}
    </div>
  );

  const toolbar = (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
      <button
        type="button"
        role="switch"
        aria-checked={onGlobe}
        onClick={() => setOnGlobe(!onGlobe)}
        className="flex items-center gap-2 rounded px-1 py-1 text-ink transition-colors hover:bg-white/5"
      >
        <span className="ge-switch" data-on={onGlobe} aria-hidden="true" />
        Show on the globe
      </button>
      <button type="button" onClick={zoomGlobe} className="ge-link">
        {close ? "Zoom back out" : "Zoom the globe in"}
      </button>
      <button type="button" onClick={() => setExpanded(true)} className="ge-link">
        Enlarge
      </button>
      <a href={downloadUrl} download className="ge-link">
        Download image
      </a>
    </div>
  );

  const tabs = (
    <div className="ge-segments mb-2" role="group" aria-label="Image view">
      {modes.map((m) => (
        <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => pickMode(m.id)} className="ge-segment">
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <figure>
      {tabs}
      {stage(false)}
      {timeControls}
      {legend}
      {toolbar}

      {expanded &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Radar images, enlarged"
            className="fixed inset-0 z-[60] flex flex-col bg-[rgb(3_5_10/0.94)] p-4 sm:p-6"
          >
            <div className="mx-auto flex w-full max-w-6xl items-start gap-3">
              <div className="min-w-0 flex-1">{tabs}</div>
              <button
                type="button"
                autoFocus
                onClick={() => setExpanded(false)}
                aria-label="Close the enlarged view"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-white/10 hover:text-ink"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">{stage(true)}</div>
            <div className="mx-auto w-full max-w-3xl">
              {timeControls}
              {legend}
            </div>
          </div>,
          document.body,
        )}
    </figure>
  );
}
