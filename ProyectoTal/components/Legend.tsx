"use client";

import { useMemo, type CSSProperties } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { SignificanceMeter } from "@/components/icons/SignificanceMeter";
import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import type { ChangeType, SignificanceLevel } from "@/data/types";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { useAppStore } from "@/store/useAppStore";

interface LegendProps {
  className?: string;
}

const LEVELS: readonly { level: SignificanceLevel; label: string }[] = [
  { level: "low", label: "Low" },
  { level: "medium", label: "Medium" },
  { level: "high", label: "High" },
];

/**
 * Legend that doubles as the filter panel. With nothing selected everything
 * is shown; selecting change types or significance levels narrows the globe.
 */
export function Legend({ className = "" }: LegendProps) {
  const total = useAppStore((s) => s.events.length);
  const activeTypes = useAppStore((s) => s.activeTypes);
  const activeLevels = useAppStore((s) => s.activeLevels);
  const featuredOnly = useAppStore((s) => s.featuredOnly);
  const toggleType = useAppStore((s) => s.toggleType);
  const toggleLevel = useAppStore((s) => s.toggleLevel);
  const setFeaturedOnly = useAppStore((s) => s.setFeaturedOnly);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const { scoped, visible } = useVisibleEvents();

  const counts = useMemo(() => {
    const byType: Record<ChangeType, number> = {
      wetland: 0,
      glacier: 0,
      wildfire: 0,
      earthquake: 0,
      agriculture: 0,
      deformation: 0,
    };
    for (const event of scoped) byType[event.type] += 1;
    return byType;
  }, [scoped]);

  const featuredVisible = useMemo(() => visible.filter((e) => e.featured).length, [visible]);
  const filteringTypes = activeTypes.length > 0;
  const filtering = filteringTypes || activeLevels.length > 0 || featuredOnly;

  return (
    <section className={`ge-surface pointer-events-auto w-64 shrink-0 p-3 ${className}`} aria-labelledby="legend-title">
      <div className="flex h-6 items-center justify-between px-1">
        <h2 id="legend-title" className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          Surface change signals
        </h2>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="-mr-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <ul className="mt-2" aria-label="Filter by change type">
        {CHANGE_TYPE_ORDER.map((type) => {
          const info = CHANGE_TYPES[type];
          const selected = activeTypes.includes(type);
          const dimmed = filteringTypes && !selected;

          return (
            <li key={type}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => toggleType(type)}
                className={`ge-row ${dimmed ? "opacity-40 hover:opacity-80" : ""}`}
                style={{ "--row-color": info.color } as CSSProperties}
              >
                <span className="flex w-5 shrink-0 justify-center" style={{ color: info.color }}>
                  <ChangeTypeIcon type={type} size={16} />
                </span>
                <span className="flex-1 text-ink">{info.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted">{counts[type]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Refine: hidden on phones for now, where vertical space is scarce. */}
      <div className="mt-2.5 border-t border-line px-1 pt-2.5 max-md:hidden">
        <p id="legend-significance" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Significance
        </p>
        <div className="ge-segments mt-1.5" role="group" aria-labelledby="legend-significance">
          {LEVELS.map(({ level, label }) => {
            const selected = activeLevels.includes(level);
            return (
              <button
                key={level}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleLevel(level)}
                className="ge-segment"
              >
                <SignificanceMeter level={level} />
                {label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={featuredOnly}
          onClick={() => setFeaturedOnly(!featuredOnly)}
          className="mt-2 flex w-full items-center justify-between rounded px-1 py-1.5 text-left text-xs text-ink transition-colors hover:bg-white/5"
        >
          Featured cases only
          <span className="ge-switch" data-on={featuredOnly} aria-hidden="true" />
        </button>
      </div>

      <p className="mt-2 border-t border-line px-1 pt-2.5 text-xs leading-relaxed text-muted" aria-live="polite">
        {visible.length === total ? (
          <>
            {total} signals · {featuredVisible} featured cases with pulsing rings
          </>
        ) : (
          <>
            Showing <span className="text-ink">{visible.length}</span> of {total} signals ·{" "}
            {featuredVisible} featured
          </>
        )}
      </p>
    </section>
  );
}
