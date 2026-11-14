"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useNisarPasses } from "@/hooks/useNisarPasses";
import { formatDate } from "@/lib/format";
import { OVERLAYS, VALIDATED_FROM, type OverlayKind } from "@/lib/imagery";
import { useAppStore } from "@/store/useAppStore";

const CHOICES: ReadonlyArray<{ kind: OverlayKind; label: string; note: string }> = [
  { kind: "none", label: "None", note: "Planet only" },
  { kind: "radar", label: OVERLAYS.radar.label, note: OVERLAYS.radar.note },
  { kind: "water", label: OVERLAYS.water.label, note: OVERLAYS.water.note },
];

/**
 * What each colour of NASA's false-colour radar layer usually means. The class
 * numbers match the overlay shader (lib/imagery + components/globe/imageryEngine).
 * Source: the layer description published with NASA GIBS / Worldview.
 */
const RADAR_COLOURS: ReadonlyArray<{ klass: number; swatch: string; label: string }> = [
  { klass: 0, swatch: "#2f62e0", label: "Calm water, dry sand, frozen ground" },
  { klass: 1, swatch: "#3dcc55", label: "Vegetation" },
  { klass: 2, swatch: "#f0a93b", label: "Urban or sparse vegetation" },
  { klass: 3, swatch: "#e5484d", label: "Rough water" },
];

function Chips({
  days,
  value,
  onPick,
  first,
}: {
  days: string[];
  value: string | null;
  onPick: (day: string | null) => void;
  /** An extra first chip (the "Satellite" option of the curtain). */
  first?: string;
}) {
  return (
    <div className="ge-scroll mt-1.5 grid max-h-28 grid-cols-2 gap-1 overflow-y-auto pr-1">
      {first && (
        <button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className="ge-chip">
          {first}
        </button>
      )}
      {days.map((day) => (
        <button key={day} type="button" aria-pressed={day === value} onClick={() => onPick(day)} className="ge-chip">
          {formatDate(day)}
          {day < VALIDATED_FROM && <span className="text-muted"> · prov.</span>}
        </button>
      ))}
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{children}</p>;
}

/** Real-data layers: what is drawn over the planet, from which pass, and how to read it. */
export function LayersPanel({ className = "" }: { className?: string }) {
  const overlay = useAppStore((s) => s.overlay);
  const date = useAppStore((s) => s.overlayDate);
  const compare = useAppStore((s) => s.compare);
  const before = useAppStore((s) => s.compareBefore);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const setDate = useAppStore((s) => s.setOverlayDate);
  const setCompare = useAppStore((s) => s.setCompare);
  const setBefore = useAppStore((s) => s.setCompareBefore);
  const setRadarClass = useAppStore((s) => s.setRadarClass);
  const lens = useAppStore((s) => s.lens);
  const setLens = useAppStore((s) => s.setLens);
  const passes = useNisarPasses(overlay !== "none" || lens);
  const days = passes.length ? passes : [date];

  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const showLegend = overlay === "radar";

  // The shader highlights whichever colour is pointed at (or pinned).
  const active = showLegend ? (hovered ?? pinned) : null;
  useEffect(() => {
    setRadarClass(active);
    return () => setRadarClass(null);
  }, [active, setRadarClass]);

  return (
    <section
      className={`ge-surface ge-scroll pointer-events-auto max-h-[calc(100dvh-10rem)] w-64 shrink-0 overflow-y-auto p-3 ${className}`}
      aria-labelledby="layers-title"
    >
      <h2 id="layers-title" className="flex h-6 items-center px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        Real data layers
      </h2>

      <div className="mt-2 border-b border-line px-1 pb-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={lens}
          onClick={() => setLens(!lens)}
          className="flex w-full items-center justify-between rounded text-left text-xs text-ink"
        >
          Radar lens
          <span className="ge-switch" data-on={lens} aria-hidden="true" />
        </button>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">
          The planet as a camera saw it that day, clouds and all. Inside the circle, the NISAR radar of the same day.
        </p>
        {lens && (
          <div className="mt-2">
            <Heading>Day</Heading>
            <Chips days={days} value={date} onPick={(d) => d && setDate(d)} />
            <p className="mt-2 text-[11px] leading-snug text-muted">
              Camera view: NOAA-20 VIIRS true colour (NASA GIBS). Where the circle stays empty, NISAR did not pass that day.
            </p>
          </div>
        )}
      </div>

      <ul className="mt-2" aria-label="Layer drawn over the planet">
        {CHOICES.map(({ kind, label, note }) => (
          <li key={kind}>
            <button
              type="button"
              aria-pressed={overlay === kind}
              onClick={() => setOverlay(kind)}
              className="ge-row"
              style={{ "--row-color": "var(--color-ink)" } as CSSProperties}
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
        <div className="mt-2.5 space-y-2.5 border-t border-line px-1 pt-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={compare}
            onClick={() => setCompare(!compare)}
            className="flex w-full items-center justify-between rounded text-left text-xs text-ink"
          >
            Compare with a curtain
            <span className="ge-switch" data-on={compare} aria-hidden="true" />
          </button>

          {compare ? (
            <>
              <div>
                <Heading>Before (left)</Heading>
                <Chips days={days} value={before} onPick={setBefore} first="Satellite" />
              </div>
              <div>
                <Heading>After (right)</Heading>
                <Chips days={days} value={date} onPick={(d) => d && setDate(d)} />
              </div>
              <p className="text-[11px] leading-snug text-muted">
                Drag the line across the map. Dates 12 days apart usually share an orbit, which makes the cleanest comparison.
              </p>
            </>
          ) : (
            <div>
              <Heading>NISAR passes over the Dominican Republic</Heading>
              <Chips days={days} value={date} onPick={(d) => d && setDate(d)} />
              <p className="mt-2 text-[11px] leading-snug text-muted">
                Black or empty areas were not imaged that day. “prov.” means the product is still being calibrated.
              </p>
            </div>
          )}

          {showLegend && (
            <div>
              <Heading>What the colours mean</Heading>
              <ul className="mt-1.5" onMouseLeave={() => setHovered(null)}>
                {RADAR_COLOURS.map(({ klass, swatch, label }) => (
                  <li key={klass}>
                    <button
                      type="button"
                      aria-pressed={pinned === klass}
                      onMouseEnter={() => setHovered(klass)}
                      onFocus={() => setHovered(klass)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setPinned(pinned === klass ? null : klass)}
                      className="ge-row"
                      style={{ "--row-color": swatch } as CSSProperties}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} aria-hidden="true" />
                      <span className="text-xs leading-snug text-ink">{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] leading-snug text-muted">
                Point at a colour to light it up on the map; click to keep it. A false-colour mix of the radar&rsquo;s
                polarizations: different land covers can look alike.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
