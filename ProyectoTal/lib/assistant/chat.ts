import { answer, languageOf, SUGGESTIONS } from "@/lib/assistant/engine";
import type { CaseFact } from "@/lib/assistant/facts";
import type { AssistantReply, ChatAction } from "@/lib/assistant/types";
import { globeApi } from "@/lib/globeApi";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore, useChatStream } from "@/store/useChatStore";

/**
 * Sending a message: a free language model answers when the server has one
 * configured (see app/api/chat); otherwise, or when it is busy, the offline
 * guide answers from the same case facts. Either way the answer is typed out
 * and the actions it asks for (fly to a case, open a story...) run on the globe.
 */

export const MAX_LENGTH = 1000;
export { SUGGESTIONS };

/* --------------------------- what the server has --------------------------- */

interface Setup {
  ai: boolean;
  facts: CaseFact[];
}
let setup: Promise<Setup> | null = null;
export function loadAssistant(): Promise<Setup> {
  setup ??= fetch("/api/chat")
    .then((r) => r.json() as Promise<Setup>)
    .catch(() => ({ ai: false, facts: [] }));
  return setup;
}
/** Set once the model failed for good this visit (no key, quota): stop trying. */
let aiOff = false;
export const useAssistantMode = { get: async () => (await loadAssistant()).ai && !aiOff };

/* ------------------------------- the actions ------------------------------- */

export function runAction(action: ChatAction): void {
  const app = useAppStore.getState();
  switch (action.kind) {
    case "fly":
      if (app.story) app.setStory(false);
      globeApi.current?.focusCase(action.id);
      break;
    case "story":
      app.select(action.id);
      app.setStory(true);
      useChatStore.getState().closeChat();
      break;
    case "lens":
      globeApi.current?.flyTo({ lat: 18.75, lng: -70.3, altitude: 0.6 });
      app.setLens(true);
      break;
    case "community":
      app.setCommunity(true);
      break;
    case "dance":
      app.setDance(true);
      break;
    case "demo":
      useChatStore.getState().closeChat();
      app.startDemo();
      break;
  }
}

/* ----------------------------- asking the model ----------------------------- */

async function askModel(chatId: string): Promise<AssistantReply | null> {
  const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
  if (!chat) return null;
  const app = useAppStore.getState();
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chat.messages.map((m) => ({ role: m.role, text: m.text })),
        audience: app.audience,
        openCase: app.selectedId,
      }),
    });
    if (res.status === 501) aiOff = true;
    if (!res.ok) return null;
    const body = (await res.json()) as { text?: string; actions?: ChatAction[] };
    if (!body.text) return null;
    const actions = body.actions ?? [];
    return { text: body.text, actions, run: actions };
  } catch {
    return null;
  }
}

/* --------------------------------- typing --------------------------------- */

let timer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on every send and stop, so a late answer for an old question is dropped. */
let ticket = 0;
let current: { chatId: string } | null = null;
const lastTopic = new Map<string, string>();

const idle = () => useChatStream.setState({ chatId: null, phase: "idle", text: "" });

/** Stop the reply in progress. What was already typed is kept as the answer. */
export function stopReply(options: { keepPartial?: boolean } = { keepPartial: true }): void {
  clearTimeout(timer);
  ticket += 1;
  const { chatId, text } = useChatStream.getState();
  if (options.keepPartial && chatId && text.trim()) {
    useChatStore.getState().addMessage(chatId, "assistant", `${text.trimEnd()} …`);
  }
  current = null;
  idle();
}

/** Throw away the reply in progress when its chat is deleted. */
export function dropReplyFor(chatId: string): void {
  if (current?.chatId === chatId) stopReply({ keepPartial: false });
}

function typeOut(chatId: string, reply: AssistantReply, via: "ai" | "guide"): void {
  const pieces = reply.text.split(/(\s+)/);
  let shown = 0;
  useChatStream.setState({ chatId, phase: "typing", text: "" });
  const mine = ticket;

  const tick = () => {
    if (mine !== ticket) return;
    shown = Math.min(pieces.length, shown + 4);
    useChatStream.setState({ text: pieces.slice(0, shown).join("") });
    if (shown < pieces.length) {
      timer = setTimeout(tick, 22);
      return;
    }
    // Buttons for what already ran would be noise; keep the others.
    const ran = new Set(reply.run.map((a) => JSON.stringify(a)));
    const buttons = reply.actions.filter((a) => !ran.has(JSON.stringify(a)));
    useChatStore.getState().addMessage(chatId, "assistant", reply.text, { actions: buttons, via });
    current = null;
    idle();
  };
  tick();
}

/** Send a message in the active chat (starting one if needed) and answer it. */
export function sendMessage(raw: string): void {
  const text = raw.trim().slice(0, MAX_LENGTH);
  if (!text || useChatStream.getState().phase !== "idle") return;

  const chats = useChatStore.getState();
  const hasActive = chats.chats.some((c) => c.id === chats.activeId);
  const chatId = hasActive && chats.activeId ? chats.activeId : chats.newChat();
  chats.addMessage(chatId, "user", text);

  ticket += 1;
  const mine = ticket;
  current = { chatId };
  useChatStream.setState({ chatId, phase: "thinking", text: "" });
  const started = Date.now();

  void (async () => {
    const { ai, facts } = await loadAssistant();
    let reply: AssistantReply | null = null;
    let via: "ai" | "guide" = "guide";
    if (ai && !aiOff) {
      reply = await askModel(chatId);
      if (reply) via = "ai";
    }
    if (!reply) {
      const app = useAppStore.getState();
      reply = answer(text, facts, { lastId: lastTopic.get(chatId), openId: app.selectedId });
      if (!reply.text) reply = { text: languageOf(text) === "es" ? "¿Puedes decirlo de otra forma?" : "Could you put that another way?", actions: [], run: [] };
      if (reply.topicId) lastTopic.set(chatId, reply.topicId);
    }
    // The offline guide answers instantly; a short pause reads as "thinking".
    const wait = Math.max(0, 450 - (Date.now() - started));
    timer = setTimeout(() => {
      if (mine !== ticket || !reply) return;
      reply.run.forEach(runAction);
      typeOut(chatId, reply, via);
    }, wait);
  })();
}
