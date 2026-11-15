"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";
import { useClassroomStore } from "@/store/useClassroomStore";
import { useMenuStore } from "@/store/useMenuStore";
import { useOfflineStore } from "@/store/useOfflineStore";
import { usePassesStore } from "@/store/usePassesStore";

/**
 * Esc closes every panel and card on screen at once: the dock, the intro and
 * community cards, the open case, the chat, the menu and the tool panels.
 * Not while typing in a field (Esc clears it there), and not in story mode or
 * the tutorial, which close themselves with Esc.
 */
export function useEscapeClosesAll(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const app = useAppStore.getState();
      if (app.story || app.demoActive) return;
      app.closeDock();
      app.setIntro(false);
      app.setCommunity(false);
      if (app.selectedId) app.select(null);
      useChatStore.getState().closeChat();
      useMenuStore.getState().setOpen(false);
      useClassroomStore.getState().setOpen(false);
      useOfflineStore.getState().setOpen(false);
      usePassesStore.getState().setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
