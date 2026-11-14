import type { TrailItem } from "@/store/useAppStore";

/**
 * The few things outside the globe component may ask of it (the breadcrumb
 * sends the camera back to a step). GlobeScene registers it while mounted.
 */
export interface GlobeApi {
  navigate: (item: TrailItem) => void;
}

export const globeApi: { current: GlobeApi | null } = { current: null };
