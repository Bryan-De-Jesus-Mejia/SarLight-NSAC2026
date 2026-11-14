"use client";

import { useEffect, useState } from "react";
import { DR_BOX } from "@/lib/imagery";

const COLLECTIONS = ["NISAR_L2_GCOV_V1", "NISAR_L2_GCOV_PROVISIONAL_V1"] as const;

interface CmrResponse {
  feed?: { entry?: Array<{ time_start?: string }> };
}

let pending: Promise<string[]> | null = null;

/** Days (newest first) on which NISAR imaged the Dominican Republic, from NASA's CMR catalogue. */
function loadPasses(): Promise<string[]> {
  pending ??= Promise.all(
    COLLECTIONS.map((name) =>
      fetch(
        `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${name}&bounding_box=${DR_BOX}&page_size=200&sort_key=-start_date`,
      ).then((r) => (r.ok ? (r.json() as Promise<CmrResponse>) : { feed: { entry: [] } })),
    ),
  )
    .then((responses) => {
      const days = new Set<string>();
      for (const body of responses) {
        for (const entry of body.feed?.entry ?? []) {
          if (entry.time_start) days.add(entry.time_start.slice(0, 10));
        }
      }
      return [...days].sort().reverse();
    })
    .catch(() => {
      pending = null;
      return [];
    });
  return pending;
}

export function useNisarPasses(enabled: boolean): string[] {
  const [days, setDays] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadPasses().then((list) => {
      if (alive) setDays(list);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return days;
}
