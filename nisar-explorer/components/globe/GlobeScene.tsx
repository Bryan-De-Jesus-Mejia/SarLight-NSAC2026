"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { AmbientLight, DirectionalLight } from "three";
import {
  htmlElement,
  htmlElementVisibilityModifier,
  markerHandlers,
  syncMarkers,
  toCalloutDatum,
  type HtmlDatum,
} from "@/components/globe/markers";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { EventSummary } from "@/data/types";
import { useElementSize } from "@/hooks/useElementSize";
import { useGeoData } from "@/hooks/useGeoData";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useVisibleEvents } from "@/hooks/useVisibleEvents";
import { countryName } from "@/i18n/countries";
import { t, useLang, useT } from "@/i18n/core";
import { flyCamera, jumpCamera, type Flight } from "@/lib/camera";
import { sizeIndex } from "@/lib/events";
import { escapeHtml, isWebGLAvailable } from "@/lib/dom";
import {
  LOD_MARKER_SCALE,
  greatCircleDeg,
  lodFromAltitude,
  panelShift,
  pointInRegion,
  sheetShift,
  type Lod,
  type RegionFeature,
  type View,
} from "@/lib/geo";
import { globeApi } from "@/lib/globeApi";
import { createStarfieldDataUrl } from "@/lib/starfield";
import {
  DR_ISO,
  WORLD_VIEW,
  trailForCountry,
  trailForEvent,
  trailForProvince,
  worldItem,
} from "@/lib/trail";
import { createDrape, type Drape } from "@/components/globe/drape";
import { createPassLayer, loadPassCycle, type PassLayer } from "@/components/globe/passes";
import {
  buildBorders,
  pickLatLng,
  setBorderHighlight,
  setBorderLod,
  type BorderLayers,
} from "@/components/globe/borders";
import {
  applyOverlay,
  capLevels,
  createOverlayEngine,
  createOverlayUniforms,
  findBaseEngine,
  ignoreRaycast,
  thinTiles,
  type Engine,
} from "@/components/globe/imageryEngine";
import { satelliteUrl } from "@/lib/imagery";
import { useAppStore, type TrailItem } from "@/store/useAppStore";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const BACKGROUND_COLOR = "#040406";
const ATMOSPHERE_COLOR = "#6ea8ff";
const ACCENT_RGB = "242, 184, 102";
/** Camera altitude on arrival at an event. */
const EVENT_ALTITUDE = 0.085;
/** Width of the case panel on desktop (27rem + margin), in px. */
const PANEL_PX = 440;
const DESKTOP_MIN_WIDTH = 768;
/** Share of the screen the case panel covers on small screens (max-h 72dvh). */
const SHEET_FRACTION = 0.68;
const RESUME_ROTATION_MS = 6000;
const MIN_DISTANCE = 100 * (1 + 0.012);
const MAX_DISTANCE = 520;

const NO_EVENTS: EventSummary[] = [];
/** Radius of the radar lens, in CSS pixels (matches .ge-lens). */
const LENS_RADIUS_PX = 150;

const DEVICE_RATIO = typeof window === "undefined" ? 1 : window.devicePixelRatio;
const RENDERER_CONFIG = { antialias: true, alpha: false, powerPreference: "high-performance" } as const;
// Multisampling smooths the edges; pixels past 1.25x only cost fill rate.
const FULL_RATIO = Math.min(1.25, DEVICE_RATIO);


/* -------------------------------------------------------------------------- */
/* Layer accessors                                                            */
/*                                                                            */
/* Anything that does not depend on React state lives at module level: the    */
/* globe rebuilds a layer whenever an accessor's identity changes, so stable  */
/* functions mean unrelated state changes never touch the WebGL scene.        */
/* -------------------------------------------------------------------------- */

const asEvent = (d: object): EventSummary => d as EventSummary;
const asRegion = (d: object): RegionFeature => d as RegionFeature;
const regionAltitude = (): number => 0.0005;
const regionCurvature = (d: object): number => (asRegion(d).kind === "province" ? 1 : 3);
const asRegionGeometry = (d: object): { type: "Polygon"; coordinates: number[] } =>
  asRegion(d).geometry as unknown as { type: "Polygon"; coordinates: number[] };

const pointLat = (d: object): number => asEvent(d).lat;
const pointLng = (d: object): number => asEvent(d).lon;
// The discs stay only to catch hover and taps; the round markers are what is seen.
const pointColor = (): string => "rgba(0, 0, 0, 0)";

const pointLabel = (d: object): string => {
  const e = asEvent(d);
  const meta = CHANGE_TYPES[e.type];
  return (
    `<div class="ge-tooltip">` +
    `<div class="ge-tooltip-type" style="color:${meta.color}">${escapeHtml(t(meta.label))}</div>` +
    `<div class="ge-tooltip-name">${escapeHtml(t(e.name))}</div>` +
    `<div class="ge-tooltip-place">${escapeHtml(t(e.region))} · ${escapeHtml(t(e.country))}</div>` +
    `</div>`
  );
};

