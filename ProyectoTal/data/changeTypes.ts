import type { ChangeType } from "./types";

export interface ChangeTypeMeta {
  label: string;
  /** Short noun phrase used in accessible names, e.g. "wildfire". */
  noun: string;
  blurb: string;
  /** Hex colour. */
  color: string;
  rgb: readonly [number, number, number];
  /** SVG path data for a 24×24 viewBox, drawn with a 1.75 stroke and no fill. */
  iconPath: string;
}

/**
 * Every change type has its own colour AND its own glyph:
 * colour is never the only signal.
 */
export const CHANGE_TYPES: Record<ChangeType, ChangeTypeMeta> = {
  wetland: {
    label: "Wetlands & water",
    noun: "wetland",
    blurb: "Flooded vegetation and open-water extent seen through L-band double bounce.",
    color: "#2dd4bf",
    rgb: [45, 212, 191],
    // Three waves
    iconPath:
      "M3 7c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 12c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 17c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0",
  },
  glacier: {
    label: "Glaciers & ice",
    noun: "glacier",
    blurb: "Ice flow speed and terminus position from offset tracking.",
    color: "#7dd3fc",
    rgb: [125, 211, 252],
    // Mountain with a snow cap
    iconPath: "M2.5 19.5 12 4l9.5 15.5zM8.3 10l2 1.7L12 10l1.7 1.7 2-1.7",
  },
  wildfire: {
    label: "Wildfire",
    noun: "wildfire",
    blurb: "Burn scars from the drop in volume scattering after canopy loss.",
    color: "#fb923c",
    rgb: [251, 146, 60],
    // Flame
    iconPath:
      "M12 21c-3.6 0-6.5-2.7-6.5-6.3 0-2.6 1.5-4.3 3-6 1.3-1.5 2.4-3 2.5-5.7 3.1 1.7 6.5 5.6 6.5 10.6 0 4.2-2.3 7.4-5.5 7.4zM12 21c-1.5 0-2.6-1.2-2.6-2.8 0-1.5 1-2.5 2.6-4.4 1.6 1.9 2.6 2.9 2.6 4.4 0 1.6-1.1 2.8-2.6 2.8z",
  },
  earthquake: {
    label: "Earthquakes",
    noun: "earthquake",
    blurb: "Co-seismic ground displacement mapped with InSAR.",
    color: "#fb7185",
    rgb: [251, 113, 133],
    // Seismograph trace
    iconPath: "M2 12h4l2-6 3.5 13 3-11 2 4H22",
  },
  agriculture: {
    label: "Agriculture",
    noun: "agriculture",
    blurb: "Crop cycles and land conversion from backscatter time series.",
    color: "#a3e635",
    rgb: [163, 230, 53],
    // Sprout with two leaves
    iconPath:
      "M12 21v-9M12 12c0-3.6-2.6-6-7-6 0 3.9 2.7 6 7 6zM12 14.5c0-3.2 2.4-5.5 7-5.5 0 3.5-2.7 5.5-7 5.5z",
  },
  deformation: {
    label: "Land deformation",
    noun: "land deformation",
    blurb: "Slow subsidence and uplift measured to millimetres with InSAR.",
    color: "#a78bfa",
    rgb: [167, 139, 250],
    // Strata lines with a downward arrow
    iconPath: "M3 5h18M3 10h5M16 10h5M12 8v11M8.5 15.5 12 19l3.5-3.5",
  },
};

/** Fixed legend order. */
export const CHANGE_TYPE_ORDER: readonly ChangeType[] = [
  "wetland",
  "glacier",
  "wildfire",
  "earthquake",
  "agriculture",
  "deformation",
];
