"use client";

import { LANGS, useLang, useLangStore, useT, type Lang } from "@/i18n/core";

const LABEL: Record<Lang, string> = { en: "EN", es: "ES" };
const NAME: Record<Lang, string> = { en: "English", es: "Español" };

/** Segmented ES | EN switch. The choice is remembered. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const t = useT();
  const lang = useLang();
  const setLang = useLangStore((s) => s.setLang);

  return (
    <div
      className={`ge-surface pointer-events-auto flex h-10 shrink-0 overflow-hidden ${className}`}
      role="group"
      aria-label={t("Language")}
    >
      {LANGS.map((code, i) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          title={NAME[code]}
          onClick={() => setLang(code)}
          className={`flex w-10 items-center justify-center font-mono text-[11px] tracking-[0.08em] transition-colors hover:text-accent ${
            i > 0 ? "border-l border-line" : ""
          } ${lang === code ? "bg-white/10 text-accent" : "text-muted"}`}
        >
          {LABEL[code]}
          <span className="sr-only"> {NAME[code]}</span>
        </button>
      ))}
    </div>
  );
}
