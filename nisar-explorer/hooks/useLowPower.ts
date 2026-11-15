"use client";

import { useEffect, useState } from "react";

/** Below this, the globe drops its decorations to stay smooth. */
const MIN_FPS = 30;
/** How long the first frames are watched once the scene is up. */
const SAMPLE_MS = 4000;

/**
 * Whether to run the globe in its light mode: on modest hardware (few cores,
 * little memory) from the start, or as soon as the first seconds after the
 * scene is ready run below 30 fps. Once light, it stays light for the visit.
 * `?lite` forces it on and `?full` off, for testing.
 */
export function useLowPower(sceneReady: boolean): boolean {
  const [low, setLow] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    if (params.has("lite")) return true;
    if (params.has("full")) return false;
    const nav = navigator as Navigator & { deviceMemory?: number };
    return (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  });

  useEffect(() => {
    if (!sceneReady || low || new URLSearchParams(window.location.search).has("full")) return;
    let frames = 0;
    let start = 0;
    let raf = 0;
    const tick = (now: number) => {
      // A hidden tab does not draw: measuring it would only count the pause.
      if (document.hidden) {
        start = 0;
        frames = 0;
      } else if (start === 0) {
        start = now;
      } else {
        frames += 1;
        if (now - start >= SAMPLE_MS) {
          if ((frames * 1000) / (now - start) < MIN_FPS) setLow(true);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sceneReady, low]);

  return low;
}
