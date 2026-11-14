"use client";

import { useMemo } from "react";
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
    <section className={`glass pointer-events-auto w-64 shrink-0 rounded-2xl p-3 ${className}`} aria-labelledby="legend-title">
      <div className="flex h-6 items-center justify-between px-1">
        <h2 id="legend-title" className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          Surface change signals
        </h2>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="-mr-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent transition-colors hover:bg-accent/15"
          >
            Clear
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-1" aria-label="Filter by change type">
        {CHANGE_TYPE_ORDER.map((type) => {
          const info = CHANGE_TYPES[type];
          const rgb = info.rgb.join(" ");
          const selected = activeTypes.includes(type);
          const dimmed = filteringTypes && !selected;

          return (
            <li key={type}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => toggleType(type)}
                className={`ge-filter group flex w-full items-center gap-3 rounded-xl border px-1.5 py-1.5 text-left text-sm transition-all duration-200 ${
                  dimmed ? "opacity-45 hover:opacity-80" : "opacity-100"
                }`}
                style={{
                  borderColor: selected ? `rgb(${rgb} / 0.55)` : "transparent",
                  backgroundColor: selected ? `rgb(${rgb} / 0.13)` : undefined,
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200"
                  style={{
                    color: selected ? "#06090f" : info.color,
                    borderColor: selected ? info.color : `rgb(${rgb} / 0.45)`,
                    backgroundColor: selected ? info.color : `rgb(${rgb} / 0.12)`,
                    boxShadow: selected ? `0 0 14px rgb(${rgb} / 0.55)` : undefined,
                  }}
                >
                  <ChangeTypeIcon type={type} size={15} />
                </span>
                <span className="flex-1 text-ink">{info.label}</span>
                <span className="pr-1 font-mono text-xs tabular-nums text-muted">{counts[type]}</span>
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
        <div className="mt-1.5 flex gap-1.5" role="group" aria-labelledby="legend-significance">
          {LEVELS.map(({ level, label }) => {
            const selected = activeLevels.includes(level);
            return (
              <button
                key={level}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleLevel(level)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-1.5 py-1.5 text-xs transition-colors duration-200 ${
                  selected
                    ? "border-accent/70 bg-accent/15 text-accent"
                    : "border-line text-muted hover:bg-white/5 hover:text-ink"
                }`}
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
          className="mt-2 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-xs text-ink transition-colors hover:bg-white/5"
        >
          Featured cases only
          <span
            className={`relative h-[18px] w-8 rounded-full border transition-colors duration-200 ${
              featuredOnly ? "border-accent bg-accent/80" : "border-line bg-white/10"
            }`}
            aria-hidden="true"
          >
            <span
              className={`absolute top-[2px] h-3 w-3 rounded-full transition-all duration-200 ${
                featuredOnly ? "left-[16px] bg-[#06090f]" : "left-[2px] bg-muted"
              }`}
            />
          </span>
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
