import { create } from "zustand";
import {
  clearAll,
  downloadCase,
  downloadGuide,
  downloadPack,
  keepForClassroom,
  keepStorage,
  readMeta,
  releaseFromClassroom,
  removeCase,
  removePack,
  storageInfo,
  type Meta,
} from "@/lib/offline";

/** What is kept on this device, what is downloading right now, and whether there is a connection. */
interface OfflineState {
  open: boolean;
  online: boolean;
  meta: Meta;
  /** Downloads in progress: a case id or "pack". */
  busy: Record<string, { done: number; total: number }>;
  failed: Record<string, true>;
  space: { usage: number; quota: number } | null;

  setOpen: (open: boolean) => void;
  setOnline: (online: boolean) => void;
  refresh: () => void;
  download: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  downloadPack: () => Promise<void>;
  removePack: () => Promise<void>;
  clear: () => Promise<void>;
}

const EMPTY_META: Meta = { cases: {}, packs: {}, essentials: false };

export const useOfflineStore = create<OfflineState>((set, get) => {
  const track = async (key: string, work: (progress: (done: number, total: number) => void) => Promise<void>) => {
    set((s) => ({ busy: { ...s.busy, [key]: { done: 0, total: 1 } }, failed: omit(s.failed, key) }));
    try {
      await keepStorage();
      await work((done, total) => set((s) => ({ busy: { ...s.busy, [key]: { done, total } } })));
    } catch {
      set((s) => ({ failed: { ...s.failed, [key]: true } }));
    } finally {
      set((s) => ({ busy: omit(s.busy, key) }));
      get().refresh();
    }
  };

  return {
    open: false,
    online: true,
    meta: EMPTY_META,
    busy: {},
    failed: {},
    space: null,

    setOpen: (open) => {
      set({ open });
      if (open) get().refresh();
    },
    setOnline: (online) => set({ online }),
    refresh: () => {
      set({ meta: readMeta() });
      void storageInfo().then((space) => set({ space }));
    },
    download: (id) =>
      track(id, async (progress) => {
        await downloadCase(id, "user", progress);
      }),
    remove: async (id) => {
      await removeCase(id);
      get().refresh();
    },
    downloadPack: () => track("pack", (progress) => downloadPack(progress)),
    removePack: async () => {
      await removePack();
      get().refresh();
    },
    clear: async () => {
      await clearAll();
      get().refresh();
    },
  };
});

function omit<T extends Record<string, unknown>>(source: T, key: string): T {
  const { [key]: _gone, ...rest } = source;
  void _gone;
  return rest as unknown as T;
}

/** The classroom keeps a case: its data and its study guide stay on the device (a few MB at most). */
export function keepCaseForClassroom(id: string): void {
  void keepForClassroom(id)
    .catch(() => undefined)
    .finally(() => useOfflineStore.getState().refresh());
}

/** The classroom lets go of a case. */
export function releaseCaseFromClassroom(id: string): void {
  void releaseFromClassroom(id)
    .catch(() => undefined)
    .finally(() => useOfflineStore.getState().refresh());
}

/** Study guide only (kept for the cases already on the device). */
export async function keepGuide(id: string): Promise<void> {
  await downloadGuide(id);
  useOfflineStore.getState().refresh();
}
