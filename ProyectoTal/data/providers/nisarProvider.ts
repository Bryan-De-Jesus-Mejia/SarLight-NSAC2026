import type {
  DataProvider,
  EventDetail,
  EventFilters,
  EventSummary,
  TimeRange,
} from "../types";

/**
 * Real-data provider — empty skeleton. Selected with DATA_SOURCE=nisar.
 *
 * TODO(auth): Earthdata Login. Read the bearer token from a server-only env
 *   variable (e.g. EARTHDATA_TOKEN). It must never reach the client bundle:
 *   this module is only ever imported from route handlers.
 *
 * TODO(discovery): Find granules through NASA CMR (collection + bounding box
 *   + temporal search) and/or the ASF DAAC search API, which hosts NISAR.
 *
 * TODO(products): Map NISAR Level-2 products to change types:
 *   - GCOV (geocoded polarimetric covariance) → backscatter change
 *     (wetlands, wildfire, agriculture).
 *   - GUNW (geocoded unwrapped interferogram) → line-of-sight displacement
 *     (earthquakes, land deformation).
 *   - GOFF (geocoded pixel offsets)           → ice flow (glaciers).
 *
 * TODO(preprocessing): NISAR granules are multi-gigabyte HDF5 files. Reduce
 *   them offline (script or notebook) to small JSON summaries and COG tiles;
 *   this provider should only read those pre-computed artefacts at runtime.
 *
 * TODO(mapping): Emit EventSummary / EventDetail with source: "nisar" so the
 *   interface drops the "Simulated data" badge automatically.
 *
 * TODO(significance): Derive significance (p-value, z-score) from the real
 *   variability of each pixel's baseline period, not from a fixed threshold.
 */
export class NisarProvider implements DataProvider {
  readonly source = "nisar" as const;

  async getEvents(filters?: EventFilters): Promise<EventSummary[]> {
    void filters;
    throw new Error("NisarProvider is not implemented yet.");
  }

  async getEventById(id: string): Promise<EventDetail | null> {
    void id;
    throw new Error("NisarProvider is not implemented yet.");
  }

  async getTimeRange(): Promise<TimeRange> {
    throw new Error("NisarProvider is not implemented yet.");
  }
}
