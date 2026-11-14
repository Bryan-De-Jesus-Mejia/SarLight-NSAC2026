"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from "three";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { EventSummary } from "@/data/types";
import { useElementSize } from "@/hooks/useElementSize";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { escapeHtml, isWebGLAvailable } from "@/lib/dom";
import { createStarfieldDataUrl } from "@/lib/starfield";
import { useAppStore } from "@/store/useAppStore";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const BACKGROUND_COLOR = "#03050a";
const ATMOSPHERE_COLOR = "#6ea8ff";
const INITIAL_VIEW = { lat: 16, lng: -62, altitude: 2.35 };
const FOCUS_ALTITUDE = 1.45;
const FLY_MS = 1400;
const POINT_TRANSITION_MS = 900;
const RESUME_ROTATION_MS = 6000;
const SVG_NS = "http://www.w3.org/2000/svg";

const NO_EVENTS: EventSummary[] = [];

/**
 * One shared globe material: a faint cool sheen and crisp relief. The globe
 * applies its colour and bump textures to it.
 */
const GLOBE_MATERIAL = new MeshPhongMaterial({
  color: new Color("#ffffff"),
  specular: new Color("#31466b"),
  shininess: 14,
  bumpScale: 9,
});

/** Sharpen the surface texture at grazing angles (the globe's limb). */
function sharpenGlobeTexture(anisotropy: number): void {
  const { map } = GLOBE_MATERIAL;
  if (!map) return;
  map.anisotropy = anisotropy;
  map.needsUpdate = true;
}

/* -------------------------------------------------------------------------- */
/* Layer accessors                                                            */
/*                                                                            */
/* Kept at module level on purpose: the globe rebuilds a layer whenever an    */
/* accessor's identity changes, so stable functions mean unrelated React      */
/* state changes never touch the WebGL scene.                                 */
/* -------------------------------------------------------------------------- */

const asEvent = (d: object): EventSummary => d as EventSummary;

const pointLat = (d: object): number => asEvent(d).lat;
const pointLng = (d: object): number => asEvent(d).lon;
const pointColor = (d: object): string => CHANGE_TYPES[asEvent(d).type].color;

const pointAltitude = (d: object): number => {
  const e = asEvent(d);
  return 0.012 + e.magnitude * (e.featured ? 0.12 : 0.085);
};

const pointRadius = (d: object): number => {
  const e = asEvent(d);
  return e.featured ? 0.46 : 0.16 + e.magnitude * 0.3;
};

const pointLabel = (d: object): string => {
  const e = asEvent(d);
  const meta = CHANGE_TYPES[e.type];
  return (
    `<div class="ge-tooltip">` +
    `<div class="ge-tooltip-type" style="color:${meta.color}">${escapeHtml(meta.label)}</div>` +
    `<div class="ge-tooltip-name">${escapeHtml(e.name)}</div>` +
    `<div class="ge-tooltip-place">${escapeHtml(e.region)} · ${escapeHtml(e.country)}</div>` +
    (e.source === "mock" ? `<div class="ge-tooltip-sim">Simulated data</div>` : "") +
    `</div>`
  );
};

const ringColor = (d: object): ((t: number) => string) => {
  const [r, g, b] = CHANGE_TYPES[asEvent(d).type].rgb;
  return (t: number) => `rgba(${r}, ${g}, ${b}, ${(Math.pow(1 - t, 1.6) * 0.85).toFixed(3)})`;
};

/** Markers sit on top of their point's column. */
const htmlAltitude = (d: object): number => pointAltitude(d) + 0.004;

/**
 * Marker callbacks go through a module-level ref so the marker elements are
 * created once and never rebuilt when handlers change.
 */
interface MarkerHandlers {
  activate: (event: EventSummary) => void;
  reveal: (event: EventSummary) => void;
}
const markerHandlers: { current: MarkerHandlers | null } = { current: null };

