"use client";

import { useMemo } from "react";
import type { EventSummary } from "@/data/types";
import { matchesQuery, queryTokens } from "@/lib/search";
import { dayToIso } from "@/lib/time";
import { useAppStore } from "@/store/useAppStore";

export interface VisibleEvents {
  /** Every filter applied except the change type. Feeds the per-type counts in the legend. */
  scoped: EventSummary[];
  /** Every filter applied. This is what the globe draws. */
  visible: EventSummary[];
  /** Every filter applied except the timeline period. Feeds the activity chart of the timeline. */
  timeless: EventSummary[];
}

/**
 * The single place where the timeline, the type filters and the search are applied.
 * All of it runs on the client over the list fetched once from /api/events.
 */
export function useVisibleEvents(): VisibleEvents {
  const events = useAppStore((s) => s.events);
  const meta = useAppStore((s) => s.meta);
  const timelineDay = useAppStore((s) => s.timelineDay);
  const timelineRange = useAppStore((s) => s.timelineRange);
  const activeTypes = useAppStore((s) => s.activeTypes);
  const query = useAppStore((s) => s.query);

  // The search is independent of time and type.
  const refined = useMemo(() => {
    const tokens = queryTokens(query);
    return tokens.length === 0 ? events : events.filter((e) => matchesQuery(e, tokens));
  }, [events, query]);

  // While playing: what is active on the play head's day. Otherwise: what overlaps the chosen period.
  const scoped = useMemo(() => {
    if (!meta) return refined;
    // ISO dates compare correctly as strings.
    if (timelineDay !== null) {
      const date = dayToIso(meta.timeRange, timelineDay);
      return refined.filter((e) => e.startDate <= date && date <= e.endDate);
    }
    if (timelineRange) {
      const from = dayToIso(meta.timeRange, timelineRange[0]);
      const to = dayToIso(meta.timeRange, timelineRange[1]);
      return refined.filter((e) => e.startDate <= to && from <= e.endDate);
    }
    return refined;
  }, [refined, meta, timelineDay, timelineRange]);

  const visible = useMemo(
    () => (activeTypes.length === 0 ? scoped : scoped.filter((e) => activeTypes.includes(e.type))),
    [scoped, activeTypes],
  );

  const timeless = useMemo(
    () => (activeTypes.length === 0 ? refined : refined.filter((e) => activeTypes.includes(e.type))),
    [refined, activeTypes],
  );

  return { scoped, visible, timeless };
}
