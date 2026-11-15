"use client";

import { useMemo, type CSSProperties } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import type { ChangeType } from "@/data/types";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { useT } from "@/i18n/core";
import { formatDate, formatNumber, formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

interface LegendProps {
  className?: string;
}

/**
 * Legend that doubles as the filter. With nothing selected everything is
 * shown; selecting one or more change types narrows the globe to those.
 * Only the types the data actually contains are listed.
 */
export function Legend({ className = "" }: LegendProps) {
  const t = useT();
  const events = useAppStore((s) => s.events);
  const activeTypes = useAppStore((s) => s.activeTypes);
  const toggleType = useAppStore((s) => s.toggleType);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const { scoped, visible } = useVisibleEvents();

  const total = events.length;
  const present = useMemo(
    () => CHANGE_TYPE_ORDER.filter((type) => events.some((e) => e.type === type)),
    [events],
  );

  const counts = useMemo(() => {
    const byType: Partial<Record<ChangeType, number>> = {};
    for (const event of scoped) byType[event.type] = (byType[event.type] ?? 0) + 1;
    return byType;
  }, [scoped]);

  const filtering = activeTypes.length > 0;
  const areas = useMemo(() => visible.reduce((sum, e) => (e.kind ? sum : sum + e.changedAreaKm2), 0), [visible]);

  return (
    <section className={`ge-surface pointer-events-auto w-64 shrink-0 p-3 ${className}`} aria-labelledby="legend-title">
      <div className="flex h-6 items-center justify-between px-1">
        <h2 id="legend-title" className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          {t("Radar change analyses")}
        </h2>
        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="-mr-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {t("Clear")}
          </button>
        )}
      </div>

      <ul className="mt-2" aria-label={t("Filter by what the analysis looked for")}>
        {present.map((type) => {
          const info = CHANGE_TYPES[type];
          const selected = activeTypes.includes(type);
          const dimmed = filtering && !selected;

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
                <span className="flex-1 text-ink">{t(info.label)}</span>
                <span className="font-mono text-xs tabular-nums text-muted">{counts[type] ?? 0}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Every analysed area: the same cases as the markers, reachable without the globe. */}
      <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto border-t border-line pt-2" aria-label={t("Analysed areas")}>
        {visible.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => select(event.id)}
              aria-current={event.id === selectedId}
              className="ge-case"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={event.thumb} alt="" loading="lazy" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-tight text-ink">
                  {t(event.name.replace(" analysis", ""))}
                </span>
                <span className="block truncate font-mono text-[10px] leading-snug text-muted">
                  {formatValue(event.changedAreaKm2)} km² · {formatDate(event.endDate)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-t border-line px-1 pt-2.5 text-xs leading-relaxed text-muted" aria-live="polite">
        {visible.length === total ? (
          <>{t("{total} areas analysed with NISAR and Sentinel-1 radar", { total })}</>
        ) : (
          <>
            {t("Showing")} <span className="text-ink">{visible.length}</span> {t("of {total} areas", { total })}
          </>
        )}
        {visible.length > 0 && (
          <span className="mt-0.5 block text-[11px]">
            {t("{area} km² of change flagged on land", { area: formatNumber(areas, 1) })}
          </span>
        )}
      </p>
    </section>
  );
}
