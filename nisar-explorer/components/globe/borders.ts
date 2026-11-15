import ConicPolygonGeometry from "three-conic-polygon-geometry";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Sphere,
  Vector2,
  Vector3,
  type Camera,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Lod, RegionFeature } from "@/lib/geo";
import { DR_ISO } from "@/lib/trail";

/**
 * Borders and the "spotlight" shade, built as a handful of merged meshes.
 *
 * The globe library draws every polygon as its own mesh (hundreds of draw
 * calls and hundreds of raycast targets). Here the whole world's borders are
 * three line batches and one shade mesh, and picking is plain maths.
 */

const GLOBE_RADIUS = 100;
const LINE_RADIUS = GLOBE_RADIUS * 1.0007;
const SHADE_SCALE = 1.0004;
/** Longest line segment, in degrees: longer ones are split so they follow the curve. */
const MAX_STEP_DEG = 0.6;
const ACCENT = 0xfb7185;
/**
 * The shade is a faint veil (opacity 0.24): it does not need the border detail, and
 * triangulating every point of every country would freeze the first frames. Its rings
 * keep one point every SHADE_STEP_DEG (about the old 1:110m detail); the islands seen
 * around the Dominican Republic keep all of theirs, so close up the veil meets their coasts.
 */
const SHADE_STEP_DEG = 0.4;
const SHADE_FULL_DETAIL = new Set(["HTI", "PRI", "CUB", "JAM", "BHS", "TCA"]);
/** Never seen while the veil is on (it shows close to the Dominican Republic), and its pole-wrapping polygon is slow to build. */
const SHADE_SKIP = new Set(["ATA"]);

const rad = Math.PI / 180;

function toXYZ(lng: number, lat: number, radius: number, out: number[]): void {
  const phi = (90 - lat) * rad;
  const theta = (90 - lng) * rad;
  const sin = Math.sin(phi);
  out.push(radius * sin * Math.cos(theta), radius * Math.cos(phi), radius * sin * Math.sin(theta));
}

function pushRing(out: number[], ring: Array<[number, number]>): void {
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [lng0, lat0] = ring[i];
    const [lng1, lat1] = ring[i + 1];
    const dLng = lng1 - lng0;
    // A jump across the antimeridian would draw a streak across the planet.
    if (Math.abs(dLng) > 180) continue;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dLng), Math.abs(lat1 - lat0)) / MAX_STEP_DEG));
    for (let s = 0; s < steps; s += 1) {
      const a = s / steps;
      const b = (s + 1) / steps;
      toXYZ(lng0 + dLng * a, lat0 + (lat1 - lat0) * a, LINE_RADIUS, out);
      toXYZ(lng0 + dLng * b, lat0 + (lat1 - lat0) * b, LINE_RADIUS, out);
    }
  }
}

