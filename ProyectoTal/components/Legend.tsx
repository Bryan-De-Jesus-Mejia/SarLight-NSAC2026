"use client";

import { useMemo } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import type { ChangeType } from "@/data/types";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { useAppStore } from "@/store/useAppStore";

interface LegendProps {
  className?: string;
}

/**
 * Legend that doubles as the type filter. Nothing selected means everything
 * is shown; selecting one or more types narrows the globe to those.
 */
export function Legend({ className = "" }: LegendProps) {
  const total = useAppStore((s) => s.events.length);
  const activeTypes = useAppStore((s) => s.activeTypes);
  const toggleType = useAppStore((s) => s.toggleType);
  const clearTypes = useAppStore((s) => s.clearTypes);
  const { inTime, visible } = useVisibleEvents();

  const counts = useMemo(() => {
    const byType: Record<ChangeType, number> = {
      wetland: 0,
      glacier: 0,
      wildfire: 0,
      earthquake: 0,
      agriculture: 0,
      deformation: 0,
    };
    for (const event of inTime) byType[event.type] += 1;
    return byType;
  }, [inTime]);

  const featuredVisible = useMemo(() => visible.filter((e) => e.featured).length, [visible]);
  const filtering = activeTypes.length > 0;

  return (
    <section className={`glass pointer-events-auto w-64 shrink-0 rounded-2xl p-3 ${className}`} aria-labelledby="legend-title">
      <div className="flex h-6 items-center justify-between px-1">
        <h2 id="legend-title" className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Surface change signals
        </h2>
        {filtering && (
          <button
            type="button"
            onClick={clearTypes}
            className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent/15"
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
          const dimmed = filtering && !selected;

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

      <p className="mt-2.5 border-t border-line px-1 pt-2.5 text-xs leading-relaxed text-muted" aria-live="polite">
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
        {!filtering && <span className="mt-0.5 block text-[11px] text-muted/80">Select types to filter the globe.</span>}
      </p>
    </section>
  );
}