/**
 * Markers are created once for every featured case and never removed: the
 * timeline and the filters only switch them off through a data attribute
 * (see .ge-marker-anchor[data-off] in globals.css).
 */
const markerElements = new Map<string, HTMLElement>();
const markersOff = new Set<string>();

function syncMarkers(visibleIds: ReadonlySet<string>): void {
  markersOff.clear();
  for (const [id, element] of markerElements) {
    const off = !visibleIds.has(id);
    if (off) markersOff.add(id);
    element.toggleAttribute("data-off", off);
  }
}

/**
 * Known trap: the globe overwrites `transform` on the element it is given.
 * So we hand it a zero-size anchor and let the real button offset itself
 * inside (see .ge-marker in globals.css).
 */
const htmlElement = (d: object): HTMLElement => {
  const e = asEvent(d);
  const meta = CHANGE_TYPES[e.type];

  const anchor = document.createElement("div");
  anchor.className = "ge-marker-anchor";
  anchor.style.setProperty("--marker-color", meta.color);
  anchor.style.setProperty("--marker-rgb", meta.rgb.join(" "));

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ge-marker";
  button.setAttribute("aria-label", `${e.name}, ${e.country}. Featured ${meta.noun} case.`);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", meta.iconPath);
  svg.appendChild(path);
  button.appendChild(svg);

  const label = document.createElement("span");
  label.className = "ge-marker-label";
  label.textContent = e.name;
  button.appendChild(label);

  button.addEventListener("click", (domEvent) => {
    domEvent.stopPropagation();
    markerHandlers.current?.activate(e);
  });
  // Keyboard focus may land on a marker that is behind the globe: bring it round.
  button.addEventListener("focus", () => {
    if (button.matches(":focus-visible")) markerHandlers.current?.reveal(e);
  });

  anchor.appendChild(button);
  anchor.toggleAttribute("data-off", markersOff.has(e.id));
  markerElements.set(e.id, anchor);
  return anchor;
};

