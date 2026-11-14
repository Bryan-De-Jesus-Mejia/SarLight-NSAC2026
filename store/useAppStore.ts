import { create } from "zustand";
import type { ApiErrorResponse, EventSummary, EventsMeta, EventsResponse } from "@/data/types";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

interface AppState {
  events: EventSummary[];
  meta: EventsMeta | null;
  status: LoadStatus;
  errorMessage: string | null;
  globeReady: boolean;
  selectedId: string | null;

  loadEvents: () => Promise<void>;
  setGlobeReady: (ready: boolean) => void;
  select: (id: string | null) => void;
}

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
  select: (id) => set({ selectedId: id }),
}));
