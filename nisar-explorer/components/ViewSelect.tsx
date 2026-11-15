"use client";

import { Select, type SelectOption } from "@/components/ui/Select";
import { useT } from "@/i18n/core";
import { useAppStore, type Audience } from "@/store/useAppStore";

/** One icon per reading level, shared with the menu. */
export function ViewIcon({ audience, size = 16 }: { audience: Audience; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {audience === "general" && <path d="M12 20.300s-7.300-4.400-7.300-10A4.200 4.200 0 0 1 12 7.600a4.200 4.200 0 0 1 7.300 2.700c0 5.600-7.300 10-7.300 10z" />}
      {audience === "technical" && <path d="M4 19.500h16M7 16v-5M12 16V6M17 16v-8" />}
      {audience === "student" && <path d="M3 9.500 12 5l9 4.500-9 4.500zM7 11.800V16c0 1.200 2.200 2.500 5 2.500s5-1.300 5-2.500v-4.200M21 9.500V15" />}
    </svg>
  );
}

/** The views of the app, with what each one is for. Shared by the picker and the menu. */
export function useViewOptions(): SelectOption<Audience>[] {
  const t = useT();
  return [
    { value: "general", label: t("Simple view"), hint: t("Plain words and pictures for everyone"), icon: <ViewIcon audience="general" /> },
    { value: "technical", label: t("Technical view"), hint: t("Radar figures, methods and evidence"), icon: <ViewIcon audience="technical" /> },
    { value: "student", label: t("Student view"), hint: t("Plain words, plus the classroom tools"), icon: <ViewIcon audience="student" /> },
  ];
}

/** Who is reading: simple, technical or student. The choice is remembered. */
export function ViewSelect({ className = "" }: { className?: string }) {
  const t = useT();
  const audience = useAppStore((s) => s.audience);
  const setAudience = useAppStore((s) => s.setAudience);
  const options = useViewOptions();

  return <Select value={audience} options={options} onChange={setAudience} label={t("Who is reading")} className={className} menuWidth="17rem" />;
}
