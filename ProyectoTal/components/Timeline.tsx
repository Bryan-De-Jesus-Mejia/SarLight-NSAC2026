"use client";

import { useEffect, useMemo } from "react";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { formatDate } from "@/lib/format";
import { dayCount, dayToIso, isoToDay } from "@/lib/time";
import { useAppStore } from "@/store/useAppStore";

interface TimelineProps {
  className?: string;
}

/** Playback: 2 days every 110 ms ≈ 13 months in ~22 s. */
const STEP_DAYS = 2;
const STEP_MS = 110;
const CHART_HEIGHT = 100;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Timeline scrubber with play/pause. When a date is set, the globe shows the
 * signals active on that date; "Show all" returns to the whole period.
 * Everything is applied client-side — moving through time never hits the network.
 */
export function Timeline({ className = "" }: TimelineProps) {
  const events = useAppStore((s) => s.events);
  const meta = useAppStore((s) => s.meta);
  const activeTypes = useAppStore((s) => s.activeTypes);
  const day = useAppStore((s) => s.timelineDay);
  const playing = useAppStore((s) => s.timelinePlaying);
  const setDay = useAppStore((s) => s.setTimelineDay);
  const setPlaying = useAppStore((s) => s.setTimelinePlaying);
  const { visible } = useVisibleEvents();

  const range = meta?.timeRange ?? null;
  const lastDay = range ? dayCount(range) : 0;

  // How many signals (of the selected types) are active on each day.
  const activity = useMemo(() => {
    if (!range) return { path: "", max: 0 };
    const diff = new Array<number>(lastDay + 2).fill(0);
    for (const e of events) {
      if (activeTypes.length > 0 && !activeTypes.includes(e.type)) continue;
      const from = Math.max(0, isoToDay(range, e.startDate));
      const to = Math.min(lastDay, isoToDay(range, e.endDate));
      if (to < from) continue;
      diff[from] += 1;
      diff[to + 1] -= 1;
    }
    const perDay: number[] = [];
    let running = 0;
    let max = 0;
    for (let d = 0; d <= lastDay; d += 1) {
      running += diff[d];
      perDay.push(running);
      if (running > max) max = running;
    }
    const scale = max > 0 ? (CHART_HEIGHT - 6) / max : 0;
    const top = perDay.map((n, d) => `L${d} ${(CHART_HEIGHT - n * scale).toFixed(1)}`).join(" ");
    return { path: `M0 ${CHART_HEIGHT} ${top} L${lastDay} ${CHART_HEIGHT} Z`, max };
  }, [events, activeTypes, range, lastDay]);

  const months = useMemo(() => {
    if (!range) return [];
    const ticks: { left: number; label: string }[] = [];
    const cursor = new Date(`${range.start}T00:00:00Z`);
    cursor.setUTCDate(1);
    for (let i = 0; i < 36; i += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      const d = isoToDay(range, iso);
      if (d > lastDay) break;
      if (d >= 0) {
        const month = cursor.getUTCMonth();
        const withYear = ticks.length === 0 || month === 0;
        ticks.push({
          left: (d / lastDay) * 100,
          label: withYear
            ? `${MONTHS[month]} ’${String(cursor.getUTCFullYear()).slice(2)}`
            : MONTHS[month],
        });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return ticks;
  }, [range, lastDay]);

  // Playback clock.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const state = useAppStore.getState();
      const next = (state.timelineDay ?? 0) + STEP_DAYS;
      if (next >= lastDay) {
        state.setTimelineDay(lastDay);
        state.setTimelinePlaying(false);
      } else {
        state.setTimelineDay(next);
      }
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [playing, lastDay]);

  if (!range || events.length === 0) return null;

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (day === null || day >= lastDay) setDay(0);
    setPlaying(true);
  };

  const position = day ?? lastDay;
  const currentIso = day === null ? null : dayToIso(range, day);

  return (
    <section
      className={`glass pointer-events-auto min-w-0 rounded-2xl px-4 pb-3 pt-3.5 ${className}`}
      aria-label="Timeline"
    >
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause timeline" : "Play timeline"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/70 bg-accent/10 text-accent transition-colors hover:bg-accent/20"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z" />}
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {currentIso ? "Signals active on" : "Whole period"}
          </p>
          <p className="truncate font-display text-2xl leading-tight text-ink">
            {currentIso
              ? formatDate(currentIso)
              : `${formatDate(range.start)} – ${formatDate(range.end)}`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-xs tabular-nums text-ink">
            {visible.length} <span className="text-muted">{visible.length === 1 ? "signal" : "signals"}</span>
          </p>
          {day !== null && (
            <button
              type="button"
              onClick={() => setDay(null)}
              className="mt-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent/15"
            >
              Show all
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-3 h-11 border-b border-line">
        <svg
          viewBox={`0 0 ${lastDay} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <clipPath id="ge-timeline-elapsed">
              <rect x="0" y="0" width={position} height={CHART_HEIGHT} />
            </clipPath>
          </defs>
          <path d={activity.path} fill="rgb(255 255 255 / 0.13)" />
          {day !== null && (
            <path d={activity.path} fill="rgb(242 184 102 / 0.42)" clipPath="url(#ge-timeline-elapsed)" />
          )}
        </svg>
        <input
          type="range"
          min={0}
          max={lastDay}
          step={1}
          value={position}
          onChange={(e) => {
            setPlaying(false);
            setDay(Number(e.target.value));
          }}
          aria-label="Timeline date"
          aria-valuetext={currentIso ? formatDate(currentIso) : "Whole period"}
          className={`ge-range absolute inset-0 ${day === null ? "ge-range--idle" : ""}`}
        />
      </div>

      <div className="relative mt-1.5 h-3.5 font-mono text-[10px] text-muted" aria-hidden="true">
        {months.map((tick, i) => (
          <span
            key={tick.left}
            className={`absolute top-0 whitespace-nowrap border-l border-line pl-1 leading-none ${i % 2 === 1 ? "max-sm:hidden" : ""}`}
            style={{ left: `${tick.left}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </section>
  );
}
