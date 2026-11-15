import type { GlobeMethods } from "react-globe.gl";
import type { View } from "@/lib/geo";

/**
 * Cinematic camera flights. The globe library only interpolates linearly, so
 * the flight is driven here: the camera rises in an arc, turns toward the
 * destination and descends with an ease-in-out.
 */

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Longitude delta along the shortest way round, in (-180, 180]. */
function shortestLngDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Great-circle distance in degrees. */
function angularDistance(a: View, b: View): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = shortestLngDelta(a.lng, b.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) * (180 / Math.PI);
}

export interface FlightOptions {
  /** Fixed duration in ms. Default: grows with the distance flown. */
  durationMs?: number;
  /** 0 = straight line, 1 = full arc. */
  arc?: number;
  onDone?: () => void;
}

export interface Flight {
  cancel: () => void;
}

/**
 * Fly the camera to `to`. Returns a handle that cancels the flight (used when
 * the user grabs the globe mid-flight).
 */
export function flyCamera(
  globe: GlobeMethods,
  to: View,
  { durationMs, arc = 1, onDone }: FlightOptions = {},
): Flight {
  const from = globe.pointOfView();
  const start: View = { lat: from.lat, lng: from.lng, altitude: from.altitude };
  const distance = angularDistance(start, to);
  const dLng = shortestLngDelta(start.lng, to.lng);
  const altChange = Math.abs(Math.log(to.altitude / Math.max(start.altitude, 1e-3)));

  const duration =
    durationMs ?? Math.min(3200, Math.max(1100, 900 + distance * 16 + altChange * 450));
  // Rise a little on long hops, never on short ones.
  const bump = Math.min(0.75, distance / 40) * arc;

  const logFrom = Math.log(start.altitude);
  const logTo = Math.log(to.altitude);

  let frame = 0;
  let cancelled = false;
  const t0 = performance.now();

  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - t0) / duration);
    const e = easeInOutCubic(t);

    const altitude = Math.exp(logFrom + (logTo - logFrom) * e + bump * Math.sin(Math.PI * e));
    globe.pointOfView(
      {
        lat: start.lat + (to.lat - start.lat) * e,
        lng: start.lng + dLng * e,
        altitude,
      },
      0,
    );

    if (t < 1) {
      frame = requestAnimationFrame(step);
    } else {
      globe.pointOfView(to, 0);
      onDone?.();
    }
  };

  frame = requestAnimationFrame(step);

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    },
  };
}

/** Jump without animation (reduced motion). */
export function jumpCamera(globe: GlobeMethods, to: View): void {
  globe.pointOfView(to, 0);
}
