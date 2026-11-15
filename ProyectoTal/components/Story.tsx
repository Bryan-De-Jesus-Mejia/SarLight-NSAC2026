"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { BackscatterChart } from "@/components/panel/BackscatterChart";
import { HYPOTHESES } from "@/components/panel/Evidence";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType, EventDetail, SensorAnalysis } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";
import { globeApi } from "@/lib/globeApi";
import { buildExtraSteps } from "@/components/storyExtra";
import { useAppStore } from "@/store/useAppStore";

/**
 * Story mode: one case told as a scroll. Each step moves the camera and
 * changes the radar image laid on the globe, then says one thing about it.
 * Every number comes from the analysis; nothing is written by hand per case.
 */

/** Camera altitudes (globe radii). */
const WIDE = 0.42;
const MID = 0.034;
const CLOSE = 0.019;
const FRAME_MS = 1100;
const DAY_MS = 86_400_000;

const day = (iso: string): string => iso.slice(0, 10);
const km = (v: number): string => formatValue(v);
const signed = (v: number): string => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const pct = (v: number): string => v.toLocaleString("en-US", { maximumFractionDigits: 1 });

const LOOKING_FOR: Partial<Record<ChangeType, string>> = {
  wildfire:
    "We went looking for the mark a fire leaves. When leaves and branches are gone, so is the radar echo they used to send back.",
  flood:
    "We went looking for water where there was land. A flooded field turns from rough to mirror-smooth, and its echo collapses.",
};

interface Step {
  key: string;
  kicker: string;
  title: string;
  body: ReactNode;
  /** A large figure shown above the text. */
  figure?: { value: string; unit: string; note: string };
  extra?: ReactNode;
  /** Runs when the step becomes the current one. May return a clean-up. */
  enter: () => void | (() => void);
}

