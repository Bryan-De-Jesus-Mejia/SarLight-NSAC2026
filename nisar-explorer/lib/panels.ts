"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";
import { useClassroomStore } from "@/store/useClassroomStore";
import { useOfflineStore } from "@/store/useOfflineStore";
import { usePassesStore } from "@/store/usePassesStore";

/**
 * The right-hand column holds one thing at a time. The tools that open there
 * (the assistant, "when does NISAR pass over me?", work offline and the
 * classroom list) close each other, and the case panel steps aside while one
 * of them is open: the case stays selected and comes back when the tool closes.
 */

type Tool = "chat" | "passes" | "offline" | "classroom";

const close: Record<Tool, () => void> = {
  chat: () => useChatStore.getState().closeChat(),
  passes: () => usePassesStore.getState().setOpen(false),
  offline: () => useOfflineStore.getState().setOpen(false),
  classroom: () => useClassroomStore.getState().setOpen(false),
};

const closeAllBut = (keep: Tool) => {
  for (const tool of Object.keys(close) as Tool[]) if (tool !== keep) close[tool]();
};

/** Mount once: whenever a right-hand tool opens, the others close. */
export function useExclusivePanels(): void {
  useEffect(() => {
    const unsubscribers = [
      useChatStore.subscribe((s, prev) => s.open && !prev.open && closeAllBut("chat")),
      usePassesStore.subscribe((s, prev) => s.open && !prev.open && closeAllBut("passes")),
      useOfflineStore.subscribe((s, prev) => s.open && !prev.open && closeAllBut("offline")),
      useClassroomStore.subscribe((s, prev) => s.open && !prev.open && closeAllBut("classroom")),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, []);
}

/** Whether a tool fills the right-hand column, read once (for event handlers). */
export function rightToolOpenNow(): boolean {
  return (
    useChatStore.getState().open ||
    usePassesStore.getState().open ||
    useOfflineStore.getState().open ||
    (useClassroomStore.getState().open && useAppStore.getState().audience === "student")
  );
}

/** True while a tool fills the right-hand column (the case panel and the corner buttons make room for it). */
export function useRightToolOpen(): boolean {
  const chat = useChatStore((s) => s.open);
  const passes = usePassesStore((s) => s.open);
  const offline = useOfflineStore((s) => s.open);
  const classroom = useClassroomStore((s) => s.open);
  // The classroom list only shows in the student view.
  const student = useAppStore((s) => s.audience === "student");
  return chat || passes || offline || (classroom && student);
}