function polygonsOf(region: RegionFeature): Array<Array<Array<[number, number]>>> {
  const g = region.geometry;
  return (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as Array<Array<Array<[number, number]>>>;
}

function lineBatch(regions: RegionFeature[], color: number, opacity: number): LineSegments {
  const positions: number[] = [];
  for (const region of regions) {
    for (const polygon of polygonsOf(region)) {
      for (const ring of polygon) pushRing(positions, ring);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const lines = new LineSegments(geometry, material);
  lines.renderOrder = 4;
  lines.raycast = () => {};
  return lines;
}

/** A ring with one point every `step` degrees (first and last kept), or null when only a sliver is left. */
function thinRing(ring: Array<[number, number]>, step: number): Array<[number, number]> | null {
  const out: Array<[number, number]> = [ring[0]];
  for (let i = 1; i < ring.length - 1; i += 1) {
    const [lng, lat] = ring[i];
    const [lastLng, lastLat] = out[out.length - 1];
    if (Math.abs(lng - lastLng) >= step || Math.abs(lat - lastLat) >= step) out.push(ring[i]);
  }
  out.push(ring[ring.length - 1]);
  // Fewer than five corners is a sliver that was an islet: it adds nothing to the veil and stalls the triangulation.
  return out.length >= 6 ? out : null;
}

/** One mesh covering every country but the Dominican Republic. */
function buildShade(countries: RegionFeature[]): Mesh | null {
  try {
    const parts: BufferGeometry[] = [];
    for (const country of countries) {
      if (country.id === DR_ISO || SHADE_SKIP.has(country.id)) continue;
      const full = SHADE_FULL_DETAIL.has(country.id);
      for (const original of polygonsOf(country)) {
        const outer = full ? original[0] : thinRing(original[0], SHADE_STEP_DEG);
        // Islands smaller than the step vanish from the veil; their outline is still drawn.
        if (!outer) continue;
        // Lakes are left out of a thinned veil: a thinned hole can cross its outline and stall the triangulation.
        const polygon = full ? original : [outer];
        const geometry = new ConicPolygonGeometry(polygon, 0, GLOBE_RADIUS, false, true, false, 3);
        geometry.clearGroups();
        parts.push(geometry);
      }
    }
    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!merged) return null;
    const mesh = new Mesh(
      merged,
      new MeshBasicMaterial({
        color: 0x03050a,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    );
    mesh.scale.setScalar(SHADE_SCALE);
    mesh.renderOrder = 3;
    mesh.raycast = () => {};
    return mesh;
  } catch {
    return null;
  }
}

export interface BorderLayers {
  group: Group;
  countries: LineSegments;
  dr: LineSegments;
  provinces: LineSegments;
  /** Outline of the country under the pointer (rebuilt on demand, a few hundred vertices). */
  highlight: LineSegments;
  shade: Mesh | null;
  dispose: () => void;
}

export function buildBorders(countries: RegionFeature[], provinces: RegionFeature[]): BorderLayers {
  const group = new Group();
  const others = countries.filter((c) => c.id !== DR_ISO);
  const dr = lineBatch(
    countries.filter((c) => c.id === DR_ISO),
    ACCENT,
    0.95,
  );
  const countryLines = lineBatch(others, 0xffffff, 0.2);
  const provinceLines = lineBatch(provinces, ACCENT, 0.72);
  provinceLines.visible = false;
  const shade = buildShade(countries);
  if (shade) shade.visible = false;

  const highlight = lineBatch([], 0xffffff, 0.95);
  highlight.visible = false;
  highlight.renderOrder = 5;

  group.add(countryLines, dr, provinceLines, highlight);
  if (shade) group.add(shade);

  return {
    group,
    countries: countryLines,
    dr,
    provinces: provinceLines,
    highlight,
    shade,
    dispose: () => {
      group.removeFromParent();
      group.traverse((object: Object3D) => {
        const mesh = object as Mesh;
        mesh.geometry?.dispose();
        (mesh.material as MeshBasicMaterial | undefined)?.dispose();
      });
    },
  };
}

/** Outline one region brightly (the country under the pointer), or none. */
export function setBorderHighlight(layers: BorderLayers, region: RegionFeature | null): void {
  const line = layers.highlight;
  if (!region) {
    line.visible = false;
    return;
  }
  const positions: number[] = [];
  for (const polygon of polygonsOf(region)) {
    for (const ring of polygon) pushRing(positions, ring);
  }
  line.geometry.dispose();
  line.geometry = new BufferGeometry();
  line.geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  line.visible = true;
}

/** Borders change with the zoom level: faint from orbit, crisp and with provinces up close. */
export function setBorderLod(layers: BorderLayers, lod: Lod): void {
  (layers.countries.material as LineBasicMaterial).opacity = lod === "orbit" ? 0.2 : 0.38;
  layers.provinces.visible = lod === "country" || lod === "ground";
  if (layers.shade) layers.shade.visible = lod !== "orbit";
}

/* -------------------------------------------------------------------------- */
/* Picking                                                                    */
/* -------------------------------------------------------------------------- */

const raycaster = new Raycaster();
const ndc = new Vector2();
const surface = new Sphere(new Vector3(), GLOBE_RADIUS);
const hit = new Vector3();

/** Latitude and longitude under a screen point, or null when it misses the planet. */
export function pickLatLng(
  camera: Camera,
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
): { lat: number; lng: number } | null {
  ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (!raycaster.ray.intersectSphere(surface, hit)) return null;
  const r = hit.length();
  const phi = Math.acos(hit.y / r);
  const theta = Math.atan2(hit.z, hit.x);
  let lng = 90 - (theta * 180) / Math.PI;
  if (theta < -Math.PI / 2) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat: 90 - (phi * 180) / Math.PI, lng };
}
