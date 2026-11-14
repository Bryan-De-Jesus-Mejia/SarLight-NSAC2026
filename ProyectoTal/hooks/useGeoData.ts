"use client";

import { useEffect, useState } from "react";
import { parseRegions, type RegionFeature } from "@/lib/geo";

export interface GeoData {
  countries: RegionFeature[];
  provinces: RegionFeature[];
}

const EMPTY: GeoData = { countries: [], provinces: [] };

// Fetched once per page load and shared by every consumer.
let pending: Promise<GeoData> | null = null;

function loadGeo(): Promise<GeoData> {
  pending ??= Promise.all([
    fetch("/geo/countries.geojson").then((r) => r.json()),
    fetch("/geo/dr-provinces.geojson").then((r) => r.json()),
  ])
    .then(([countries, provinces]) => ({
      countries: parseRegions(countries, "country"),
      provinces: parseRegions(provinces, "province"),
    }))
    .catch((error: unknown) => {
      pending = null; // allow a retry on the next mount
      throw error;
    });
  return pending;
}

/** Country borders (world) and province borders (Dominican Republic), from /public/geo. */
export function useGeoData(): GeoData {
  const [data, setData] = useState<GeoData>(EMPTY);

  useEffect(() => {
    let alive = true;
    loadGeo()
      .then((loaded) => {
        if (alive) setData(loaded);
      })
      .catch(() => {
        // Borders are an enhancement: the globe still works without them.
      });
    return () => {
      alive = false;
    };
  }, []);

  return data;
}
