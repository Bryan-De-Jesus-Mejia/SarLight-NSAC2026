"use client";

import { useNisarPasses } from "@/hooks/useNisarPasses";
import { useT } from "@/i18n/core";
import { formatDate } from "@/lib/format";
import { VALIDATED_FROM } from "@/lib/imagery";
import { useAppStore } from "@/store/useAppStore";

function Chips({
  days,
  value,
  onPick,
}: {
  days: string[];
  value: string | null;
  onPick: (day: string | null) => void;
}) {
  const t = useT();
  return (
    <div className="ge-scroll mt-1.5 grid max-h-28 grid-cols-2 gap-1 overflow-y-auto pr-1">
      {days.map((day) => (
        <button key={day} type="button" aria-pressed={day === value} onClick={() => onPick(day)} className="ge-chip">
          {formatDate(day)}
          {day < VALIDATED_FROM && <span className="text-muted"> · {t("prov.")}</span>}
        </button>
      ))}
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{children}</p>;
}

/** Real-data layers: the cloud lens, and the day of the camera view under it. */
export function LayersPanel({ className = "" }: { className?: string }) {
  const t = useT();
  const date = useAppStore((s) => s.overlayDate);
  const setDate = useAppStore((s) => s.setOverlayDate);
  const lens = useAppStore((s) => s.lens);
  const passes = useNisarPasses(lens);
  const days = passes.length ? passes : [date];

  return (
    <section
      className={`ge-surface ge-scroll pointer-events-auto max-h-[calc(100dvh-10rem)] w-64 shrink-0 overflow-y-auto p-3 ${className}`}
      aria-labelledby="layers-title"
    >
      <h2 id="layers-title" className="flex h-6 items-center px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {t("Cloud lens")}
      </h2>

      {/* Switched on and off by its dock button; this panel only shows while it is on. */}
      <div className="mt-2 px-1 pb-1">
        <p className="text-[11px] leading-snug text-muted">
          {t("The planet as a camera saw it that day, clouds and all. Inside the circle the clouds are lifted and the ground underneath shows: what a camera misses on a cloudy day, and what NISAR’s radar sees anyway.")}
        </p>
        {lens && (
          <div className="mt-2">
            <Heading>{t("Day")}</Heading>
            <Chips days={days} value={date} onPick={(d) => d && setDate(d)} />
            <p className="mt-2 text-[11px] leading-snug text-muted">
              {t("Camera view: NOAA-20 VIIRS true colour (NASA GIBS). Ground under the clouds: Sentinel-2 cloudless mosaic (EOX), a picture made from many clear days, not from that day.")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
