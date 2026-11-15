import { create } from "zustand";

/** The menu with every command: a Ctrl+K window on desktop, a side drawer on phones. */
interface MenuState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));
