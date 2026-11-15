"use client";

import { useT } from "@/i18n/core";
import { useChatStore } from "@/store/useChatStore";

/** Top-bar button that opens (or hides) the assistant panel. */
export function ChatButton() {
  const t = useT();
  const open = useChatStore((s) => s.open);
  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);

  return (
    <button
      id="ge-chat-button"
      type="button"
      aria-pressed={open}
      aria-label={t("Ask the assistant")}
      title={t("Ask the assistant")}
      onClick={open ? closeChat : openChat}
      className={`ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center transition-colors hover:text-accent ${open ? "text-accent" : "text-ink"}`}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7.500L7.500 20v-3.500H5A1.500 1.500 0 0 1 3.500 15V7A1.500 1.500 0 0 1 5 5.500z" />
        <path d="M8 10h8M8 13h5" />
      </svg>
    </button>
  );
}
