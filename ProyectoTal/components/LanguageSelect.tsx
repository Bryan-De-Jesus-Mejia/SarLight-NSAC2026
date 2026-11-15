"use client";

import { Select, type SelectOption } from "@/components/ui/Select";
import { LANGS, useLang, useLangStore, useT, type Lang } from "@/i18n/core";

const LABEL: Record<Lang, string> = { en: "EN", es: "ES" };
const NAME: Record<Lang, string> = { en: "English", es: "Español" };

const OPTIONS: SelectOption<Lang>[] = LANGS.map((code) => ({
  value: code,
  label: NAME[code],
  short: LABEL[code],
}));

export function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.500" />
      <path d="M3.500 12h17M12 3.500c2.300 2.400 3.400 5.200 3.400 8.500s-1.100 6.100-3.400 8.500c-2.300-2.400-3.400-5.200-3.400-8.500S9.700 5.900 12 3.500z" />
    </svg>
  );
}

/** Language picker. The choice is remembered. */
export function LanguageSelect({ className = "" }: { className?: string }) {
  const t = useT();
  const lang = useLang();
  const setLang = useLangStore((s) => s.setLang);

  return <Select value={lang} options={OPTIONS} onChange={setLang} label={t("Language")} icon={<GlobeIcon />} className={className} menuWidth="11rem" />;
}
