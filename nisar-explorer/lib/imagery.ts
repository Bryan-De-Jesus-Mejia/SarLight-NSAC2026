import { msg } from "@/i18n/core";

/** Real map imagery drawn over the globe: sources, tile URLs and zoom limits. */

export type TileUrl = (x: number, y: number, level: number) => string;

export type OverlayKind = "none" | "radar" | "water" | "optical";

/** Most recent pass over the Dominican Republic known to hold data. */
export const DEFAULT_RADAR_DATE = "2026-10-30";

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** Sentinel-2 cloudless mosaic (EOX): the true-colour ground under the radar. */
export const satelliteUrl: TileUrl = (x, y, level) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/${level}/${y}/${x}.jpg`;

export interface OverlayInfo {
  label: string;
  note: string;
  maxLevel: number;
  url: (date: string) => TileUrl;
}

export const OVERLAYS: Record<Exclude<OverlayKind, "none">, OverlayInfo> = {
  radar: {
    label: msg("NISAR radar"),
    note: msg("L-band backscatter, false colour"),
    maxLevel: 13,
    url: (date) => (x, y, level) =>
      `${GIBS}/NISAR_L2_Geocoded_Polarimetric_Covariance/default/${date}/GoogleMapsCompatible_Level13/${level}/${y}/${x}.png`,
  },
  optical: {
    label: msg("Camera view, same day"),
    note: msg("VIIRS true colour, clouds included"),
    maxLevel: 9,
    url: (date) => (x, y, level) =>
      `${GIBS}/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/${level}/${y}/${x}.jpg`,
  },
  water: {
    label: msg("Surface water"),
    note: msg("OPERA, from Sentinel-1 radar"),
    maxLevel: 12,
    url: (date) => (x, y, level) =>
      `${GIBS}/OPERA_L3_Dynamic_Surface_Water_Extent-Sentinel-1/default/${date}/GoogleMapsCompatible_Level12/${level}/${y}/${x}.png`,
  },
};

/** Box around the Dominican Republic used to look for NISAR passes. */
export const DR_BOX = "-72.1,17.4,-68.2,20.1";
/** NISAR products before this day are provisional (still being calibrated). */
export const VALIDATED_FROM = "2026-10-22";
