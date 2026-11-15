import type { EventSummary } from "@/data/types";

/**
 * Relative size of an event, 0–1, from the area that changed over land.
 * Log scale, because the areas span orders of magnitude: 0.05 km² maps to 0
 * and 50 km² maps to 1. Used only to size markers and weight the density view;
 * it is a display scale, never shown as a measurement.
 */
export function sizeIndex(event: Pick<EventSummary, "changedAreaKm2">): number {
  const t = Math.log10(Math.max(event.changedAreaKm2, 0.05) / 0.05) / 3;
  return Math.min(1, Math.max(0, t));
}
