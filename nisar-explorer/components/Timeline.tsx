"use client";

import { useEffect, useMemo } from "react";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { useT } from "@/i18n/core";
import { formatDate, monthName } from "@/lib/format";
import { dayCount, dayToIso, isoToDay } from "@/lib/time";
import { useAppStore } from "@/store/useAppStore";

interface TimelineProps {
  className?: string;
}

/** Playback: 2 days every 110 ms ≈ 13 months in ~22 s. */
const STEP_DAYS = 2;
const STEP_MS = 110;
const CHART_HEIGHT = 100;

/**
 * Timeline with a period and a player. Two handles mark where the period
 * starts and ends: the globe shows what happened inside it. Play runs a day
 * marker through that period. "Show all" puts everything back to the start.
 * Everything is applied client-side — moving through time never hits the network.
 */
export function Timeline({ className = "" }: TimelineProps) {
  const t = useT();
  const events = useAppStore((s) => s.events);
  const meta = useAppStore((s) => s.meta);
  const day = useAppStore((s) => s.timelineDay);
  const playing = useAppStore((s) => s.timelinePlaying);
  const range = useAppStore((s) => s.timelineRange);
  const setDay = useAppStore((s) => s.setTimelineDay);
  const setPlaying = useAppStore((s) => s.setTimelinePlaying);
  const setRange = useAppStore((s) => s.setTimelineRange);
  const reset = useAppStore((s) => s.resetTimeline);
  const { visible, timeless } = useVisibleEvents();

  const period = meta?.timeRange ?? null;
  const lastDay = period ? dayCount(period) : 0;
  const from = range ? range[0] : 0;
  const to = range ? range[1] : lastDay;

  // How many signals (after filters and search) are active on each day.
  const activity = useMemo(() => {
    if (!period) return { path: "", max: 0 };
    const diff = new Array<number>(lastDay + 2).fill(0);
    for (const e of timeless) {
      const a = Math.max(0, isoToDay(period, e.startDate));
      const b = Math.min(lastDay, isoToDay(period, e.endDate));
      if (b < a) continue;
      diff[a] += 1;
      diff[b + 1] -= 1;
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
  }, [timeless, period, lastDay]);

  const months = useMemo(() => {
    if (!period) return [];
    const ticks: { left: number; label: string }[] = [];
    const cursor = new Date(`${period.start}T00:00:00Z`);
    cursor.setUTCDate(1);
    for (let i = 0; i < 36; i += 1) {
      const iso = cursor.toISOString().slice(0, 10);
      const d = isoToDay(period, iso);
      if (d > lastDay) break;
      if (d >= 0) {
        const month = cursor.getUTCMonth();
        const withYear = ticks.length === 0 || month === 0;
        ticks.push({
          left: (d / lastDay) * 100,
          label: withYear
            ? `${monthName(month)} ’${String(cursor.getUTCFullYear()).slice(2)}`
            : monthName(month),
        });
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return ticks;
    // `t` changes with the language, which is what redraws the month names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, lastDay, t]);

  // Playback clock: runs the day marker from the start of the period to its end.
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const state = useAppStore.getState();
      const end = state.timelineRange ? state.timelineRange[1] : lastDay;
      const next = (state.timelineDay ?? 0) + STEP_DAYS;
      if (next >= end) {
        state.setTimelineDay(end);
        state.setTimelinePlaying(false);
      } else {
        state.setTimelineDay(next);
      }
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [playing, lastDay]);

  if (!period || events.length === 0) return null;

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (day === null || day >= to || day < from) setDay(from);
    setPlaying(true);
  };

  const moveFrom = (value: number) => {
    const next: [number, number] = [Math.min(value, to), to];
    setRange(next[0] === 0 && next[1] === lastDay ? null : next);
  };
  const moveTo = (value: number) => {
    const next: [number, number] = [from, Math.max(value, from)];
    setRange(next[0] === 0 && next[1] === lastDay ? null : next);
  };

  const fromIso = dayToIso(period, from);
  const toIso = dayToIso(period, to);
  const dayIso = day === null ? null : dayToIso(period, day);
  const changed = range !== null || day !== null;
  const pct = (d: number) => `${(d / Math.max(1, lastDay)) * 100}%`;

  return (
    <section className={`ge-surface pointer-events-auto min-w-0 px-4 pb-3 pt-3.5 ${className}`} aria-label={t("Timeline")}>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? t("Pause timeline") : t("Play timeline")}
          title={playing ? t("Pause timeline") : t("Play the chosen period day by day")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-white/[0.04] text-ink transition-colors hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z" />}
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {dayIso ? t("Signals active on") : range ? t("Chosen period") : t("Whole period")}
          </p>
          <p className="truncate font-display text-2xl leading-tight text-ink">
            {dayIso ? formatDate(dayIso) : `${formatDate(fromIso)} – ${formatDate(toIso)}`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-xs tabular-nums text-ink">
            {visible.length} <span className="text-muted">{t("{n, plural, one {signal} other {signals}}", { n: visible.length })}</span>
          </p>
          {changed && (
            <button
              type="button"
              onClick={reset}
              title={t("Back to the whole period")}
              className="mt-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent/15"
            >
              {t("Show all")}
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-3 h-11 border-b border-line">
        <svg viewBox={`0 0 ${lastDay} ${CHART_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <clipPath id="ge-timeline-period">
              <rect x={from} y="0" width={Math.max(0, to - from)} height={CHART_HEIGHT} />
            </clipPath>
          </defs>
          <path d={activity.path} fill="rgb(255 255 255 / 0.1)" />
          <path d={activity.path} fill={range ? "rgb(251 113 133 / 0.42)" : "rgb(255 255 255 / 0.16)"} clipPath="url(#ge-timeline-period)" />
        </svg>
        {/* The chosen period, and the day marker while playing. */}
        {range && <div className="pointer-events-none absolute inset-y-0 border-x border-accent/70 bg-accent/[0.06]" style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }} />}
        {day !== null && <div className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-ink shadow-[0_0_10px_rgb(255_255_255/0.7)]" style={{ left: pct(day) }} />}
        <input
          type="range"
          min={0}
          max={lastDay}
          step={1}
          value={from}
          onChange={(e) => moveFrom(Number(e.target.value))}
          aria-label={t("Start of the period")}
          aria-valuetext={formatDate(fromIso)}
          className={`ge-range ge-range--dual absolute inset-0 ${range ? "" : "ge-range--idle"}`}
        />
        <input
          type="range"
          min={0}
          max={lastDay}
          step={1}
          value={to}
          onChange={(e) => moveTo(Number(e.target.value))}
          aria-label={t("End of the period")}
          aria-valuetext={formatDate(toIso)}
          className={`ge-range ge-range--dual absolute inset-0 ${range ? "" : "ge-range--idle"}`}
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
      <p className="mt-2 text-[11px] leading-snug text-muted">{t("Drag the two handles to choose where the period starts and ends. Play runs through it day by day.")}</p>
    </section>
  );
}
