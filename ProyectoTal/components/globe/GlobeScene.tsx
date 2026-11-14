"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { AmbientLight, Color, DirectionalLight, MeshPhongMaterial } from "three";
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
import { flyCamera, jumpCamera, type Flight } from "@/lib/camera";
import { escapeHtml, isWebGLAvailable } from "@/lib/dom";
import {
  LOD_MARKER_SCALE,
  circlePoints,
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
import { useAppStore, type TrailItem } from "@/store/useAppStore";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const BACKGROUND_COLOR = "#03050a";
const ATMOSPHERE_COLOR = "#6ea8ff";
const ACCENT_RGB = "242, 184, 102";
/** Camera altitude on arrival at an event. */
const EVENT_ALTITUDE = 0.085;
/** Width of the case panel on desktop (27rem + margin), in px. */
const PANEL_PX = 440;
const DESKTOP_MIN_WIDTH = 768;
/** Share of the screen the case panel covers on small screens (max-h 72dvh). */
const SHEET_FRACTION = 0.68;
const POINT_TRANSITION_MS = 900;
const RESUME_ROTATION_MS = 6000;
const MIN_DISTANCE = 100 * (1 + 0.06);
const MAX_DISTANCE = 520;
/** With real map tiles the camera may come much closer. */
const TILE_MIN_DISTANCE = 100 * (1 + 0.012);

const NO_EVENTS: EventSummary[] = [];
const NO_REGIONS: RegionFeature[] = [];

/**
 * One shared globe material: a faint cool sheen and crisp relief. The globe
 * applies its colour and bump textures to it.
 */
// Kept on globalThis so a hot reload reuses the material that already holds
// the textures (a fresh one would render the globe blank white).
const materialHost = globalThis as { __geGlobeMaterial?: MeshPhongMaterial };
const GLOBE_MATERIAL = (materialHost.__geGlobeMaterial ??= new MeshPhongMaterial({
  color: new Color("#ffffff"),
  specular: new Color("#31466b"),
  shininess: 14,
  bumpScale: 9,
}));

const RENDERER_CONFIG = { antialias: true, alpha: false, powerPreference: "high-performance" } as const;
/** Above this the extra pixels cost far more than they show. */
const MAX_PIXEL_RATIO = 1.5;

/**
 * Optional real-imagery basemap, drawn as map tiles on the globe.
 * Enabled with ?base=sat or ?base=radar (add &date=YYYY-MM-DD for the radar).
 */
type TileUrl = (x: number, y: number, level: number) => string;
function readTileUrl(): TileUrl | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const base = params.get("base");
  if (base === "sat") {
    return (x, y, l) =>
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/${l}/${y}/${x}.jpg`;
  }
  if (base === "radar") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date") : "2026-10-30";
    return (x, y, l) =>
      `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/NISAR_L2_Geocoded_Polarimetric_Covariance/default/${date}/GoogleMapsCompatible_Level13/${l}/${y}/${x}.png`;
  }
  return null;
}

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
/* Anything that does not depend on React state lives at module level: the    */
/* globe rebuilds a layer whenever an accessor's identity changes, so stable  */
/* functions mean unrelated state changes never touch the WebGL scene.        */
/* -------------------------------------------------------------------------- */

const asEvent = (d: object): EventSummary => d as EventSummary;
const asRegion = (d: object): RegionFeature => d as RegionFeature;
const asRegionGeometry = (d: object): { type: "Polygon"; coordinates: number[] } =>
  asRegion(d).geometry as unknown as { type: "Polygon"; coordinates: number[] };

const pointLat = (d: object): number => asEvent(d).lat;
const pointLng = (d: object): number => asEvent(d).lon;
const pointColor = (d: object): string => CHANGE_TYPES[asEvent(d).type].color;

const pointLabel = (d: object): string => {
  const e = asEvent(d);
  const meta = CHANGE_TYPES[e.type];
  return (
    `<div class="ge-tooltip">` +
    `<div class="ge-tooltip-type" style="color:${meta.color}">${escapeHtml(meta.label)}</div>` +
    `<div class="ge-tooltip-name">${escapeHtml(e.name)}</div>` +
    `<div class="ge-tooltip-place">${escapeHtml(e.region)} · ${escapeHtml(e.country)}</div>` +
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

/* Event footprint (a dashed outline around the selected case) */
interface Footprint {
  id: string;
  color: string;
  points: Array<[number, number]>;
}
const footprintPoints = (d: object): Array<[number, number]> => (d as Footprint).points;
const footprintLat = (p: unknown): number => (p as [number, number])[0];
const footprintLng = (p: unknown): number => (p as [number, number])[1];
const footprintAlt = (): number => 0.005;
const footprintColor = (d: object): string => (d as Footprint).color;
const footprintStroke = (): number => 0.03;
const footprintDash = (): number => 0.04;
const footprintGap = (): number => 0.025;
const footprintAnimate = (): number => 5000;

/* Hex density (orbit view) */
interface HexBinLike {
  points: object[];
  sumWeight: number;
}
const hexWeight = (d: object): number => 0.4 + asEvent(d).magnitude;

function hexColor(hex: HexBinLike, alpha: number): string {
  // Cool blue → amber → coral as the cell gets busier.
  const t = Math.min(1, hex.points.length / 9);
  const stops: Array<[number, number, number]> = [
    [110, 168, 255],
    [242, 184, 102],
    [251, 113, 133],
  ];
  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - i;
  const [a, b] = [stops[i], stops[i + 1]];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}
const hexTop = (h: object): string => hexColor(h as HexBinLike, 0.85);
const hexSide = (h: object): string => hexColor(h as HexBinLike, 0.35);
const hexAltitude = (h: object): number =>
  0.006 + Math.min(0.1, (h as HexBinLike).sumWeight * 0.006);
const hexMargin = (): number => 0.22;
const hexLabel = (h: object): string => {
  const n = (h as HexBinLike).points.length;
  return (
    `<div class="ge-tooltip">` +
    `<div class="ge-tooltip-type" style="color:var(--color-accent)">Signal density</div>` +
    `<div class="ge-tooltip-name">${n} signal${n === 1 ? "" : "s"} here</div>` +
    `<div class="ge-tooltip-place">Click to zoom in</div>` +
    `</div>`
  );
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
  const detail = useAppStore((s) => s.detail);
  const lod = useAppStore((s) => s.lod);
  const selectedProvinceId = useAppStore((s) => s.selectedProvinceId);
  const select = useAppStore((s) => s.select);
  const selectProvince = useAppStore((s) => s.selectProvince);
  const setLod = useAppStore((s) => s.setLod);
  const setTrail = useAppStore((s) => s.setTrail);
  const setGlobeReady = useAppStore((s) => s.setGlobeReady);

  const { countries, provinces } = useGeoData();

  const [webgl] = useState(isWebGLAvailable);
  const [starfieldUrl] = useState(createStarfieldDataUrl);
  const [tileUrl] = useState(readTileUrl);
  const [sceneReady, setSceneReady] = useState(false);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  /** Id of the case the camera has finished flying to. */
  const [arrivedId, setArrivedId] = useState<string | null>(null);

  const aspect = size.height > 0 ? size.width / size.height : 1.6;
  const desktop = size.width >= DESKTOP_MIN_WIDTH;

  const featured = useMemo(() => events.filter((e) => e.featured), [events]);
  const allFeatured = useMemo(() => allEvents.filter((e) => e.featured), [allEvents]);
  const selectedEvent = useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? null,
    [allEvents, selectedId],
  );

  useEffect(() => {
    syncMarkers(new Set(featured.map((e) => e.id)));
  }, [featured]);

  /* ----------------------------- camera flights ---------------------------- */

  const flightRef = useRef<Flight | null>(null);
  const flyingRef = useRef(false);
  /** Where the camera was before the first case was opened, to return to it. */
  const savedViewRef = useRef<View | null>(null);
  /** The case the camera was last sent to. */
  const focusedIdRef = useRef<string | null>(null);

  const goTo = useCallback(
    (view: View, onDone?: () => void) => {
      const globe = globeRef.current;
      if (!globe) return;
      flightRef.current?.cancel();
      if (reducedMotion) {
        jumpCamera(globe, view);
        flyingRef.current = false;
        flightRef.current = null;
        onDone?.();
        return;
      }
      flyingRef.current = true;
      flightRef.current = flyCamera(globe, view, {
        onDone: () => {
          flyingRef.current = false;
          flightRef.current = null;
          onDone?.();
        },
      });
    },
    [reducedMotion],
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
    globeApi.current = { navigate };
    return () => {
      globeApi.current = null;
    };
  }, [navigate]);

  // Closing a case (Esc, ✕) takes the camera back to where it was.
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = prevSelectedRef.current;
    prevSelectedRef.current = selectedId;
    if (selectedId !== null) return;

    if (previous === null) return;

    const saved = savedViewRef.current;
    savedViewRef.current = null;

    const state = useAppStore.getState();
    const trail = state.trail.filter((t) => t.kind !== "event");
    const last = trail[trail.length - 1];
    const backToOrbit = saved !== null && saved.altitude > 0.9;
    selectProvince(!backToOrbit && last?.kind === "province" ? (last.provinceId ?? null) : null);
    setTrail(backToOrbit ? [] : trail);
    if (saved) goTo(saved);
  }, [selectedId, goTo, selectProvince, setTrail]);

  /* ----------------------------- globe lifecycle --------------------------- */

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;

    globe.pointOfView(WORLD_VIEW, 0);

    const controls = globe.controls();
    controls.enableDamping = true;
    controls.autoRotateSpeed = 0.35;
    controls.minDistance = tileUrl ? TILE_MIN_DISTANCE : MIN_DISTANCE;
    globe.renderer().setPixelRatio(Math.min(MAX_PIXEL_RATIO, window.devicePixelRatio));
    controls.maxDistance = MAX_DISTANCE;
    controls.zoomSpeed = 0.7;

    // The user grabbing the globe ends any flight in progress.
    const stopFlight = () => {
      flightRef.current?.cancel();
      flightRef.current = null;
      flyingRef.current = false;
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

    sharpenGlobeTexture(globe.renderer().capabilities.getMaxAnisotropy());

    setSceneReady(true);
    setGlobeReady(true);
  }, [setGlobeReady, tileUrl]);

  // Relief shading is invisible up close and costs a full-screen pass there.
  const close = lod === "country" || lod === "ground";
  useEffect(() => {
    if (!sceneReady) return;
    const next = close ? 0 : 9;
    if (GLOBE_MATERIAL.bumpScale !== next) GLOBE_MATERIAL.bumpScale = next;
  }, [close, sceneReady]);

  // Every camera move: update the zoom level and slow the drag when close.
  const handleZoom = useCallback(
    ({ altitude }: { altitude: number }) => {
      const next: Lod = lodFromAltitude(altitude);
      setLod(next);

      const controls = globeRef.current?.controls();
      if (controls) controls.rotateSpeed = Math.min(1, Math.max(0.1, altitude * 0.9));

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
      activate: focusEvent,
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

  // Province counts feed the borders' tint.
  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!provinces.length) return counts;
    for (const event of events) {
      const hit = provinces.find((p) => pointInRegion(event.lon, event.lat, p));
      if (hit) counts.set(hit.id, (counts.get(hit.id) ?? 0) + 1);
    }
    return counts;
  }, [events, provinces]);

  const showProvinces = lod === "country" || lod === "ground";

  // Provinces replace the national outline of the Dominican Republic once close.
  const regions = useMemo<RegionFeature[]>(() => {
    if (!countries.length) return NO_REGIONS;
    return showProvinces ? [...countries.filter((c) => c.id !== DR_ISO), ...provinces] : countries;
  }, [countries, provinces, showProvinces]);

  const regionCapColor = useCallback(
    (d: object): string => {
      const r = asRegion(d);
      const hovered = r.id === hoveredRegionId;
      if (r.kind === "province") {
        if (hovered) return `rgba(${ACCENT_RGB}, 0.34)`;
        if (r.id === selectedProvinceId) return `rgba(${ACCENT_RGB}, 0.2)`;
        const count = provinceCounts.get(r.id) ?? 0;
        return count > 0
          ? `rgba(110, 168, 255, ${(0.1 + Math.min(count, 6) * 0.04).toFixed(2)})`
          : "rgba(255, 255, 255, 0.02)";
      }
      if (hovered) return "rgba(233, 237, 245, 0.16)";
      if (r.id === DR_ISO) return `rgba(${ACCENT_RGB}, ${lod === "orbit" ? 0.07 : 0.03})`;
      // Spotlight: the rest of the land dims once we are in the region.
      return lod === "orbit" ? "rgba(0, 0, 0, 0)" : "rgba(3, 5, 10, 0.24)";
    },
    [hoveredRegionId, selectedProvinceId, provinceCounts, lod],
  );

  const regionStrokeColor = useCallback(
    (d: object): string => {
      const r = asRegion(d);
      if (r.kind === "province") {
        return r.id === hoveredRegionId ? "rgba(255, 232, 190, 1)" : `rgba(${ACCENT_RGB}, 0.72)`;
      }
      if (r.id === DR_ISO) return `rgba(${ACCENT_RGB}, 0.95)`;
      return lod === "orbit" ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.38)";
    },
    [hoveredRegionId, lod],
  );

  const regionAltitude = useCallback(
    (d: object): number => {
      const r = asRegion(d);
      if (r.kind === "province") return 0.0025;
      return r.id === DR_ISO ? 0.002 : 0.0012;
    },
    [],
  );

  const regionLabel = useCallback(
    (d: object): string => {
      const r = asRegion(d);
      const isProvince = r.kind === "province";
      const count = isProvince ? (provinceCounts.get(r.id) ?? 0) : 0;
      return (
        `<div class="ge-tooltip">` +
        `<div class="ge-tooltip-type" style="color:var(--color-accent)">${isProvince ? "Province" : "Country"}</div>` +
        `<div class="ge-tooltip-name">${escapeHtml(r.name)}</div>` +
        (isProvince
          ? `<div class="ge-tooltip-place">${count} signal${count === 1 ? "" : "s"} · Click to zoom in</div>`
          : `<div class="ge-tooltip-place">Click to zoom in</div>`) +
        `</div>`
      );
    },
    [provinceCounts],
  );

  const handleRegionHover = useCallback((d: object | null) => {
    setHoveredRegionId(d ? asRegion(d).id : null);
  }, []);

  const handleRegionClick = useCallback(
    (d: object) => {
      const r = asRegion(d);
      if (r.kind === "province") goToProvince(r);
      else goToCountry(r);
    },
    [goToCountry, goToProvince],
  );

  const handleGlobeClick = useCallback(() => select(null), [select]);
  const handlePointClick = useCallback((d: object) => focusEvent(asEvent(d)), [focusEvent]);

  /* -------------------------------- events --------------------------------- */

  const markerScale = LOD_MARKER_SCALE[lod];

  const pointAltitude = useCallback(
    (d: object): number => {
      const e = asEvent(d);
      return lod === "region" ? 0.006 + e.magnitude * 0.03 : 0.003;
    },
    [lod],
  );

  const pointRadius = useCallback(
    (d: object): number => {
      const e = asEvent(d);
      return (e.featured ? 0.46 : 0.14 + e.magnitude * 0.26) * markerScale;
    },
    [markerScale],
  );

  const ringsData = useMemo(() => {
    if (reducedMotion) return NO_EVENTS;
    if (selectedEvent && !featured.some((e) => e.id === selectedEvent.id)) {
      return [...featured, selectedEvent];
    }
    return featured;
  }, [reducedMotion, featured, selectedEvent]);

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

  // Dashed outline around the selected case.
  const footprints = useMemo<Footprint[]>(() => {
    if (!selectedEvent) return [];
    const area = detail?.id === selectedEvent.id ? detail.areaKm2 : null;
    const realKm = area !== null ? Math.sqrt(area / Math.PI) : 4 + selectedEvent.magnitude * 22;
    // Never smaller than the eye can follow at arrival altitude.
    const radiusKm = Math.max(realKm, 14);
    return [
      {
        id: selectedEvent.id,
        color: `rgba(${CHANGE_TYPES[selectedEvent.type].rgb.join(", ")}, 0.95)`,
        points: circlePoints(selectedEvent.lat, selectedEvent.lon, radiusKm),
      },
    ];
  }, [selectedEvent, detail]);

  // The callout card appears once the camera has arrived.
  const htmlData = useMemo<HtmlDatum[]>(() => {
    if (!selectedEvent || arrivedId !== selectedEvent.id) return allFeatured;
    return [...allFeatured, toCalloutDatum(selectedEvent, detail)];
  }, [allFeatured, selectedEvent, arrivedId, detail]);

  const orbit = lod === "orbit";
  const hexData = orbit ? events : NO_EVENTS;
  const pointsData = orbit ? NO_EVENTS : events;
  const hexClick = useCallback(
    (_hex: object, _event: MouseEvent, coords: { lat: number; lng: number }) => {
      goTo({ lat: coords.lat, lng: coords.lng, altitude: 0.5 });
    },
    [goTo],
  );

  /* --------------------------------- render -------------------------------- */

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

  const quiet = reducedMotion || timelineOn;

  return (
    <div ref={containerRef} className="ge-globe h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor={BACKGROUND_COLOR}
          backgroundImageUrl={starfieldUrl || null}
          rendererConfig={RENDERER_CONFIG}
          globeTileEngineUrl={tileUrl}
          globeImageUrl="/textures/earth-blue-marble.jpg"
          bumpImageUrl="/textures/earth-topology.png"
          globeMaterial={GLOBE_MATERIAL}
          showAtmosphere
          atmosphereColor={ATMOSPHERE_COLOR}
          atmosphereAltitude={0.19}
          onGlobeReady={handleGlobeReady}
          onGlobeClick={handleGlobeClick}
          onZoom={handleZoom}
          // Borders: countries, and the provinces of the Dominican Republic up close
          polygonsData={regions}
          polygonGeoJsonGeometry={asRegionGeometry}
          polygonCapColor={regionCapColor}
          polygonSideColor={noSideColor}
          polygonStrokeColor={regionStrokeColor}
          polygonAltitude={regionAltitude}
          polygonLabel={regionLabel}
          polygonsTransitionDuration={0}
          onPolygonHover={handleRegionHover}
          onPolygonClick={handleRegionClick}
          // Orbit: how busy each area is
          hexBinPointsData={hexData}
          hexBinPointLat={pointLat}
          hexBinPointLng={pointLng}
          hexBinPointWeight={hexWeight}
          hexBinResolution={2}
          hexMargin={hexMargin}
          hexAltitude={hexAltitude}
          hexTopColor={hexTop}
          hexSideColor={hexSide}
          hexLabel={hexLabel}
          hexTransitionDuration={quiet ? 0 : 600}
          onHexClick={hexClick}
          // Region and closer: every signal as a flat disc
          pointsData={pointsData}
          pointLat={pointLat}
          pointLng={pointLng}
          pointColor={pointColor}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointResolution={10}
          pointsMerge={false}
          // While the timeline runs the data changes every few frames: a grow-in
          // tween would be restarted before it could finish.
          pointsTransitionDuration={quiet ? 0 : POINT_TRANSITION_MS}
          pointLabel={pointLabel}
          onPointClick={handlePointClick}
          // Pulsing rings: featured cases and the selected one
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
          // Focusable DOM markers (featured) and the selected case's callout
          htmlElementsData={htmlData}
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

