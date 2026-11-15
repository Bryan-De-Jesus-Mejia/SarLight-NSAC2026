import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ChatAction } from "@/lib/assistant/types";

/** Only the most recent chats are kept. */
export const MAX_CHATS = 3;
export const NEW_CHAT_TITLE = "New chat";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  /** Buttons under an answer (fly to a case, open its story...). */
  actions?: ChatAction[];
  /** Who wrote an answer: the language model or the offline guide. */
  via?: "ai" | "guide";
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

interface ChatState {
  chats: Chat[];
  activeId: string | null;
  /** Whether the side panel is showing (not saved). */
  open: boolean;

  openChat: () => void;
  /** Hide the panel. The chat itself stays. */
  closeChat: () => void;
  /** Start a chat (or reuse the current one when it is still empty). Returns its id. */
  newChat: () => string;
  selectChat: (id: string) => void;
  deleteChat: (id: string) => void;
  addMessage: (chatId: string, role: ChatMessage["role"], text: string, extra?: Pick<ChatMessage, "actions" | "via">) => void;
}

const makeId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const titleFrom = (text: string): string => {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > 34 ? `${line.slice(0, 33)}…` : line;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      chats: [],
      activeId: null,
      open: false,

      openChat: () => set({ open: true }),
      closeChat: () => set({ open: false }),

      newChat: () => {
        const { chats, activeId } = get();
        const current = chats.find((c) => c.id === activeId);
        if (current && current.messages.length === 0) return current.id;

        const chat: Chat = { id: makeId(), title: NEW_CHAT_TITLE, messages: [], updatedAt: Date.now() };
        // Newest first; whatever falls past the limit is the oldest one.
        const kept = [chat, ...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
        set({ chats: kept, activeId: chat.id });
        return chat.id;
      },

      selectChat: (id) => {
        if (get().chats.some((c) => c.id === id)) set({ activeId: id });
      },

      deleteChat: (id) =>
        set((state) => {
          const chats = state.chats.filter((c) => c.id !== id);
          const activeId =
            state.activeId === id
              ? ([...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null)
              : state.activeId;
          return { chats, activeId };
        }),

      addMessage: (chatId, role, text, extra) =>
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id !== chatId) return chat;
            const message: ChatMessage = { id: makeId(), role, text, at: Date.now(), ...extra };
            return {
              ...chat,
              title: chat.title === NEW_CHAT_TITLE && role === "user" ? titleFrom(text) : chat.title,
              messages: [...chat.messages, message],
              updatedAt: message.at,
            };
          }),
        })),
    }),
    {
      name: "ge-chats",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ chats: state.chats, activeId: state.activeId }),
    },
  ),
);

/**
 * The reply being written right now. Kept apart (and never saved) because it
 * changes many times a second; it joins the chat once it is finished.
 */
interface StreamState {
  chatId: string | null;
  phase: "idle" | "thinking" | "typing";
  text: string;
}

export const useChatStream = create<StreamState>(() => ({ chatId: null, phase: "idle", text: "" }));