/** Hide markers on the far hemisphere (and make them unclickable). */
const htmlElementVisibilityModifier = (el: HTMLElement, isVisible: boolean): void => {
  el.style.opacity = isVisible ? "1" : "0";
  el.style.pointerEvents = isVisible ? "auto" : "none";
};

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function GlobeScene() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const reducedMotion = usePrefersReducedMotion();

  // Timeline + type filters are already applied here.
  const { visible: events } = useVisibleEvents();
  const allEvents = useAppStore((s) => s.events);
  const timelineOn = useAppStore((s) => s.timelineDay !== null);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const setGlobeReady = useAppStore((s) => s.setGlobeReady);

  const [webgl] = useState(isWebGLAvailable);
  const [starfieldUrl] = useState(createStarfieldDataUrl);
  const [sceneReady, setSceneReady] = useState(false);

  const featured = useMemo(() => events.filter((e) => e.featured), [events]);
  const allFeatured = useMemo(() => allEvents.filter((e) => e.featured), [allEvents]);

  useEffect(() => {
    syncMarkers(new Set(featured.map((e) => e.id)));
  }, [featured]);

  const flyTo = useCallback(
    (event: EventSummary, altitude: number) => {
      globeRef.current?.pointOfView(
        { lat: event.lat, lng: event.lon, altitude },
        reducedMotion ? 0 : FLY_MS,
      );
    },
    [reducedMotion],
  );

  const focusEvent = useCallback(
    (event: EventSummary) => {
      flyTo(event, FOCUS_ALTITUDE);
      select(event.id);
    },
    [flyTo, select],
  );

  const handlePointClick = useCallback((d: object) => focusEvent(asEvent(d)), [focusEvent]);
  const handleGlobeClick = useCallback(() => select(null), [select]);

  // Markers reach the latest handlers through the module-level ref.
  useEffect(() => {
    markerHandlers.current = {
      activate: focusEvent,
      reveal: (event) => {
        const globe = globeRef.current;
        if (globe) flyTo(event, globe.pointOfView().altitude);
      },
    };
    return () => {
      markerHandlers.current = null;
    };
  }, [focusEvent, flyTo]);

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.pointOfView(INITIAL_VIEW, 0);

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = 135;
    controls.maxDistance = 520;

    // Lighting: bright, even fill so continents stay readable everywhere, plus
    // a key light that rides with the camera to model the sphere (soft limb
    // darkening and a gentle ocean sheen from the upper left).
    const camera = globe.camera();
    const key = new DirectionalLight(0xfff4e6, 1.7);
    key.position.set(-1.1, 0.9, 1.2);
    camera.add(key);
    globe.scene().add(camera);
    globe.lights([new AmbientLight(0xd4e0f7, 2.7)]);

    sharpenGlobeTexture(globe.renderer().capabilities.getMaxAnisotropy());

    setSceneReady(true);
    setGlobeReady(true);
  }, [setGlobeReady]);

  // Auto-rotation: on unless motion is reduced or a case is selected. It
  // pauses when the user grabs the globe and resumes 6 s after they let go.
  useEffect(() => {
    const globe = globeRef.current;
    if (!sceneReady || !globe) return;

    const controls = globe.controls();
    const shouldRotate = !reducedMotion && selectedId === null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    controls.autoRotate = shouldRotate;

    const onStart = () => {
      clearTimeout(timer);
      controls.autoRotate = false;
    };
    const onEnd = () => {
      clearTimeout(timer);
      if (!shouldRotate) return;
      timer = setTimeout(() => {
        controls.autoRotate = true;
      }, RESUME_ROTATION_MS);
    };

    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      clearTimeout(timer);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, [sceneReady, reducedMotion, selectedId]);

  useEffect(() => {
    return () => setGlobeReady(false);
  }, [setGlobeReady]);

  // Without WebGL there is no globe: say so, and unblock the loading screen.
  useEffect(() => {
    if (!webgl) setGlobeReady(true);
  }, [webgl, setGlobeReady]);

  if (!webgl) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="glass max-w-sm rounded-2xl p-6 text-center" role="alert">
          <h2 className="font-display text-2xl text-ink">3D globe unavailable</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This explorer draws the Earth with WebGL, which this browser or device does not
            provide. Open it in a recent version of Chrome, Edge, Firefox or Safari with hardware
            acceleration turned on.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="ge-globe h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor={BACKGROUND_COLOR}
          backgroundImageUrl={starfieldUrl || null}
          globeImageUrl="/textures/earth-blue-marble.jpg"
          bumpImageUrl="/textures/earth-topology.png"
          globeMaterial={GLOBE_MATERIAL}
          showAtmosphere
          atmosphereColor={ATMOSPHERE_COLOR}
          atmosphereAltitude={0.19}
          onGlobeReady={handleGlobeReady}
          onGlobeClick={handleGlobeClick}
          // Points: every signal
          pointsData={events}
          pointLat={pointLat}
          pointLng={pointLng}
          pointColor={pointColor}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointResolution={10}
          pointsMerge={false}
          // While the timeline runs the data changes every few frames: a grow-in
          // tween would be restarted before it could finish.
          pointsTransitionDuration={reducedMotion || timelineOn ? 0 : POINT_TRANSITION_MS}
          pointLabel={pointLabel}
          onPointClick={handlePointClick}
          // Pulsing rings: featured cases only
          ringsData={reducedMotion ? NO_EVENTS : featured}
          ringLat={pointLat}
          ringLng={pointLng}
          ringColor={ringColor}
          ringMaxRadius={4.5}
          ringPropagationSpeed={1.6}
          ringRepeatPeriod={1500}
          // Focusable DOM markers: featured cases only
          htmlElementsData={allFeatured}
          htmlLat={pointLat}
          htmlLng={pointLng}
          htmlAltitude={htmlAltitude}
          htmlElement={htmlElement}
          htmlElementVisibilityModifier={htmlElementVisibilityModifier}
        />
      )}
    </div>
  );
}
