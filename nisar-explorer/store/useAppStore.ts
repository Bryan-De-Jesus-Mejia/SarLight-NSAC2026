import { create } from "zustand";
import type {
  ApiErrorResponse,
  ChangeType,
  EventDetail,
  EventSummary,
  EventsMeta,
  EventsResponse,
} from "@/data/types";

import { DEFAULT_RADAR_DATE, type OverlayKind } from "@/lib/imagery";
import type { Lod, View } from "@/lib/geo";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

/** Who the app is talking to. Students read the simple view and also get the classroom tools. */
export type Audience = "general" | "technical" | "student";

export const AUDIENCES: readonly Audience[] = ["general", "technical", "student"];

export type TrailKind = "world" | "region" | "country" | "province" | "event";

/** One step of the breadcrumb, with the camera view that reaches it. */
export interface TrailItem {
  key: string;
  label: string;
  kind: TrailKind;
  view: View;
  /** Province id, for kind "province". */
  provinceId?: string;
  /** Event id, for kind "event". */
  eventId?: string;
}

interface AppState {
  events: EventSummary[];
  meta: EventsMeta | null;
  status: LoadStatus;
  errorMessage: string | null;
  globeReady: boolean;
  selectedId: string | null;
  /** Full detail of the selected event (null while loading or with none selected). */
  detail: EventDetail | null;
  detailStatus: LoadStatus;
  detailError: string | null;
  /** Change types to show. Empty means "all": no filter applied. */
  activeTypes: ChangeType[];
  /** Free-text search over name, place and type. */
  query: string;
  /** Day index within meta.timeRange, or null to show the whole period. */
  timelineDay: number | null;
  timelinePlaying: boolean;
  /** Zoom level of the camera (orbit / region / country / ground). */
  lod: Lod;
  /** Province highlighted by a click (Dominican Republic). */
  selectedProvinceId: string | null;
  /** Breadcrumb: where the camera has been taken, outermost first. */
  trail: TrailItem[];
  /** Real-data layer drawn over the planet. */
  overlay: OverlayKind;
  /** Day (YYYY-MM-DD) of the overlay pass. */
  overlayDate: string;

  setOverlay: (overlay: OverlayKind) => void;
  /** Before/after curtain over the overlay. */
  compare: boolean;
  /** Date shown left of the curtain; null means plain satellite imagery. */
  compareBefore: string | null;
  /** Curtain position, 0..1 from the left edge of the screen. */
  curtain: number;
  /** Radar colour class lit up from the legend (null for none). */
  radarClass: number | null;
  setCompare: (on: boolean) => void;
  setCompareBefore: (date: string | null) => void;
  setCurtain: (position: number) => void;
  setRadarClass: (klass: number | null) => void;
  /** Who the app is talking to: everyone (plain words, the default), a technical reader or a student. */
  audience: Audience;
  setAudience: (audience: Audience) => void;
  /** The "where the land changed most" card of the simple views. */
  intro: boolean;
  setIntro: (on: boolean) => void;
  /** Story mode: the open case told as a scroll (the case panel steps aside). */
  story: boolean;
  setStory: (on: boolean) => void;
  /** Radar lens: the day as a camera saw it, with the radar inside a circle that follows the pointer. */
  lens: boolean;
  setLens: (on: boolean) => void;
  /** "Is my community at risk?": the panel, whether the next globe tap picks the place, and the place. */
  community: boolean;
  communityPicking: boolean;
  communityPoint: { lat: number; lng: number } | null;
  setCommunity: (on: boolean) => void;
  setCommunityPicking: (on: boolean) => void;
  setCommunityPoint: (point: { lat: number; lng: number } | null) => void;
  /** "The satellite's dance": one real 12-day cycle of NISAR scenes painted on the planet. */
  dance: boolean;
  setDance: (on: boolean) => void;
  /** Radar image laid over the globe on the selected case (null for none). */
  drape: { url: string; opacity: number } | null;
  setDrape: (drape: { url: string; opacity: number } | null) => void;
  /** Guided demo. */
  demoActive: boolean;
  demoStep: number;
  demoPaused: boolean;
  startDemo: () => void;
  stopDemo: () => void;
  setDemoStep: (step: number) => void;
  setDemoPaused: (paused: boolean) => void;
  setOverlayDate: (date: string) => void;

  setLod: (lod: Lod) => void;
  selectProvince: (id: string | null) => void;
  setTrail: (trail: TrailItem[]) => void;
  loadEvents: () => Promise<void>;
  setGlobeReady: (ready: boolean) => void;
  /** Select an event (and load its detail), or clear the selection with null. */
  select: (id: string | null) => void;
  /** Re-request the detail of the selected event after a failure. */
  retryDetail: () => void;
  toggleType: (type: ChangeType) => void;
  setQuery: (query: string) => void;
  /** Reset the type filter (the search has its own clear button). */
  clearFilters: () => void;
  setTimelineDay: (day: number | null) => void;
  setTimelinePlaying: (playing: boolean) => void;
}

/** Details already fetched this session, so reopening a case is instant. */
const detailCache = new Map<string, EventDetail>();

const FALLBACK_ERROR = "The change signals could not be loaded.";

