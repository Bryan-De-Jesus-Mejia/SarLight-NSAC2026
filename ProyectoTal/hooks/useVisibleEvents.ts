"use client";

import { useMemo } from "react";
import type { EventSummary } from "@/data/types";
import { dayToIso } from "@/lib/time";
import { useAppStore } from "@/store/useAppStore";

export interface VisibleEvents {
  /** Signals active on the timeline date (every type). All signals when the timeline is off. */
  inTime: EventSummary[];
  /** `inTime` narrowed to the selected change types. This is what the globe draws. */
  visible: EventSummary[];
}

/**
 * The single place where the timeline and the type filters are applied.
 * Both run on the client over the list fetched once from /api/events.
 */
export function useVisibleEvents(): VisibleEvents {
  const events = useAppStore((s) => s.events);
  const meta = useAppStore((s) => s.meta);
  const timelineDay = useAppStore((s) => s.timelineDay);
  const activeTypes = useAppStore((s) => s.activeTypes);

  const inTime = useMemo(() => {
    if (timelineDay === null || !meta) return events;
    // ISO dates compare correctly as strings.
    const date = dayToIso(meta.timeRange, timelineDay);
    return events.filter((e) => e.startDate <= date && date <= e.endDate);
  }, [events, meta, timelineDay]);

  const visible = useMemo(
    () => (activeTypes.length === 0 ? inTime : inTime.filter((e) => activeTypes.includes(e.type))),
    [inTime, activeTypes],
  );

  return { inTime, visible };
}
