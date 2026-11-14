import type { View } from "@/lib/geo";
import type { TrailItem } from "@/store/useAppStore";

/**
 * The few things outside the globe component may ask of it (the breadcrumb
 * sends the camera back to a step). GlobeScene registers it while mounted.
 */
export interface GlobeApi {
  navigate: (item: TrailItem) => void;
  /** Fly to a view, closing any open case. `trail` sets the breadcrumb. */
  flyTo: (view: View, trail?: TrailItem[]) => void;
  /** Fly to a country by ISO code and set the breadcrumb for it. */
  openCountry: (iso: string) => void;
  /** Open a case by id, flying to it. */
  focusCase: (id: string) => boolean;
}

export const globeApi: { current: GlobeApi | null } = { current: null };
