"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PASS_CLOCK, loadPassCycle, type PassCycle } from "@/components/globe/passes";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { formatDate } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

/** How long the 12 days take on screen. */
const DURATION_MS = 22_000;
const RING = 2 * Math.PI * 40;

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * "The satellite's dance": plays one real 12-day NISAR cycle. The scenes are
 * drawn by the globe (components/globe/passes); this is the clock and caption.
 */
export function PassDance() {
  const on = useAppStore((s) => s.dance);
  const setDance = useAppStore((s) => s.setDance);
  const reducedMotion = usePrefersReducedMotion();

  const [cycle, setCycle] = useState<PassCycle | null>(null);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const progressRef = useRef(0);

  useEffect(() => {
    if (!on) return;
    let alive = true;
    void loadPassCycle().then((data) => {
      if (!alive) return;
      if (data) setCycle(data);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [on]);

  // Start from the beginning each time it is opened (or at the end with reduced motion).
  useEffect(() => {
    if (!on) return;
    const startAt = reducedMotion ? 1 : 0;
    progressRef.current = startAt;
    PASS_CLOCK.value = startAt;
    const frame = requestAnimationFrame(() => {
      setProgress(startAt);
      setPlaying(!reducedMotion);
    });
    return () => cancelAnimationFrame(frame);
  }, [on, reducedMotion]);

  // The clock.
  useEffect(() => {
    if (!on || !playing || !cycle) return;
    let frame = 0;
    let last = performance.now();
    let shown = 0;
    const tick = (now: number) => {
      const next = Math.min(1, progressRef.current + (now - last) / DURATION_MS);
      last = now;
      progressRef.current = next;
      PASS_CLOCK.value = next;
      if (now - shown > 90 || next === 1) {
        shown = now;
        setProgress(next);
      }
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, playing, cycle]);

  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDance(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, setDance]);

  const times = useMemo(() => cycle?.scenes.map((s) => s[0]) ?? [], [cycle]);

  if (!on) return null;

  const days = cycle?.days ?? 12;
  const minutes = progress * days * 24 * 60;
  // Scenes acquired so far (the list is sorted by time).
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= minutes) lo = mid + 1;
    else hi = mid;
  }
  const dayNumber = Math.min(days, Math.floor(progress * days) + 1);
  const date = cycle ? addDays(cycle.start, Math.min(days - 1, Math.floor(progress * days))) : null;
  const finished = progress >= 1;

  const toggle = () => {
    if (finished) {
      progressRef.current = 0;
      PASS_CLOCK.value = 0;
      setProgress(0);
      setPlaying(true);
    } else {
      setPlaying(!playing);
    }
  };

  return (
    <section
      aria-label="NISAR's 12-day cycle"
      className="ge-surface pointer-events-auto absolute bottom-6 left-1/2 z-20 flex w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-4 p-4"
    >
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="5" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${RING * progress} ${RING}`}
          />
          {Array.from({ length: days }, (_, i) => {
            const a = (i / days) * 2 * Math.PI;
            return (
              <line
                key={i}
                x1={50 + Math.cos(a) * 46.5}
                y1={50 + Math.sin(a) * 46.5}
                x2={50 + Math.cos(a) * 49.5}
                y2={50 + Math.sin(a) * 49.5}
                stroke="rgb(255 255 255 / 0.45)"
                strokeWidth="1"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Day</span>
          <span className="font-display text-3xl leading-none text-ink">{dayNumber}</span>
          <span className="font-mono text-[9px] text-muted">of {days}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">The satellite&rsquo;s dance</p>
        {failed ? (
          <p className="mt-1 text-sm text-muted">The list of NISAR scenes could not be loaded.</p>
        ) : (
          <>
            <p className="mt-0.5 font-display text-2xl leading-tight text-ink">{date ? formatDate(date) : "Loading…"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted" aria-live="off">
              <span className="font-mono tabular-nums text-ink">{lo.toLocaleString("en-US")}</span> of{" "}
              {(cycle?.count ?? 0).toLocaleString("en-US")} real scenes. Every 12 days NISAR returns to the same track,
              so each place gets a new look on a fixed beat.
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: "#f2b866" }} aria-hidden="true" /> heading north
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: "#5c9eff" }} aria-hidden="true" /> heading south
              </span>
            </p>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={finished ? "Play again" : playing ? "Pause" : "Play"}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/70 bg-accent/10 text-accent transition-colors hover:bg-accent/20"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill={finished ? "none" : "currentColor"} stroke={finished ? "currentColor" : "none"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {finished ? (
              <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4.5v4h4" />
            ) : playing ? (
              <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
            ) : (
              <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z" />
            )}
          </svg>
        </button>
        <button type="button" onClick={() => setDance(false)} className="ge-link text-[11px]">
          Close
        </button>
      </div>
    </section>
  );
}
