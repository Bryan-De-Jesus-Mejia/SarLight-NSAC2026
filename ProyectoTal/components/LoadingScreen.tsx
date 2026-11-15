"use client";

import { useT } from "@/i18n/core";

interface LoadingScreenProps {
  /** When true the cover fades out (700 ms) and stops intercepting input. */
  done: boolean;
}

/** Full-screen cover shown until the data and the globe are both ready. */
export function LoadingScreen({ done }: LoadingScreenProps) {
  const t = useT();
  return (
    <div
      className={`ge-loader fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-void transition-opacity duration-700 ${
        done ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={done}
    >
      <div className="ge-loader-ring" aria-hidden="true" />
      <p className="font-display text-3xl italic text-ink">Dancing with the SARs</p>
      <p role="status" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
        {done ? t("Ready") : t("Acquiring radar passes")}
      </p>
    </div>
  );
}
