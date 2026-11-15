/**
 * Small geometry helpers for the globe: bounding boxes, point-in-polygon,
 * the altitude needed to frame an area, and the zoom levels (LOD).
 */

export type Position = [number, number]; // [lng, lat]
export type Ring = Position[];
export type PolygonCoords = Ring[];

export type GeoGeometry =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: PolygonCoords[] };

/** [minLng, minLat, maxLng, maxLat] */
export type BBox = [number, number, number, number];

export interface View {
  lat: number;
  lng: number;
  altitude: number;
}

export type RegionKind = "country" | "province";

export interface RegionFeature {
  id: string;
  name: string;
  kind: RegionKind;
  geometry: GeoGeometry;
  /** Bounding box of the whole feature. */
  bbox: BBox;
  /** Bounding box of its largest polygon (ignores far-flung islands). */
  mainBBox: BBox;
}

interface RawFeature {
  properties: { id?: string; iso?: string; name?: string };
  geometry: GeoGeometry;
}

/* -------------------------------------------------------------------------- */
/* Bounding boxes and containment                                             */
/* -------------------------------------------------------------------------- */

function ringBBox(ring: Ring): BBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

function mergeBBox(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function bboxArea(b: BBox): number {
  return (b[2] - b[0]) * (b[3] - b[1]);
}

function polygonsOf(geometry: GeoGeometry): PolygonCoords[] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function bboxesOf(geometry: GeoGeometry): { all: BBox; main: BBox } {
  let all: BBox | null = null;
  let main: BBox | null = null;
  for (const polygon of polygonsOf(geometry)) {
    const box = ringBBox(polygon[0]);
    all = all ? mergeBBox(all, box) : box;
    if (!main || bboxArea(box) > bboxArea(main)) main = box;
  }
  const fallback: BBox = [0, 0, 0, 0];
  return { all: all ?? fallback, main: main ?? fallback };
}

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInRegion(lng: number, lat: number, region: RegionFeature): boolean {
  const [minLng, minLat, maxLng, maxLat] = region.bbox;
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
  for (const polygon of polygonsOf(region.geometry)) {
    if (!inRing(lng, lat, polygon[0])) continue;
    // A hole in the polygon excludes the point.
    let inHole = false;
    for (let h = 1; h < polygon.length; h++) {
      if (inRing(lng, lat, polygon[h])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

export function parseRegions(
  collection: { features: RawFeature[] },
  kind: RegionKind,
): RegionFeature[] {
  return collection.features.map((feature, index) => {
    const { all, main } = bboxesOf(feature.geometry);
    const id = feature.properties.id ?? feature.properties.iso ?? `${kind}-${index}`;
    return {
      id,
      name: feature.properties.name ?? id,
      kind,
      geometry: feature.geometry,
      bbox: all,
      mainBBox: main,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Framing                                                                    */
/* -------------------------------------------------------------------------- */

/** Camera field of view of react-globe.gl (degrees, vertical). */
const FOV_DEG = 50;
const DEG_PER_UNIT = (2 * Math.tan((FOV_DEG / 2) * (Math.PI / 180)) * 180) / Math.PI;

/**
 * Altitude (in globe radii) at which the camera sees a span of `degrees`
 * vertically. Valid for small spans; the surface is treated as flat.
 */
export function altitudeForVerticalSpan(degrees: number): number {
  return degrees / DEG_PER_UNIT;
}

/** Visible vertical span, in degrees, for a camera altitude. */
export function verticalSpanForAltitude(altitude: number): number {
  return altitude * DEG_PER_UNIT;
}

export const MIN_ALTITUDE = 0.06;
export const MAX_ALTITUDE = 2.6;

export function clampAltitude(altitude: number): number {
  return Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, altitude));
}

export function bboxCenter(bbox: BBox): { lat: number; lng: number } {
  return { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 };
}

/** The view that frames a bounding box with some breathing room. */
export function viewForBBox(bbox: BBox, aspect: number, padding = 1.45): View {
  const { lat, lng } = bboxCenter(bbox);
  const latSpan = bbox[3] - bbox[1];
  const lngSpan = (bbox[2] - bbox[0]) * Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const needed = Math.max(latSpan, lngSpan / Math.max(aspect, 0.4)) * padding;
  return { lat, lng, altitude: clampAltitude(altitudeForVerticalSpan(needed)) };
}

/**
 * How far to move the camera centre so the target sits in the middle of the
 * free area left by a side panel of `panelPx` pixels on the right.
 */
export function panelShift(view: View, panelPx: number, viewportHeight: number): View {
  if (panelPx <= 0 || viewportHeight <= 0) return view;
  const degPerPx = verticalSpanForAltitude(view.altitude) / viewportHeight;
  const shift = (panelPx / 2) * degPerPx;
  const cos = Math.max(Math.cos((view.lat * Math.PI) / 180), 0.2);
  return { ...view, lng: view.lng + shift / cos };
}

/**
 * Same idea for a bottom sheet on small screens: move the camera so the
 * target sits in the strip of map above a panel covering `panelFraction` of
 * the viewport height.
 */
export function sheetShift(view: View, panelFraction: number): View {
  const span = verticalSpanForAltitude(view.altitude);
  const targetY = (1 - panelFraction) / 2; // 0 = top, 1 = bottom
  return { ...view, lat: view.lat - (0.5 - targetY) * span };
}

/* -------------------------------------------------------------------------- */
/* Zoom levels                                                                */
/* -------------------------------------------------------------------------- */

export type Lod = "orbit" | "region" | "country" | "ground";

export const LOD_THRESHOLDS = { orbit: 0.9, region: 0.3, country: 0.09 } as const;

export function lodFromAltitude(altitude: number): Lod {
  if (altitude > LOD_THRESHOLDS.orbit) return "orbit";
  if (altitude > LOD_THRESHOLDS.region) return "region";
  if (altitude > LOD_THRESHOLDS.country) return "country";
  return "ground";
}

/** How much to shrink marker sizes (given in degrees) at each zoom level. */
export const LOD_MARKER_SCALE: Record<Lod, number> = {
  orbit: 1,
  region: 0.5,
  country: 0.2,
  ground: 0.1,
};

/* -------------------------------------------------------------------------- */
/* Circles drawn on the globe                                                 */
/* -------------------------------------------------------------------------- */

/** A ring of lat/lng points `radiusKm` around a centre (for the event footprint). */
export function circlePoints(
  lat: number,
  lng: number,
  radiusKm: number,
  steps = 72,
): Array<[number, number]> {
  const dLat = radiusKm / 111.2;
  const dLng = radiusKm / (111.2 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    // Slightly squashed so it reads as a footprint, not a target.
    points.push([lat + Math.sin(angle) * dLat * 0.82, lng + Math.cos(angle) * dLng]);
  }
  return points;
}

/** Great-circle distance between two points, in degrees. */
export function greatCircleDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLng = (lng2 - lng1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) * (180 / Math.PI);
}