function buildSteps(
  detail: EventDetail,
  a: SensorAnalysis,
  setDrape: (image: { url: string; opacity: number } | null) => void,
  setFrameDate: (date: string | null) => void,
  color: string,
): Step[] {
  const before = formatDate(day(a.pre.date));
  const after = formatDate(day(a.post.date));
  const span = Math.round((Date.parse(day(a.post.date)) - Date.parse(day(a.pre.date))) / DAY_MS);
  const sensor = a.sensor === "nisar" ? "NISAR" : "Sentinel-1";
  const show = (url: string, altitude: number, opacity = 1) => () => {
    setDrape({ url, opacity });
    globeApi.current?.frameCase(altitude);
  };

  const pre = a.series.find((p) => p.date === day(a.pre.date));
  const post = a.series.find((p) => p.date === day(a.post.date));
  const inside = pre?.insideDb != null && post?.insideDb != null ? post.insideDb - pre.insideDb : null;
  const outside = pre?.outsideDb != null && post?.outsideDb != null ? post.outsideDb - pre.outsideDb : null;
  const frames = a.series.filter((p) => p.frame !== null);
  const standout = a.landCover?.classes
    .filter((c) => c.flaggedPct >= 10 && c.scenePct > 0 && c.code !== 80)
    .map((c) => ({ c, lift: c.flaggedPct / c.scenePct }))
    .sort((p, q) => q.lift - p.lift)[0];
  const top = a.landCover?.classes[0];
  const other = a.polarisations.find((r) => !r.analysed);
  const main = a.polarisations.find((r) => r.analysed);
  const hypotheses = HYPOTHESES[detail.type] ?? [];

  const steps: Step[] = [
    {
      key: "place",
      kicker: "The place",
      title: detail.name.replace(" analysis", ""),
      body: (
        <>
          <p>
            {detail.region}, {detail.country}. {LOOKING_FOR[detail.type] ?? "We compared two radar passes over this area."}
          </p>
          <p className="mt-3 text-muted">Scroll, or press Next, to follow what the radar saw.</p>
        </>
      ),
      enter: () => {
        setDrape(null);
        globeApi.current?.frameCase(WIDE);
      },
    },
    {
      key: "before",
      kicker: `Before · ${before}`,
      title: "The first look",
      body: (
        <p>
          On {before}, {sensor} imaged these {km(a.land.validAreaKm2)} km² of land in the {a.pol} channel. Bright is
          rough: forest, crops, buildings. Dark is smooth: calm water, bare flat ground.
        </p>
      ),
      enter: show(a.images.pre, MID),
    },
    {
      key: "after",
      kicker: `After · ${after}`,
      title: `${span} days later`,
      body: (
        <p>
          The same satellite, on the same track, looked again. To the eye almost nothing moved. That is the point: the
          change hides in the numbers, not in the picture.
        </p>
      ),
      enter: show(a.images.post, MID),
    },
    {
      key: "difference",
      kicker: "The difference",
      title: "Subtract one from the other",
      figure: {
        value: km(a.land.changedAreaKm2),
        unit: "km²",
        note: `of land changed by at least ${a.method.thresholdDb} dB`,
      },
      body: (
        <p>
          Red is where the echo got weaker, blue where it got stronger. Three decibels is about half, or double, the
          energy. It weakened over {km(a.land.decreaseAreaKm2)} km² and strengthened over{" "}
          {km(a.land.increaseAreaKm2)} km².
        </p>
      ),
      enter: show(a.images.diff, MID, 0.94),
    },
    {
      key: "flagged",
      kicker: "Is it real?",
      title: "Only the flagged land moved",
      figure:
        inside !== null
          ? { value: signed(inside), unit: "dB", note: `on the flagged land · ${outside !== null ? signed(outside) : "—"} dB everywhere else` }
          : undefined,
      body: (
        <>
          <p>
            {inside !== null && outside !== null
              ? Math.abs(inside) >= 3 * Math.max(Math.abs(outside), 0.2)
                ? "If rain, season or calibration had shifted the whole scene, the rest of the land would have moved too. It did not."
                : "The rest of the land moved by a comparable amount, so part of this may be scene-wide and not a local event."
              : "The flagged pixels are drawn over the after image."}
          </p>
          {a.baseline && (
            <p className="mt-3">
              With {a.baseline.passes} passes of this track, {pct(a.baseline.beyond3SigmaPct)}% of the flagged land moved
              more than 3 times what those pixels normally do from one pass to the next.
            </p>
          )}
        </>
      ),
      extra: <BackscatterChart analysis={a} color={color} />,
      enter: show(a.images.change, CLOSE),
    },
  ];

  if (frames.length > 1) {
    steps.push({
      key: "time",
      kicker: "Through time",
      title: "Every pass of the track",
      body: (
        <p>
          {frames.length} passes in false colour, from {formatDate(frames[0].date)} to{" "}
          {formatDate(frames[frames.length - 1].date)}. Green and yellow are dense vegetation, purple and blue are bare
          ground and low crops, black is calm water. Watch for patches that switch colour.
        </p>
      ),
      enter: () => {
        globeApi.current?.frameCase(CLOSE);
        let i = 0;
        const paint = () => {
          const f = frames[i % frames.length];
          if (f.frame) setDrape({ url: f.frame, opacity: 1 });
          setFrameDate(f.date);
          i += 1;
        };
        paint();
        const timer = setInterval(paint, FRAME_MS);
        return () => {
          clearInterval(timer);
          setFrameDate(null);
        };
      },
    });
  }

  if (top) {
    steps.push({
      key: "ground",
      kicker: "What was there",
      title: standout && standout.lift >= 1.5 ? `Mostly ${standout.c.label.toLowerCase()}` : `Mostly ${top.label.toLowerCase()}`,
      figure:
        standout && standout.lift >= 1.5
          ? { value: `${standout.lift.toFixed(1)}×`, unit: "", note: `${standout.c.label.toLowerCase()} is over-represented in what changed` }
          : undefined,
      body: (
        <>
          <p>
            {standout && standout.lift >= 1.5
              ? `${standout.c.label} covers ${pct(standout.c.scenePct)}% of the land here, but ${pct(standout.c.flaggedPct)}% of the land that changed.`
              : `${pct(top.flaggedPct)}% of the flagged land is ${top.label.toLowerCase()}, close to its share of the whole area (${pct(top.scenePct)}%).`}{" "}
            That comes from a 2021 land-cover map, so the ground may have changed since.
          </p>
          {main && other && (
            <p className="mt-3">
              The {main.pol} channel flags {km(main.flaggedAreaKm2)} km²; {other.pol} flags {km(other.flaggedAreaKm2)} km²
              for the same two passes.
            </p>
          )}
        </>
      ),
      enter: show(a.images.change, MID),
    });
  }

  steps.push({
    key: "why",
    kicker: "What could explain it",
    title: "Leads, not conclusions",
    body: (
      <>
        <ol className="space-y-2.5">
          {hypotheses.map((h, i) => (
            <li key={h.cause} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-muted">
                {i + 1}
              </span>
              <span>
                {h.cause}
                <span className="mt-0.5 block text-xs text-muted">To check: {h.check}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-muted">Radar shows what changed, not why. None of this has been verified on the ground.</p>
      </>
    ),
    enter: show(a.images.post, MID),
  });

  return steps;
}

export function Story() {
  const on = useAppStore((s) => s.story);
  const setStory = useAppStore((s) => s.setStory);
  const setDrape = useAppStore((s) => s.setDrape);
  const selectedId = useAppStore((s) => s.selectedId);
  const detail = useAppStore((s) => (s.detail && s.detail.id === s.selectedId ? s.detail : null));
  const events = useAppStore((s) => s.events);
  const select = useAppStore((s) => s.select);

  const [active, setActive] = useState(0);
  const [frameDate, setFrameDate] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const analysis = detail?.analyses[0] ?? null;
  const color = detail ? CHANGE_TYPES[detail.type].color : "#f2b866";
  const steps = useMemo(
    () => {
      if (!on || !detail) return [];
      if (detail.extra) return buildExtraSteps(detail, detail.extra, setDrape);
      return analysis ? buildSteps(detail, analysis, setDrape, setFrameDate, color) : [];
    },
    [on, detail, analysis, setDrape, color],
  );

  // A story needs an open case.
  useEffect(() => {
    if (on && selectedId === null) setStory(false);
  }, [on, selectedId, setStory]);

  // Which step is in view: the one whose middle is closest to the middle of the column.
  useEffect(() => {
    const root = scrollRef.current;
    if (!on || !root || steps.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const middle = root.scrollTop + root.clientHeight / 2;
      let best = 0;
      let bestGap = Infinity;
      stepRefs.current.slice(0, steps.length).forEach((el, i) => {
        if (!el) return;
        const gap = Math.abs(el.offsetTop + el.offsetHeight / 2 - middle);
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
    };
  }, [on, steps.length]);

  // Entering a step moves the camera and changes the image on the globe.
  useEffect(() => {
    const step = steps[Math.min(active, steps.length - 1)];
    if (!on || !step) return;
    // Let the camera of the opening flight settle before the first step takes over.
    let cleanup: void | (() => void);
    const timer = setTimeout(() => {
      cleanup = step.enter();
    }, 280);
    return () => {
      clearTimeout(timer);
      if (cleanup) cleanup();
    };
  }, [on, active, steps]);

  // Leaving the story: back to the case panel, at its usual distance.
  const exit = () => {
    setStory(false);
    globeApi.current?.frameCase(0.085);
  };

  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      useAppStore.getState().setStory(false);
      globeApi.current?.frameCase(0.085);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [on]);

  if (!on) return null;

  const go = (index: number) => stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  const position = events.findIndex((e) => e.id === selectedId);
  const nextCase = position >= 0 && events.length > 1 ? events[(position + 1) % events.length] : null;

  const openNext = () => {
    if (!nextCase) return;
    scrollRef.current?.scrollTo({ top: 0 });
    setActive(0);
    select(nextCase.id);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* Top bar */}
      <div className="pointer-events-auto absolute right-4 top-4 z-10 flex w-[min(27rem,calc(100vw-2rem))] items-center gap-3 md:right-5 md:top-5">
        <div className="ge-surface flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2">
          {detail && (
            <span style={{ color }} className="shrink-0">
              <ChangeTypeIcon type={detail.type} size={16} />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
            Story · {detail ? detail.name.replace(" analysis", "") : "loading"}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted">
            {steps.length ? `${Math.min(active + 1, steps.length)} / ${steps.length}` : ""}
          </span>
        </div>
        <button type="button" onClick={exit} className="ge-surface shrink-0 px-3 py-2 text-xs text-ink transition-colors hover:text-accent">
          Exit story
        </button>
      </div>

      {/* Progress rail */}
      {steps.length > 0 && (
        <div className="pointer-events-auto absolute right-[calc(min(27rem,100vw-2rem)+1.75rem)] top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-2 md:flex">
          {steps.map((step, i) => (
            <button
              key={step.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`Step ${i + 1}: ${step.kicker}`}
              aria-current={i === active}
              className={`h-2 w-2 rounded-full transition-all ${i === active ? "scale-150 bg-accent" : "bg-white/35 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}

      {/* The scroll */}
      <div
        ref={scrollRef}
        className="ge-story pointer-events-auto absolute inset-y-0 right-0 w-full overflow-y-auto md:w-[29.5rem]"
        tabIndex={0}
        aria-label="Story"
      >
        {steps.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5">
            <p role="status" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Loading the analysis
            </p>
          </div>
        ) : (
          steps.map((step, i) => (
            <section
              key={step.key}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex min-h-[100dvh] items-end px-4 pb-8 pt-24 md:items-center md:px-5 md:pb-0 md:pt-0"
              aria-current={i === active ? "step" : undefined}
            >
              <article
                className={`glass w-full rounded-2xl p-5 transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-40"}`}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color }}>
                  {String(i + 1).padStart(2, "0")} · {step.kicker}
                </p>
                <h2 className="mt-1.5 font-display text-[2rem] leading-[1.05] text-ink">{step.title}</h2>

                {step.figure && (
                  <p className="mt-4">
                    <span className="font-display text-6xl leading-none text-ink">{step.figure.value}</span>
                    {step.figure.unit && <span className="ml-1.5 text-xl text-muted">{step.figure.unit}</span>}
                    <span className="mt-1 block text-xs text-muted">{step.figure.note}</span>
                  </p>
                )}

                <div className="mt-4 text-[15px] leading-relaxed text-ink/90">{step.body}</div>

                {step.key === "time" && frameDate && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-xs text-ink">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
                    {formatDate(frameDate)}
                  </p>
                )}

                {step.extra && i === active && <div className="mt-4">{step.extra}</div>}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {i < steps.length - 1 ? (
                    <button type="button" onClick={() => go(i + 1)} className="ge-pill">
                      Next ↓
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={exit} className="ge-pill">
                        Open the full analysis
                      </button>
                      {nextCase && (
                        <button type="button" onClick={openNext} className="ge-pill">
                          Next story: {nextCase.name.replace(" analysis", "")} →
                        </button>
                      )}
                    </>
                  )}
                  {i > 0 && (
                    <button type="button" onClick={() => go(i - 1)} className="ge-link text-xs">
                      Back
                    </button>
                  )}
                </div>
              </article>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
