import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Audience } from "@/store/useAppStore";

/** The classroom keeps only the most recent cases a teacher or student chose to keep. */
export const MAX_SAVED = 3;

/** How a case was being looked at when it was saved, so it opens the same way. */
export interface SavedView {
  audience: Audience;
  story: boolean;
}

export interface SavedCase extends SavedView {
  /** The case id (also the key: a case is saved once). */
  id: string;
  savedAt: number;
}

interface ClassroomState {
  items: SavedCase[];
  /** Whether the Aula list is showing (not saved). */
  open: boolean;
  /** A case waiting for the user to pick which saved one to replace (not saved). */
  pending: ({ id: string } & SavedView) | null;

  setOpen: (open: boolean) => void;
  /** Save a case. When the list is full, asks which one to replace. */
  save: (id: string, view: SavedView) => void;
  replace: (oldId: string) => void;
  cancelPending: () => void;
  remove: (id: string) => void;
}

const newestFirst = (items: SavedCase[]): SavedCase[] => [...items].sort((a, b) => b.savedAt - a.savedAt);

export const useClassroomStore = create<ClassroomState>()(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      pending: null,

      setOpen: (open) => set(open ? { open } : { open, pending: null }),

      save: (id, view) => {
        const { items } = get();
        const entry: SavedCase = { id, savedAt: Date.now(), ...view };
        if (items.some((item) => item.id === id)) {
          set({ items: newestFirst(items.map((item) => (item.id === id ? entry : item))) });
        } else if (items.length < MAX_SAVED) {
          set({ items: newestFirst([entry, ...items]) });
        } else {
          set({ pending: { id, ...view }, open: true });
        }
      },

      replace: (oldId) => {
        const { items, pending } = get();
        if (!pending) return;
        const { id, ...view } = pending;
        set({
          items: newestFirst([{ id, savedAt: Date.now(), ...view }, ...items.filter((item) => item.id !== oldId)]),
          pending: null,
        });
      },

      cancelPending: () => set({ pending: null }),

      remove: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
    }),
    {
      name: "ge-classroom",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
