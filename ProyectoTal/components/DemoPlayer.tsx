"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { DEMO_SCENES } from "@/lib/demoScript";
import { useAppStore } from "@/store/useAppStore";

const LAST = DEMO_SCENES.length - 1;
const TICK_MS = 100;

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="ge-demo-button">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/** Captions and controls of the guided demo. The scenes themselves live in lib/demoScript. */
export function DemoPlayer() {
  const active = useAppStore((s) => s.demoActive);
  const step = useAppStore((s) => s.demoStep);
  const paused = useAppStore((s) => s.demoPaused);
  const caseOpen = useAppStore((s) => s.selectedId !== null);
  const setStep = useAppStore((s) => s.setDemoStep);
  const setPaused = useAppStore((s) => s.setDemoPaused);
  const stop = useAppStore((s) => s.stopDemo);
  const start = useAppStore((s) => s.startDemo);

  const elapsed = useRef(0);
  const fired = useRef<Set<number>>(new Set());
  const bar = useRef<HTMLDivElement | null>(null);

  // A new scene: reset the clock and run its opening action.
  useEffect(() => {
    if (!active) return;
    elapsed.current = 0;
    fired.current = new Set();
    if (bar.current) bar.current.style.transform = "scaleX(0)";
    DEMO_SCENES[step].enter();
  }, [active, step]);

  // The clock: advances the scene, fires its cues and moves on at the end.
  useEffect(() => {
    if (!active) return;
    const scene = DEMO_SCENES[step];
    const timer = setInterval(() => {
      if (useAppStore.getState().demoPaused) return;
      elapsed.current += TICK_MS;
      scene.cues?.forEach((cue, index) => {
        if (elapsed.current >= cue.at && !fired.current.has(index)) {
          fired.current.add(index);
          cue.run();
        }
      });
      if (Number.isFinite(scene.ms)) {
        if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, elapsed.current / scene.ms)})`;
        if (elapsed.current >= scene.ms && step < LAST) setStep(step + 1);
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, step, setStep]);

  // Keyboard, and grabbing the globe takes the controls back.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "Escape") stop();
      else if (event.key === " ") {
        event.preventDefault();
        setPaused(!useAppStore.getState().demoPaused);
      } else if (event.key === "ArrowRight") setStep(Math.min(LAST, useAppStore.getState().demoStep + 1));
      else if (event.key === "ArrowLeft") setStep(Math.max(0, useAppStore.getState().demoStep - 1));
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("canvas")) setPaused(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [active, stop, setPaused, setStep]);

  if (!active) return null;
  const scene = DEMO_SCENES[step];
  const last = step === LAST;

  return (
    <div
      className={`pointer-events-none absolute inset-x-5 bottom-5 z-20 max-md:top-auto ${caseOpen ? "md:right-[28.5rem]" : ""} ${caseOpen ? "max-md:bottom-auto max-md:top-[5.5rem]" : ""}`}
    >
      <section className="ge-surface ge-demo pointer-events-auto relative mx-auto max-w-xl overflow-hidden" aria-live="polite" aria-label="Guided demo">
        {!last && (
          <div className="absolute inset-x-0 top-0 h-[2px] bg-white/10">
            <div ref={bar} className="h-full origin-left bg-accent" style={{ transform: "scaleX(0)", transition: `transform ${TICK_MS}ms linear` }} />
          </div>
        )}
        <div key={step} className="ge-demo-text px-5 pb-4 pt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">{scene.kicker}</p>
          <h2 className="mt-1.5 font-display text-[1.7rem] leading-[1.1] text-ink">{scene.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/80">{scene.body}</p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
          <div className="flex items-center gap-1">
            <IconButton label="Previous scene" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <path d="M15 5 8 12l7 7" />
            </IconButton>
            {!last && (
              <IconButton label={paused ? "Play" : "Pause"} onClick={() => setPaused(!paused)}>
                {paused ? <path d="M8 5.5v13l10-6.5z" /> : <path d="M8 5.5v13M16 5.5v13" />}
              </IconButton>
            )}
            <IconButton label="Next scene" onClick={() => setStep(Math.min(LAST, step + 1))} disabled={last}>
              <path d="m9 5 7 7-7 7" />
            </IconButton>
          </div>
          <div className="flex items-center gap-2">
            {last ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPaused(false);
                    start();
                  }}
                  className="ge-demo-text-button"
                >
                  Replay
                </button>
                <button type="button" onClick={stop} className="ge-demo-text-button ge-demo-text-button--primary">
                  Explore
                </button>
              </>
            ) : (
              <button type="button" onClick={stop} className="ge-demo-text-button">
                Exit demo
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
