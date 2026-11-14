import { create } from "zustand";
import type {
  ApiErrorResponse,
  ChangeType,
  EventDetail,
  EventSummary,
  EventsMeta,
  EventsResponse,
} from "@/data/types";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

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
  /** Day index within meta.timeRange, or null to show the whole period. */
  timelineDay: number | null;
  timelinePlaying: boolean;

  loadEvents: () => Promise<void>;
  setGlobeReady: (ready: boolean) => void;
  /** Select an event (and load its detail), or clear the selection with null. */
  select: (id: string | null) => void;
  /** Re-request the detail of the selected event after a failure. */
  retryDetail: () => void;
  toggleType: (type: ChangeType) => void;
  clearTypes: () => void;
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
  return typeof body === "object" && body !== null && "id" in body && "metric" in body && "sar" in body;
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
  timelineDay: null,
  timelinePlaying: false,

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
      set({ selectedId: null, detail: null, detailStatus: "idle", detailError: null });
      return;
    }
    if (id === get().selectedId && get().detailStatus !== "error") return;

    const cached = detailCache.get(id);
    if (cached) {
      set({ selectedId: id, detail: cached, detailStatus: "ready", detailError: null });
      return;
    }

    set({ selectedId: id, detail: null, detailStatus: "loading", detailError: null });

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
  clearTypes: () => set({ activeTypes: [] }),

  setTimelineDay: (day) =>
    set(day === null ? { timelineDay: null, timelinePlaying: false } : { timelineDay: day }),
  setTimelinePlaying: (playing) => set({ timelinePlaying: playing }),

  retryDetail: () => {
    const id = get().selectedId;
    if (id !== null && get().detailStatus === "error") get().select(id);
  },
}));