function isApiError(body: unknown): body is ApiErrorResponse {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const { error } = body as { error: unknown };
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

function isEventDetail(body: unknown): body is EventDetail {
  return typeof body === "object" && body !== null && "id" in body && "analyses" in body;
}

function isEventsResponse(body: unknown): body is EventsResponse {
  return (
    typeof body === "object" &&
    body !== null &&
    "events" in body &&
    Array.isArray((body as { events: unknown }).events) &&
    "meta" in body
  );
}

export const useAppStore = create<AppState>((set, get) => ({
  events: [],
  meta: null,
  status: "idle",
  errorMessage: null,
  globeReady: false,
  selectedId: null,
  detail: null,
  detailStatus: "idle",
  detailError: null,
  activeTypes: [],
  query: "",
  timelineDay: null,
  timelinePlaying: false,
  lod: "orbit",
  selectedProvinceId: null,
  trail: [],
  overlay: "none",
  overlayDate: DEFAULT_RADAR_DATE,

  setOverlay: (overlay) =>
    set((state) => ({ overlay, lens: false, compare: overlay === "none" ? false : state.compare })),
  compare: false,
  compareBefore: "2026-06-20",
  curtain: 0.5,
  radarClass: null,
  setCompare: (on) => set((state) => ({ compare: on, lens: on ? false : state.lens, overlay: on && state.overlay === "none" ? "radar" : state.overlay })),
  setCompareBefore: (date) => set({ compareBefore: date }),
  setCurtain: (position) => set({ curtain: position }),
  setRadarClass: (klass) => set({ radarClass: klass }),
  audience: "general",
  setAudience: (audience) => {
    try {
      window.localStorage.setItem("ge-audience", audience);
    } catch {
      // Private mode: the choice just does not survive a reload.
    }
    set({ audience });
  },
  intro: false,
  setIntro: (on) => set({ intro: on }),
  story: false,
  setStory: (on) => set(on ? { story: true, lens: false, dance: false, overlay: "none", compare: false } : { story: false }),
  lens: false,
  setLens: (on) => set(on ? { lens: true, overlay: "none", compare: false, dance: false } : { lens: false }),
  community: false,
  communityPicking: false,
  communityPoint: null,
  setCommunity: (on) => set(on ? { community: true, story: false } : { community: false, communityPicking: false }),
  setCommunityPicking: (on) => set({ communityPicking: on }),
  setCommunityPoint: (point) => set({ communityPoint: point, communityPicking: false }),
  dance: false,
  setDance: (on) => set(on ? { dance: true, lens: false, overlay: "none", compare: false } : { dance: false }),
  drape: null,
  setDrape: (drape) => {
    const current = get().drape;
    if (current?.url === drape?.url && current?.opacity === drape?.opacity) return;
    set({ drape });
  },
  demoActive: false,
  demoStep: 0,
  demoPaused: false,
  startDemo: () => set({ demoActive: true, demoStep: 0, demoPaused: false, compare: false, radarClass: null, lens: false, dance: false }),
  stopDemo: () => set({ demoActive: false, demoPaused: false, overlay: "none", compare: false, radarClass: null, lens: false }),
  setDemoStep: (step) => set({ demoStep: step }),
  setDemoPaused: (paused) => set({ demoPaused: paused }),
  setOverlayDate: (date) => set({ overlayDate: date }),
  setLod: (lod) => {
    if (get().lod !== lod) set({ lod });
  },
  selectProvince: (id) => set({ selectedProvinceId: id }),
  setTrail: (trail) => set({ trail }),

  loadEvents: async () => {
    if (get().status === "loading") return;
    set({ status: "loading", errorMessage: null });

    try {
      // The interface talks to this route only — never to a provider directly.
      const response = await fetch("/api/events");
      const body: unknown = await response.json().catch(() => null);

      if (isApiError(body)) throw new Error(body.error.message);
      if (!response.ok) throw new Error(`The server answered with status ${response.status}.`);
      if (!isEventsResponse(body)) throw new Error("The server sent an unexpected response.");

      set({ events: body.events, meta: body.meta, status: "ready" });
    } catch (error) {
      set({
        status: "error",
        errorMessage: error instanceof Error && error.message ? error.message : FALLBACK_ERROR,
      });
    }
  },

  setGlobeReady: (ready) => set({ globeReady: ready }),

  select: (id) => {
    if (id === null) {
      set({ selectedId: null, detail: null, detailStatus: "idle", detailError: null, drape: null, story: false });
      return;
    }
    if (id === get().selectedId && get().detailStatus !== "error") return;

    const cached = detailCache.get(id);
    if (cached) {
      set({ selectedId: id, detail: cached, detailStatus: "ready", detailError: null, drape: null });
      return;
    }

    set({ selectedId: id, detail: null, detailStatus: "loading", detailError: null, drape: null });

    void (async () => {
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(id)}`);
        const body: unknown = await response.json().catch(() => null);

        if (isApiError(body)) throw new Error(body.error.message);
        if (!response.ok) throw new Error(`The server answered with status ${response.status}.`);
        if (!isEventDetail(body)) throw new Error("The server sent an unexpected response.");

        detailCache.set(id, body);
        // Ignore the answer if the user has moved on to another case.
        if (get().selectedId === id) set({ detail: body, detailStatus: "ready" });
      } catch (error) {
        if (get().selectedId !== id) return;
        set({
          detailStatus: "error",
          detailError:
            error instanceof Error && error.message ? error.message : "This case could not be loaded.",
        });
      }
    })();
  },

  toggleType: (type) =>
    set((state) => ({
      activeTypes: state.activeTypes.includes(type)
        ? state.activeTypes.filter((t) => t !== type)
        : [...state.activeTypes, type],
    })),
  setQuery: (query) => set({ query }),
  clearFilters: () => set({ activeTypes: [] }),

  setTimelineDay: (day) =>
    set(day === null ? { timelineDay: null, timelinePlaying: false } : { timelineDay: day }),
  setTimelinePlaying: (playing) => set({ timelinePlaying: playing }),

  retryDetail: () => {
    const id = get().selectedId;
    if (id !== null && get().detailStatus === "error") get().select(id);
  },
}));
