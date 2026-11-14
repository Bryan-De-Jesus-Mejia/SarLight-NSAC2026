"use client";

import { useNisarPasses } from "@/hooks/useNisarPasses";
import { formatDate } from "@/lib/format";
import { OVERLAYS, VALIDATED_FROM, type OverlayKind } from "@/lib/imagery";
import { useAppStore } from "@/store/useAppStore";

const CHOICES: ReadonlyArray<{ kind: OverlayKind; label: string; note: string }> = [
  { kind: "none", label: "None", note: "Planet only" },
  { kind: "radar", label: OVERLAYS.radar.label, note: OVERLAYS.radar.note },
  { kind: "water", label: OVERLAYS.water.label, note: OVERLAYS.water.note },
];

/** Real-data layers: what is drawn over the planet, and from which pass. */
export function LayersPanel({ className = "" }: { className?: string }) {
  const overlay = useAppStore((s) => s.overlay);
  const date = useAppStore((s) => s.overlayDate);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const setDate = useAppStore((s) => s.setOverlayDate);
  const passes = useNisarPasses(overlay !== "none");

  return (
    <section className={`ge-surface pointer-events-auto w-64 shrink-0 p-3 ${className}`} aria-labelledby="layers-title">
      <h2 id="layers-title" className="flex h-6 items-center px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        Real data layers
      </h2>

      <ul className="mt-2" aria-label="Layer drawn over the planet">
        {CHOICES.map(({ kind, label, note }) => (
          <li key={kind}>
            <button
              type="button"
              aria-pressed={overlay === kind}
              onClick={() => setOverlay(kind)}
              className="ge-row"
              style={{ "--row-color": "var(--color-ink)" } as React.CSSProperties}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ink">{label}</span>
                <span className="text-[11px] text-muted">{note}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {overlay !== "none" && (
        <div className="mt-2.5 border-t border-line px-1 pt-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            NISAR passes over the Dominican Republic
          </p>
          <div className="ge-scroll mt-1.5 grid max-h-36 grid-cols-2 gap-1 overflow-y-auto pr-1">
            {(passes.length ? passes : [date]).map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={day === date}
                onClick={() => setDate(day)}
                className="ge-chip"
              >
                {formatDate(day)}
                {day < VALIDATED_FROM && <span className="text-muted"> · prov.</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted">
            Black or empty areas were not imaged that day. “prov.” means the product is still being calibrated.
          </p>
        </div>
      )}

    </section>
  );
}
