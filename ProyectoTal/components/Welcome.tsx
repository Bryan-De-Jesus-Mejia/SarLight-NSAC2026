"use client";

import { useEffect, useState } from "react";
import { msg, useT } from "@/i18n/core";
import { globeApi } from "@/lib/globeApi";
import { useAppStore } from "@/store/useAppStore";

const KEY = "ge-welcome-v1";

const STEPS = [
  {
    kicker: msg("A satellite that sees in the dark"),
    title: msg("Most satellites take photos. This one listens to echoes."),
    body: msg("NISAR, from NASA and India's space agency, sends its own radio waves to the ground and listens to what comes back. Clouds, smoke and night do not stop it."),
  },
  {
    kicker: msg("Real places, real changes"),
    title: msg("Floods, wind, drought, earthquakes, melting ice."),
    body: msg("Every marker on the globe is a place we analysed with real NISAR images: from Capotillo and the Cibao to Venezuela, Punjab and Greenland. Each one has a story you can follow step by step."),
  },
];

/** First-visit welcome: two short cards, then a choice of where to start. */
export function Welcome() {
  const t = useT();
  const ready = useAppStore((s) => s.status === "ready" && s.globeReady);
  const busy = useAppStore((s) => s.demoActive || s.story || s.selectedId !== null);
  const startDemo = useAppStore((s) => s.startDemo);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("case") || params.has("story") || params.has("demo")) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(KEY) !== null;
    } catch {
      seen = false;
    }
    if (seen) return;
    const timer = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(timer);
  }, [ready]);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Private mode: the welcome comes back next time, which is fine.
    }
  };

  if (!open || busy) return null;
  const last = step >= STEPS.length;

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-[rgb(3_5_10/0.55)] p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="ge-intro glass w-full max-w-md rounded-2xl p-6">
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-white/15"}`} />
          ))}
        </div>

        {!last ? (
          <>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{t(STEPS[step].kicker)}</p>
            <h2 id="welcome-title" className="mt-2 font-display text-[1.9rem] leading-[1.08] text-ink">
              {t(STEPS[step].title)}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{t(STEPS[step].body)}</p>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={close} className="ge-link text-sm">
                {t("Skip")}
              </button>
              <button type="button" autoFocus onClick={() => setStep(step + 1)} className="ge-pill">
                {t("Next →")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{t("Where do you want to start?")}</p>
            <h2 id="welcome-title" className="mt-2 font-display text-[1.9rem] leading-[1.08] text-ink">
              {t("Pick your way in")}
            </h2>
            <div className="mt-5 grid gap-2">
              {[
                {
                  label: msg("Close to home"),
                  note: msg("Fly to the Dominican Republic and its stories"),
                  run: () => {
                    close();
                    globeApi.current?.openCountry("DOM");
                  },
                },
                {
                  label: msg("Watch the guided tour"),
                  note: msg("Two minutes, hands free"),
                  run: () => {
                    close();
                    startDemo();
                  },
                },
                { label: msg("Explore on my own"), note: msg("Drag the globe and tap any marker"), run: close },
              ].map((choice) => (
                <button key={choice.label} type="button" onClick={choice.run} className="rounded-xl border border-line px-4 py-3 text-left transition-colors hover:bg-white/[0.06]">
                  <span className="block text-[15px] font-medium text-ink">{t(choice.label)}</span>
                  <span className="block text-xs text-muted">{t(choice.note)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
