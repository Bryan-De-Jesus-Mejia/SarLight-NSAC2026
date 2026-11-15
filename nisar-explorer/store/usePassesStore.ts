import { create } from "zustand";

/** The "When does NISAR pass over me?" panel. */
interface PassesState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const usePassesStore = create<PassesState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
