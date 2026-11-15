"use client";

import { useEffect, useState } from "react";
import { LANGS, msg, translate, useLangStore, useT, type Lang } from "@/i18n/core";
import { useAppStore } from "@/store/useAppStore";

const KEY = "ge-welcome-v1";

const INTRO = {
  kicker: msg("A satellite that sees in the dark"),
  title: msg("Most satellites take photos. This one listens to echoes."),
  body: msg("NISAR, from NASA and India's space agency, sends its own radio waves to the ground and listens to what comes back. Clouds, smoke and night do not stop it."),
};

/** Asked before the visitor has picked a language, so it shows in both. */
const CHOOSE = msg("Choose your language");
const LANG_NAME: Record<Lang, string> = { en: "English", es: "Español" };
const STEP_COUNT = 3;

/** First-visit welcome: the language, one card about the satellite, then the tutorial for those who want it. */
export function Welcome() {
  const t = useT();
  const ready = useAppStore((s) => s.status === "ready" && s.globeReady);
  const busy = useAppStore((s) => s.demoActive || s.story || s.selectedId !== null);
  const startDemo = useAppStore((s) => s.startDemo);
  const setLang = useLangStore((s) => s.setLang);
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

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-[rgb(4_4_6/0.55)] p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="ge-intro glass w-full max-w-md rounded-2xl p-6">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-white/15"}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">SarLight</p>
            <h2 id="welcome-title" className="mt-2 font-display text-[1.9rem] leading-[1.08] text-ink">
              {translate("en", CHOOSE)}
              <span className="block text-muted">{translate("es", CHOOSE)}</span>
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  autoFocus={code === "en"}
                  onClick={() => {
                    setLang(code);
                    setStep(1);
                  }}
                  className="rounded-xl border border-line px-4 py-3 text-center text-[15px] font-medium text-ink transition-colors hover:bg-white/[0.06]"
                >
                  {LANG_NAME[code]}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{t(INTRO.kicker)}</p>
            <h2 id="welcome-title" className="mt-2 font-display text-[1.9rem] leading-[1.08] text-ink">
              {t(INTRO.title)}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/85">{t(INTRO.body)}</p>
            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={close} className="ge-link text-sm">
                {t("Skip")}
              </button>
              <button type="button" autoFocus onClick={() => setStep(2)} className="ge-pill">
                {t("Next →")}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{t("Before you start")}</p>
            <h2 id="welcome-title" className="mt-2 font-display text-[1.9rem] leading-[1.08] text-ink">
              {t("Do you know how to use the globe?")}
            </h2>
            <div className="mt-5 grid gap-2">
              {[
                { label: msg("Yes, let me explore"), note: msg("Drag the globe and tap any marker"), run: close },
                {
                  label: msg("No, show me how"),
                  note: msg("A short tutorial of every control, at your own pace"),
                  run: () => {
                    close();
                    startDemo();
                  },
                },
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
