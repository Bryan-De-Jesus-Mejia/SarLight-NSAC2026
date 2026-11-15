"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useT } from "@/i18n/core";
import { TUTORIAL_STEPS } from "@/lib/tutorial";
import { useAppStore } from "@/store/useAppStore";

const LAST = TUTORIAL_STEPS.length - 1;

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="ge-demo-button">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/** Where the control a step talks about sits on screen (null while it is not there). */
function useTargetRect(target: string | undefined, step: number): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!target) return;
    let frame = 0;
    let last = "";
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      // Wrappers with display: contents have no box of their own: measure their child.
      const box = el ? (el.getBoundingClientRect().width ? el : (el.firstElementChild as HTMLElement | null)) : null;
      const r = box?.getBoundingClientRect() ?? null;
      const key = r && r.width > 0 ? `${r.x}|${r.y}|${r.width}|${r.height}` : "";
      if (key !== last) {
        last = key;
        setRect(key ? r : null);
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [target, step]);
  return target ? rect : null;
}

/** The tutorial card and the ring around the control it explains. The steps live in lib/tutorial. */
export function DemoPlayer() {
  const t = useT();
  const active = useAppStore((s) => s.demoActive);
  const step = useAppStore((s) => s.demoStep);
  const caseOpen = useAppStore((s) => s.selectedId !== null);
  const setStep = useAppStore((s) => s.setDemoStep);
  const stop = useAppStore((s) => s.stopDemo);
  const start = useAppStore((s) => s.startDemo);
  const current = TUTORIAL_STEPS[Math.min(step, LAST)];
  const rect = useTargetRect(active ? current.target : undefined, step);

  // A new step sets its scene.
  useEffect(() => {
    if (active) TUTORIAL_STEPS[Math.min(step, LAST)].enter?.();
  }, [active, step]);

  // Keyboard: arrows move through the steps, Esc closes the tour.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "Escape") stop();
      else if (event.key === "ArrowRight") setStep(Math.min(LAST, useAppStore.getState().demoStep + 1));
      else if (event.key === "ArrowLeft") setStep(Math.max(0, useAppStore.getState().demoStep - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, stop, setStep]);

  if (!active) return null;
  const last = step >= LAST;
  // The card sits away from the right-hand case panel, and away from the control it points at.
  const targetLow = rect !== null && rect.top > window.innerHeight * 0.55;

  return (
    <>
      {rect && (
        <div
          aria-hidden="true"
          className="ge-tour-ring pointer-events-none fixed z-[45] rounded-xl"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
        />
      )}
      <div
        className={`pointer-events-none fixed inset-x-3 z-[46] md:inset-x-auto md:w-[26rem] ${caseOpen ? "md:right-[29.5rem]" : "md:right-6"} ${
          targetLow ? "top-[5.5rem]" : "bottom-5"
        }`}
      >
        <section className="ge-surface ge-demo pointer-events-auto relative overflow-hidden" aria-live="polite" aria-label={t("How to use SarLight")}>
          <div className="absolute inset-x-0 top-0 flex h-[3px] gap-[2px]" aria-hidden="true">
            {TUTORIAL_STEPS.map((_, i) => (
              <span key={i} className={`h-full flex-1 ${i <= step ? "bg-accent" : "bg-white/10"}`} />
            ))}
          </div>
          <div key={step} className="ge-demo-text px-5 pb-4 pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              {t("{n} of {total}", { n: step + 1, total: TUTORIAL_STEPS.length })} · {t(current.kicker)}
            </p>
            <h2 className="mt-1.5 font-display text-[1.6rem] leading-[1.1] text-ink">{t(current.title)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">{t(current.body)}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2">
            <div className="flex items-center gap-1">
              <IconButton label={t("Back")} onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                <path d="M15 5 8 12l7 7" />
              </IconButton>
              {!last && (
                <button type="button" onClick={() => setStep(step + 1)} className="ge-demo-text-button ge-demo-text-button--primary">
                  {t("Next")}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {last ? (
                <>
                  <button type="button" onClick={start} className="ge-demo-text-button">
                    {t("Start again")}
                  </button>
                  <button type="button" onClick={stop} className="ge-demo-text-button ge-demo-text-button--primary">
                    {t("Explore")}
                  </button>
                </>
              ) : (
                <button type="button" onClick={stop} className="ge-demo-text-button">
                  {t("Close tour")}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