const ringColor = (d: object): ((t: number) => string) => {
  const [r, g, b] = CHANGE_TYPES[asEvent(d).type].rgb;
  return (t: number) => `rgba(${r}, ${g}, ${b}, ${(Math.pow(1 - t, 1.6) * 0.85).toFixed(3)})`;
};

/** HTML elements sit just above the point discs. */
const HTML_ALTITUDE = 0.004;
const htmlAltitude = (): number => HTML_ALTITUDE;

const noSideColor = (): string => "";
const noLabel = (): string => "";

/** Shader inputs of the two overlay layers (the curtain shows one on each side). */
const CLASS_UNIFORM = { value: -1 };
const UNIFORMS_A = createOverlayUniforms(CLASS_UNIFORM);
const UNIFORMS_B = createOverlayUniforms(CLASS_UNIFORM);

/** A case is open and a visitor (not the demo) is driving: map clicks close it instead of opening a region. */
const caseLocked = (): boolean => {
  const state = useAppStore.getState();
  return state.selectedId !== null && !state.demoActive;
};

/* Event footprint (a dashed outline around the selected case) */
interface Footprint {
  id: string;
  color: string;
  points: Array<[number, number]>;
}
const NO_FOOTPRINTS: Footprint[] = [];
const footprintPoints = (d: object): Array<[number, number]> => (d as Footprint).points;
const footprintLat = (p: unknown): number => (p as [number, number])[0];
const footprintLng = (p: unknown): number => (p as [number, number])[1];
const footprintAlt = (): number => 0.005;
const footprintColor = (d: object): string => (d as Footprint).color;
const footprintStroke = (): number => 0.03;
const footprintDash = (): number => 0.04;
const footprintGap = (): number => 0.025;
const footprintAnimate = (): number => 5000;

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function GlobeScene() {
  const tr = useT();
  const lang = useLang();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const reducedMotion = usePrefersReducedMotion();

  // Timeline + type filters are already applied here.
  const { visible: events } = useVisibleEvents();
  const allEvents = useAppStore((s) => s.events);
  const selectedId = useAppStore((s) => s.selectedId);
  const detail = useAppStore((s) => s.detail);
  const lod = useAppStore((s) => s.lod);
  const drapeOn = useAppStore((s) => s.drape !== null);
  const story = useAppStore((s) => s.story);
  const selectedProvinceId = useAppStore((s) => s.selectedProvinceId);
  const select = useAppStore((s) => s.select);
  const selectProvince = useAppStore((s) => s.selectProvince);
  const setLod = useAppStore((s) => s.setLod);
  const setTrail = useAppStore((s) => s.setTrail);
  const setGlobeReady = useAppStore((s) => s.setGlobeReady);

  const { countries, provinces } = useGeoData();

  const [webgl] = useState(isWebGLAvailable);
  const [starfieldUrl] = useState(createStarfieldDataUrl);
  const [sceneReady, setSceneReady] = useState(false);
  /** Id of the case the camera has finished flying to. */
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const overlay = useAppStore((s) => s.overlay);
  const overlayDate = useAppStore((s) => s.overlayDate);
  const overlayRef = useRef<ReturnType<typeof createOverlayEngine> | null>(null);
  const overlayBRef = useRef<ReturnType<typeof createOverlayEngine> | null>(null);
  const compare = useAppStore((s) => s.compare);
  const compareBefore = useAppStore((s) => s.compareBefore);

  const aspect = size.height > 0 ? size.width / size.height : 1.6;
  const desktop = size.width >= DESKTOP_MIN_WIDTH;

  // Every analysed area is a case: all of them get a marker and a pulsing ring.
  const featured = events;
  const allFeatured = allEvents;
  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? null,
    [allEvents, selectedId],
  );

  useEffect(() => {
    syncMarkers(new Set(story ? [] : featured.map((e) => e.id)));
  }, [featured, story]);

  /* ----------------------------- camera flights ---------------------------- */

  const flightRef = useRef<Flight | null>(null);
  const flyingRef = useRef(false);
  /** Where the camera was before the first case was opened, to return to it. */
  const savedViewRef = useRef<View | null>(null);
  /** The case the camera was last sent to. */
  const focusedIdRef = useRef<string | null>(null);

  const baseEngineRef = useRef<Engine | null>(null);
  const releaseTilesRef = useRef<(() => void) | null>(null);
  const releaseTiles = useCallback(() => {
    releaseTilesRef.current?.();
    releaseTilesRef.current = null;
  }, []);

  const goTo = useCallback(
    (view: View, onDone?: () => void) => {
      const globe = globeRef.current;
      if (!globe) return;
      flightRef.current?.cancel();
      releaseTiles();
      if (reducedMotion) {
        jumpCamera(globe, view);
        flyingRef.current = false;
        flightRef.current = null;
        onDone?.();
        return;
      }
      flyingRef.current = true;
      releaseTilesRef.current = capLevels(
        [baseEngineRef.current, overlayRef.current, overlayBRef.current],
        globe.camera(),
      );
      flightRef.current = flyCamera(globe, view, {
        onDone: () => {
          flyingRef.current = false;
          flightRef.current = null;
          releaseTiles();
          onDone?.();
        },
      });
    },
    [reducedMotion, releaseTiles],
  );

  const dr = useMemo(() => countries.find((c) => c.id === DR_ISO), [countries]);

  /** Fly to a country, clearing any case or province selection. */
  const goToCountry = useCallback(
    (country: RegionFeature) => {
      savedViewRef.current = null;
      select(null);
      selectProvince(null);
      const trail = trailForCountry(country, aspect);
      setTrail(trail);
      goTo(trail[trail.length - 1].view);
    },
    [aspect, goTo, select, selectProvince, setTrail],
  );

  const goToProvince = useCallback(
    (province: RegionFeature) => {
      savedViewRef.current = null;
      select(null);
      selectProvince(province.id);
      const trail = trailForProvince(province, dr, aspect);
      setTrail(trail);
      goTo(trail[trail.length - 1].view);
    },
    [aspect, dr, goTo, select, selectProvince, setTrail],
  );

  const focusEvent = useCallback(
    (event: EventSummary) => {
      const globe = globeRef.current;
      if (!globe) return;

      // Remember where we came from the first time a case opens.
      if (useAppStore.getState().selectedId === null && savedViewRef.current === null) {
        const { lat, lng, altitude } = globe.pointOfView();
        savedViewRef.current = { lat, lng, altitude };
      }

      const target: View = { lat: event.lat, lng: event.lon, altitude: EVENT_ALTITUDE };
      // On desktop the panel covers the right side: aim at the free area.
      const view = desktop
        ? panelShift(target, PANEL_PX, size.height)
        : sheetShift(target, SHEET_FRACTION);

      focusedIdRef.current = event.id;
      setArrivedId(null);
      select(event.id);
      const province = provinces.find((p) => pointInRegion(event.lon, event.lat, p));
      selectProvince(province?.id ?? null);
      setTrail(trailForEvent(event, view, provinces, countries, aspect));
      goTo(view, () => setArrivedId(event.id));
    },
    [aspect, countries, desktop, goTo, provinces, select, selectProvince, setTrail, size.height],
  );

  // A case selected from outside the globe (the search box) gets the same flight.
  useEffect(() => {
    if (selectedId === null) {
      focusedIdRef.current = null;
      return;
    }
    if (!sceneReady || focusedIdRef.current === selectedId) return;
    const event = allEvents.find((e) => e.id === selectedId);
    if (!event) return;
    focusedIdRef.current = selectedId;
    queueMicrotask(() => focusEvent(event));
  }, [selectedId, sceneReady, allEvents, focusEvent]);

  /** Breadcrumb click: go back to a step of the trail. */
  const navigate = useCallback(
    (item: TrailItem) => {
      const trail = useAppStore.getState().trail;
      const index = trail.findIndex((t) => t.key === item.key);
      const kept = index >= 0 ? trail.slice(0, index + 1) : [worldItem];

      if (item.kind === "event") {
        const event = useAppStore.getState().events.find((e) => e.id === item.eventId);
        if (event) focusEvent(event);
        return;
      }

      savedViewRef.current = null;
      select(null);
      selectProvince(item.kind === "province" ? (item.provinceId ?? null) : null);
      setTrail(item.kind === "world" ? [] : kept);
      goTo(item.view);
    },
    [focusEvent, goTo, select, selectProvince, setTrail],
  );

  useEffect(() => {
    globeApi.current = {
      navigate,
      flyTo: (view, trail = []) => {
        savedViewRef.current = null;
        select(null);
        selectProvince(null);
        setTrail(trail);
        goTo(view);
      },
      openCountry: (iso) => {
        const country = countries.find((c) => c.id === iso);
        if (country) goToCountry(country);
      },
      focusCase: (id) => {
        const event = useAppStore.getState().events.find((e) => e.id === id);
        if (event) focusEvent(event);
        return event !== undefined;
      },
      frameCase: (altitude) => {
        const state = useAppStore.getState();
        const event = state.events.find((e) => e.id === state.selectedId);
        if (!event) return;
        const target: View = { lat: event.lat, lng: event.lon, altitude };
        goTo(desktop ? panelShift(target, PANEL_PX, size.height) : sheetShift(target, SHEET_FRACTION));
      },
    };
    return () => {
      globeApi.current = null;
    };
  }, [navigate, countries, goTo, goToCountry, focusEvent, select, selectProvince, setTrail, desktop, size.height]);

  // Closing a case (Esc, ✕) takes the camera back to where it was.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    if (selectedId !== null) return;

    if (previous === null) return;

    const saved = savedViewRef.current;
    savedViewRef.current = null;

    // Close in a step, not all the way out: the country of the case, with all its provinces in view.
    const closed = allEvents.find((e) => e.id === previous);
    const country = closed ? countries.find((c) => pointInRegion(closed.lon, closed.lat, c)) : undefined;
    if (country) {
      selectProvince(null);
      const trail = trailForCountry(country, aspect);
      setTrail(trail);
      goTo(trail[trail.length - 1].view);
      return;
    }

    const state = useAppStore.getState();
    const trail = state.trail.filter((t) => t.kind !== "event");
    const last = trail[trail.length - 1];
    const backToOrbit = saved !== null && saved.altitude > 0.9;
    selectProvince(!backToOrbit && last?.kind === "province" ? (last.provinceId ?? null) : null);
    setTrail(backToOrbit ? [] : trail);
    if (saved) goTo(saved);
  }, [selectedId, goTo, selectProvince, setTrail, allEvents, countries, aspect]);

  /* ----------------------------- globe lifecycle --------------------------- */

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.pointOfView(WORLD_VIEW, 0);

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.3; // 0.05 (the default) glides for seconds behind the hand
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = MIN_DISTANCE;
    globe.renderer().setPixelRatio(FULL_RATIO);
    controls.maxDistance = MAX_DISTANCE;
    controls.zoomSpeed = 0.7;

    // The user grabbing the globe ends any flight in progress.
    const stopFlight = () => {
      flightRef.current?.cancel();
      flightRef.current = null;
      flyingRef.current = false;
      releaseTiles();
    };
    controls.addEventListener("start", stopFlight);

    // Lighting: bright, even fill so continents stay readable everywhere, plus
    // a key light that rides with the camera to model the sphere (soft limb
    // darkening and a gentle ocean sheen from the upper left).
    const camera = globe.camera();
    const key = new DirectionalLight(0xfff4e6, 1.7);
    key.position.set(-1.1, 0.9, 1.2);
    camera.add(key);
    globe.scene().add(camera);
    globe.lights([new AmbientLight(0xd4e0f7, 2.7)]);

    setSceneReady(true);
    setGlobeReady(true);
  }, [setGlobeReady, releaseTiles]);

  // The overlay layers join the scene next to the globe's own tile engine. That
  // engine is not yet in the scene when onGlobeReady fires, so wait for it.
  const [overlaysReady, setOverlaysReady] = useState(false);
  /** Where the camera looks (snapped to 4 degrees): signals far from it are not drawn. */
  const [focusCenter, setFocusCenter] = useState({ lat: 16, lng: -62 });
  const focusRef = useRef(focusCenter);
  useEffect(() => {
    if (!sceneReady) return;
    let frame = 0;
    let tries = 0;
    const attach = () => {
      const globe = globeRef.current;
      if (!globe) return;
      const base = findBaseEngine(globe.scene());
      if (!base?.parent) {
        if (tries++ < 300) frame = requestAnimationFrame(attach);
        return;
      }
      baseEngineRef.current = base;
      overlayRef.current = createOverlayEngine(base.parent, UNIFORMS_A);
      overlayBRef.current = createOverlayEngine(base.parent, UNIFORMS_B, 3);
      // Picking is done with maths (see "borders"): the map tiles must not be raycast targets.
      ignoreRaycast(base);
      ignoreRaycast(overlayRef.current);
      ignoreRaycast(overlayBRef.current);
      globe.scene().traverse((object) => {
        const type = (object as unknown as { __globeObjType?: string }).__globeObjType;
        if (type === "globe" || type === "atmosphere") object.raycast = () => {};
      });
      setOverlaysReady(true);
    };
    attach();
    return () => cancelAnimationFrame(frame);
  }, [sceneReady]);

  // Hide the tile levels buried under the current one (see thinTiles).
  useEffect(() => {
    if (!overlaysReady) return;
    const timer = setInterval(() => {
      if (baseEngineRef.current) thinTiles(baseEngineRef.current);
      if (overlayRef.current) thinTiles(overlayRef.current);
      if (overlayBRef.current) thinTiles(overlayBRef.current);
    }, 300);
    return () => clearInterval(timer);
  }, [overlaysReady]);

  // Radar / water overlay follows the layer panel. Layer A is the picture, or
  // the "before" half when the curtain is on; layer B is the "after" half.
  // With the lens on, A is the camera view of that day, cut out inside the circle so the
  // cloud-free ground underneath shows through. B stays empty: the radar strips of the day
  // read as unexplained rectangles there, and the NISAR layer shows them with a legend.
  const lens = useAppStore((s) => s.lens);
  const kindA = lens ? "optical" : compare && compareBefore === null ? "none" : overlay;
  const dateA = !lens && compare && compareBefore !== null ? compareBefore : overlayDate;
  const kindB = lens ? "none" : compare ? overlay : "none";

  useEffect(() => {
    const engine = overlayRef.current;
    if (!overlaysReady || !engine) return;
    applyOverlay(engine, kindA, dateA);
    const camera = globeRef.current?.camera();
    if (camera && kindA !== "none") engine.updatePov(camera);
  }, [overlaysReady, kindA, dateA]);

  useEffect(() => {
    const engine = overlayBRef.current;
    if (!overlaysReady || !engine) return;
    applyOverlay(engine, kindB, overlayDate);
    const camera = globeRef.current?.camera();
    if (camera && kindB !== "none") engine.updatePov(camera);
  }, [overlaysReady, kindB, overlayDate]);

  useEffect(() => {
    UNIFORMS_A.side.value = !lens && compare ? -1 : 0;
    UNIFORMS_B.side.value = !lens && compare ? 1 : 0;
  }, [compare, lens]);

  // The lens follows the pointer: the circle goes straight to the shader and to a ring in the DOM.
  const lensRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    const globe = globeRef.current;
    if (!lens || !sceneReady || !el || !globe) return;
    const canvas = globe.renderer().domElement;
    const place = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      UNIFORMS_B.lens.value.set(
        (clientX - rect.left) * ratio,
        canvas.height - (clientY - rect.top) * ratio,
        LENS_RADIUS_PX * ratio,
      );
      UNIFORMS_A.lens.value.copy(UNIFORMS_B.lens.value);
      if (lensRef.current) {
        lensRef.current.style.transform = `translate(${clientX - rect.left}px, ${clientY - rect.top}px)`;
      }
    };
    const rect = canvas.getBoundingClientRect();
    place(rect.left + rect.width / 2, rect.top + rect.height / 2);
    UNIFORMS_B.lensMode.value = 1;
    UNIFORMS_A.lensMode.value = -1;
    const onMove = (event: PointerEvent) => place(event.clientX, event.clientY);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      UNIFORMS_B.lensMode.value = 0;
      UNIFORMS_A.lensMode.value = 0;
    };
  }, [lens, sceneReady, containerRef, size.width, size.height]);

  // "The satellite's dance": one real 12-day cycle of NISAR scenes.
  const dance = useAppStore((s) => s.dance);
  useEffect(() => {
    const globe = globeRef.current;
    if (!dance || !sceneReady || !globe) return;
    let alive = true;
    let layer: PassLayer | null = null;
    const parent = findBaseEngine(globe.scene())?.parent ?? globe.scene();
    void loadPassCycle().then((cycle) => {
      if (!alive || !cycle) return;
      layer = createPassLayer(cycle);
      parent.add(layer.mesh);
    });
    return () => {
      alive = false;
      if (layer) {
        parent.remove(layer.mesh);
        layer.dispose();
      }
    };
  }, [dance, sceneReady]);

  // The curtain position and the lit-up colour go straight to the shader.
  useEffect(() => {
    const globe = globeRef.current;
    if (!sceneReady || !globe) return;
    const sync = () => {
      const state = useAppStore.getState();
      const width = globe.renderer().domElement.width;
      UNIFORMS_A.splitX.value = state.curtain * width;
      UNIFORMS_B.splitX.value = state.curtain * width;
      CLASS_UNIFORM.value = state.radarClass ?? -1;
    };
    sync();
    return useAppStore.subscribe(sync);
  }, [sceneReady, size.width, size.height]);

  // Every camera move: update the zoom level and slow the drag when close.
  const handleZoom = useCallback(
    ({ lat, lng, altitude }: { lat: number; lng: number; altitude: number }) => {
      const next: Lod = lodFromAltitude(altitude);
      if (greatCircleDeg(lat, lng, focusRef.current.lat, focusRef.current.lng) > 4) {
        focusRef.current = { lat, lng };
        setFocusCenter(focusRef.current);
      }
      setLod(next);
      const camera = globeRef.current?.camera();
      if (camera) {
        const a = overlayRef.current;
        const b = overlayBRef.current;
        if (a?.visible) a.updatePov(camera);
        if (b?.visible) b.updatePov(camera);
      }

      const controls = globeRef.current?.controls();
      if (controls) controls.rotateSpeed = Math.min(0.5, Math.max(0.015, altitude * 0.16));

      // Zoomed all the way out by hand: the trail no longer applies.
      const state = useAppStore.getState();
      if (next === "orbit" && !flyingRef.current && state.selectedId === null && state.trail.length) {
        state.setTrail([]);
        state.selectProvince(null);
      }
    },
    [setLod],
  );

  // Auto-rotation: only from orbit, and not while a case is open or motion is
  // reduced. It pauses when the user grabs the globe and resumes 6 s later.
  useEffect(() => {
    const globe = globeRef.current;
    if (!sceneReady || !globe) return;

    const controls = globe.controls();
    const shouldRotate = !reducedMotion && selectedId === null && lod === "orbit";
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
  }, [sceneReady, reducedMotion, selectedId, lod]);

  useEffect(() => {
    return () => setGlobeReady(false);
  }, [setGlobeReady]);

  // Without WebGL there is no globe: say so, and unblock the loading screen.
  useEffect(() => {
    if (!webgl) setGlobeReady(true);
  }, [webgl, setGlobeReady]);

  // Markers reach the latest handlers through the module-level ref.
  useEffect(() => {
    markerHandlers.current = {
      activate: (event) => {
        const app = useAppStore.getState();
        // Picking a community: a marker is a place like any other.
        if (app.communityPicking) return app.setCommunityPoint({ lat: event.lat, lng: event.lon });
        if (app.story) return;
        if (caseLocked() && app.selectedId === event.id) app.select(null);
        else focusEvent(event);
      },
      reveal: (event) => {
        const globe = globeRef.current;
        if (!globe) return;
        const { altitude } = globe.pointOfView();
        goTo({ lat: event.lat, lng: event.lon, altitude });
      },
    };
    return () => {
      markerHandlers.current = null;
    };
  }, [focusEvent, goTo]);

  /* -------------------------------- borders -------------------------------- */

  const bordersRef = useRef<BorderLayers | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const perfRef = useRef<HTMLDivElement | null>(null);
  // Add ?perf to the address for a live frame-rate readout.
  const [perfOn] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf"));
  const overPointRef = useRef(false);
  const hoveredIdRef = useRef<string | null>(null);
  const [hovered, setHovered] = useState<RegionFeature | null>(null);

  // Borders and the shade are a few merged meshes, built once the data is in.
  useEffect(() => {
    const globe = globeRef.current;
    if (!sceneReady || !globe || !countries.length) return;
    const parent = findBaseEngine(globe.scene())?.parent ?? globe.scene();
    const layers = buildBorders(countries, provinces);
    parent.add(layers.group);
    bordersRef.current = layers;
    setBorderLod(layers, useAppStore.getState().lod);
    return () => {
      layers.dispose();
      bordersRef.current = null;
    };
  }, [sceneReady, countries, provinces]);

  useEffect(() => {
    if (bordersRef.current) setBorderLod(bordersRef.current, lod);
  }, [lod, sceneReady, countries, provinces]);

  // Frame-rate readout (?perf): written straight to the DOM, so it costs nothing to React.
  useEffect(() => {
    const globe = globeRef.current;
    const out = perfRef.current;
    if (!perfOn || !sceneReady || !globe || !out) return;
    let frames = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 500) {
        const info = globe.renderer().info;
        const fps = Math.round((frames * 1000) / (now - last));
        out.textContent = `${fps} fps · ${info.render.calls} calls · ${Math.round(info.render.triangles / 1000)}k tris · ${useAppStore.getState().lod}`;
        frames = 0;
        last = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [perfOn, sceneReady]);

  // How many signals each province holds (for its tooltip).
  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      const hit = provinces.find((p) => pointInRegion(event.lon, event.lat, p));
      if (hit) counts.set(hit.id, (counts.get(hit.id) ?? 0) + 1);
    }
    return counts;
  }, [events, provinces]);
  const provinceCountsRef = useRef(provinceCounts);
  useEffect(() => {
    provinceCountsRef.current = provinceCounts;
  }, [provinceCounts]);

  /** The region under a coordinate: a province when close in on the Dominican Republic, else a country. */
  const pickRegion = useCallback(
    (lat: number, lng: number): RegionFeature | null => {
      const level = useAppStore.getState().lod;
      if (level === "country" || level === "ground") {
        const province = provinces.find((p) => pointInRegion(lng, lat, p));
        if (province) return province;
      }
      return countries.find((c) => pointInRegion(lng, lat, c)) ?? null;
    },
    [countries, provinces],
  );

  const openRegion = useCallback(
    (region: RegionFeature) => {
      if (region.kind === "province") goToProvince(region);
      else goToCountry(region);
    },
    [goToCountry, goToProvince],
  );

  // Hover and click are worked out here, not by raycasting hundreds of meshes.
  useEffect(() => {
    const el = containerRef.current;
    if (!sceneReady || !el) return;

    let frame = 0;
    let px = 0;
    let py = 0;
    let down: { x: number; y: number } | null = null;
    let dragged = false;

    const clear = () => {
      if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null;
        setHovered(null);
      }
      if (tipRef.current) tipRef.current.style.opacity = "0";
    };

    const run = () => {
      frame = 0;
      const globe = globeRef.current;
      if (!globe || down || overPointRef.current || caseLocked()) return clear();
      const rect = el.getBoundingClientRect();
      const at = pickLatLng(globe.camera(), px, py, rect);
      const region = at ? pickRegion(at.lat, at.lng) : null;
      if (!region) return clear();

      const tip = tipRef.current;
      if (tip) {
        tip.style.transform = `translate(${px - rect.left}px, ${py - rect.top}px)`;
        if (hoveredIdRef.current !== region.id) {
          const count = region.kind === "province" ? (provinceCountsRef.current.get(region.id) ?? 0) : null;
          tip.innerHTML =
            `<div class="ge-tooltip">` +
            `<div class="ge-tooltip-type" style="color:var(--color-accent)">${escapeHtml(region.kind === "province" ? t("Province") : t("Country"))}</div>` +
            `<div class="ge-tooltip-name">${escapeHtml(region.kind === "province" ? region.name : countryName(region.id, region.name))}</div>` +
            `<div class="ge-tooltip-place">${escapeHtml(count === null ? "" : `${t("{n, plural, one {# signal} other {# signals}}", { n: count })} · `)}${escapeHtml(t("Click to zoom in"))}</div>` +
            `</div>`;
        }
        tip.style.opacity = "1";
      }
      if (hoveredIdRef.current !== region.id) {
        hoveredIdRef.current = region.id;
        setHovered(region);
      }
    };

    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (down && Math.hypot(px - down.x, py - down.y) > 5) dragged = true;
      if (!(event.target instanceof Element) || !event.target.closest("canvas")) return clear();
      if (!frame) frame = requestAnimationFrame(run);
    };
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
      dragged = false;
      clear();
    };
    const onUp = (event: PointerEvent) => {
      const start = down;
      down = null;
      if (!start || dragged) return;
      if (!(event.target instanceof Element) || !event.target.closest("canvas")) return;
      if (overPointRef.current) return; // the point has its own click
      const globe = globeRef.current;
      if (!globe) return;
      const at = pickLatLng(globe.camera(), event.clientX, event.clientY, el.getBoundingClientRect());
      const app = useAppStore.getState();
      if (app.communityPicking) {
        if (at) app.setCommunityPoint({ lat: at.lat, lng: at.lng });
        return;
      }
      const region = at ? pickRegion(at.lat, at.lng) : null;
      if (app.story) return;
      if (region && !caseLocked()) openRegion(region);
      else useAppStore.getState().select(null);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", clear);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", clear);
    };
  }, [sceneReady, containerRef, pickRegion, openRegion]);

  // Only the hovered and the selected region get a fill.
  const selectedProvince = useMemo(
    () => provinces.find((p) => p.id === selectedProvinceId) ?? null,
    [provinces, selectedProvinceId],
  );
  const highlights = useMemo<RegionFeature[]>(() => {
    const list: RegionFeature[] = [];
    // In a story the radar image is the subject: no province tint over it.
    if (story) return list;
    if (selectedProvince) list.push(selectedProvince);
    if (hovered?.kind === "province" && hovered.id !== selectedProvince?.id) list.push(hovered);
    return list;
  }, [selectedProvince, hovered, story]);

  // Filling a whole country means triangulating it on the spot (a visible
  // hitch for the big ones): countries get a bright outline instead.
  useEffect(() => {
    if (bordersRef.current) setBorderHighlight(bordersRef.current, hovered?.kind === "country" ? hovered : null);
  }, [hovered]);

  const regionCapColor = useCallback(
    (d: object): string => {
      const r = asRegion(d);
      return r.id === hovered?.id ? `rgba(${ACCENT_RGB}, 0.34)` : `rgba(${ACCENT_RGB}, 0.2)`;
    },
    [hovered],
  );
  const regionStrokeColor = useCallback(
    (d: object): string | null => (asRegion(d).id === hovered?.id ? "rgba(255, 232, 190, 1)" : null),
    [hovered],
  );

  const handlePointHover = useCallback((point: object | null) => {
    overPointRef.current = point !== null;
  }, []);
  const handlePointClick = useCallback(
    (d: object) => {
      const app = useAppStore.getState();
      if (app.communityPicking) {
        const e = asEvent(d);
        return app.setCommunityPoint({ lat: e.lat, lng: e.lon });
      }
      if (app.story) return;
      // Another case opens straight away; the open one closes.
      const event = asEvent(d);
      if (caseLocked() && app.selectedId === event.id) select(null);
      else focusEvent(event);
    },
    [focusEvent, select],
  );

  /* -------------------------------- events --------------------------------- */

  const markerScale = LOD_MARKER_SCALE[lod];

  const pointAltitude = useCallback(
    (d: object): number => {
      void d;
      return 0.003;
    },
    [],
  );

  const pointRadius = useCallback(
    (d: object): number => {
      const e = asEvent(d);
      // With a radar image on the ground, the disc of the open case would hide it.
      if (drapeOn && e.id === selectedId) return 0.004;
      return (0.34 + sizeIndex(e) * 0.22) * markerScale;
    },
    [markerScale, drapeOn, selectedId],
  );

  const ringsData = useMemo(() => {
    if (reducedMotion || story) return NO_EVENTS;
    if (selectedEvent && !featured.some((e) => e.id === selectedEvent.id)) {
      return [...featured, selectedEvent];
    }
    return featured;
  }, [reducedMotion, featured, selectedEvent, story]);

  const ringMaxRadius = useCallback(
    (d: object): number => (asEvent(d).id === selectedId ? 2.4 : 4.5) * markerScale,
    [selectedId, markerScale],
  );
  const ringSpeed = useCallback(
    (d: object): number => (asEvent(d).id === selectedId ? 1.3 : 1.6) * markerScale,
    [selectedId, markerScale],
  );
  const ringPeriod = useCallback(
    (d: object): number => (asEvent(d).id === selectedId ? 1100 : 1500),
    [selectedId],
  );

  // The radar image of the selected case, laid on the planet at its real position.
  const drape = useAppStore((s) => s.drape);
  const drapeRef = useRef<Drape | null>(null);
  useEffect(() => {
    const globe = globeRef.current;
    if (!sceneReady || !globe || !selectedEvent || selectedEvent.footprint.length < 4) return;
    const parent = findBaseEngine(globe.scene())?.parent ?? globe.scene();
    const layer = createDrape(selectedEvent.footprint);
    parent.add(layer.mesh);
    layer.show(useAppStore.getState().drape);
    drapeRef.current = layer;
    return () => {
      parent.remove(layer.mesh);
      layer.dispose();
      drapeRef.current = null;
    };
  }, [sceneReady, selectedEvent]);
  useEffect(() => {
    drapeRef.current?.show(drape);
  }, [drape]);

  // Dashed outline around the selected case.
  const footprints = useMemo<Footprint[]>(() => {
    if (!selectedEvent || arrivedId !== selectedEvent.id) return NO_FOOTPRINTS;
    // The real outline of the analysed area (closed ring of [lat, lng]).
    const ring = selectedEvent.footprint.map(([lon, lat]): [number, number] => [lat, lon]);
    return [
      {
        id: selectedEvent.id,
        color: `rgba(${CHANGE_TYPES[selectedEvent.type].rgb.join(", ")}, 0.95)`,
        points: ring.length > 0 ? [...ring, ring[0]] : ring,
      },
    ];
  }, [selectedEvent, arrivedId]);

  // The callout card appears once the camera has arrived.
  // A new array when the language changes, so the globe rebuilds the markers with the new words.
  const htmlData = useMemo<HtmlDatum[]>(() => {
    if (!selectedEvent || arrivedId !== selectedEvent.id) return [...allFeatured];
    if (story) return [...allFeatured];
    return [...allFeatured, toCalloutDatum(selectedEvent, detail)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFeatured, selectedEvent, arrivedId, detail, story, lang]);

  const orbit = lod === "orbit";
  const nearRadius = lod === "region" ? 65 : lod === "country" ? 46 : 30;
  const pointsData = useMemo(() => {
    if (orbit) return NO_EVENTS;
    // A story is about one place: the other signals step back.
    if (story) return NO_EVENTS;
    return events.filter(
      (e) =>
        e.id === selectedId ||
        greatCircleDeg(e.lat, e.lon, focusCenter.lat, focusCenter.lng) <= nearRadius,
    );
  }, [orbit, events, selectedId, focusCenter, nearRadius, story]);

  /* --------------------------------- render -------------------------------- */

  if (!webgl) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="glass max-w-sm rounded-2xl p-6 text-center" role="alert">
          <h2 className="font-display text-2xl text-ink">{tr("3D globe unavailable")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {tr(
              "This explorer draws the Earth with WebGL, which this browser or device does not provide. Open it in a recent version of Chrome, Edge, Firefox or Safari with hardware acceleration turned on.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="ge-globe relative h-full w-full" data-lens={lens ? "" : undefined}>
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor={BACKGROUND_COLOR}
          backgroundImageUrl={starfieldUrl || null}
          rendererConfig={RENDERER_CONFIG}
          globeTileEngineUrl={satelliteUrl}
          showAtmosphere
          atmosphereColor={ATMOSPHERE_COLOR}
          atmosphereAltitude={0.19}
          onGlobeReady={handleGlobeReady}
          onZoom={handleZoom}
          // Borders: countries, and the provinces of the Dominican Republic up close
          polygonsData={highlights}
          polygonGeoJsonGeometry={asRegionGeometry}
          polygonCapColor={regionCapColor}
          polygonSideColor={noSideColor}
          polygonStrokeColor={regionStrokeColor}
          polygonAltitude={regionAltitude}
          polygonCapCurvatureResolution={regionCurvature}
          polygonLabel={noLabel}
          polygonsTransitionDuration={0}
          // Region and closer: every signal as a flat disc
          pointsData={pointsData}
          pointLat={pointLat}
          pointLng={pointLng}
          pointColor={pointColor}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointResolution={6}
          pointsMerge={false}
          // While the timeline runs the data changes every few frames: a grow-in
          // tween would be restarted before it could finish.
          pointsTransitionDuration={0}
          pointLabel={pointLabel}
          onPointHover={handlePointHover}
          onPointClick={handlePointClick}
          // Pulsing rings: every analysed area
          ringsData={ringsData}
          ringLat={pointLat}
          ringLng={pointLng}
          ringColor={ringColor}
          ringMaxRadius={ringMaxRadius}
          ringPropagationSpeed={ringSpeed}
          ringRepeatPeriod={ringPeriod}
          // Footprint of the selected case
          pathsData={footprints}
          pathPoints={footprintPoints}
          pathPointLat={footprintLat}
          pathPointLng={footprintLng}
          pathPointAlt={footprintAlt}
          pathColor={footprintColor}
          pathStroke={footprintStroke}
          pathDashLength={footprintDash}
          pathDashGap={footprintGap}
          pathDashAnimateTime={reducedMotion ? 0 : footprintAnimate()}
          pathTransitionDuration={0}
          // Focusable DOM markers and the selected case's callout
          htmlElementsData={htmlData}
          htmlLat={pointLat}
          htmlLng={pointLng}
          htmlAltitude={htmlAltitude}
          htmlElement={htmlElement}
          htmlElementVisibilityModifier={htmlElementVisibilityModifier}
        />
      )}
      <div ref={tipRef} className="ge-region-tip" aria-hidden="true" />
      {lens && (
        <div ref={lensRef} className="ge-lens" aria-hidden="true">
          <span>{tr("Under the clouds · cloud-free mosaic")}</span>
        </div>
      )}
      {perfOn && <div ref={perfRef} className="ge-perf" aria-hidden="true" />}
    </div>
  );
}

