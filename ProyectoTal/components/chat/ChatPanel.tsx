"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePopover } from "@/hooks/usePopover";
import { useLang, useT, type TFunction } from "@/i18n/core";
import { MAX_LENGTH, SUGGESTIONS, dropReplyFor, sendMessage, stopReply } from "@/lib/chatSimulation";
import { formatClock, formatDayMonth } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";
import { MAX_CHATS, NEW_CHAT_TITLE, useChatStore, useChatStream, type Chat, type ChatMessage } from "@/store/useChatStore";

const MAX_INPUT_HEIGHT = 140;
const NEAR_BOTTOM_PX = 120;

function Icon({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const when = (at: number, t: TFunction): string => {
  const time = formatClock(at);
  return new Date(at).toDateString() === new Date().toDateString()
    ? t("Today, {time}", { time })
    : t("{date}, {time}", { date: formatDayMonth(at), time });
};

function Bubble({ message }: { message: ChatMessage }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm border border-line bg-white/[0.07] px-3 py-2 text-sm leading-relaxed text-ink">
          {message.text}
        </p>
      </div>
    );
  }

  const copy = () => {
    void navigator.clipboard?.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className="group flex gap-2.5">
      <span className="mt-1 h-full min-h-4 w-[2px] shrink-0 rounded-full bg-accent/60" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/90">{message.text}</p>
        <button
          type="button"
          onClick={copy}
          className="mt-1 flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Icon size={12}>
            <rect x="8.500" y="8.500" width="11" height="11" rx="2" />
            <path d="M5.500 15.500h-.5a1.500 1.500 0 0 1-1.500-1.500V5A1.500 1.500 0 0 1 5 3.500h9A1.500 1.500 0 0 1 15.500 5v.5" />
          </Icon>
          {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
    </div>
  );
}

function Typing({ text, thinking }: { text: string; thinking: boolean }) {
  const t = useT();
  return (
    <div className="flex gap-2.5" role="status" aria-label={thinking ? t("The assistant is thinking") : undefined}>
      <span className="mt-1 h-full min-h-4 w-[2px] shrink-0 rounded-full bg-accent/60" aria-hidden="true" />
      {thinking ? (
        <span className="ge-typing mt-2" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink/90">
          {text}
          <span className="ge-caret" aria-hidden="true" />
        </p>
      )}
    </div>
  );
}

/** Side panel with the assistant. The answers are simulated for now (lib/chatSimulation). */
export function ChatPanel() {
  const t = useT();
  const lang = useLang();
  const open = useChatStore((s) => s.open);
  const chats = useChatStore((s) => s.chats);
  const activeId = useChatStore((s) => s.activeId);
  const closeChat = useChatStore((s) => s.closeChat);
  const newChat = useChatStore((s) => s.newChat);
  const selectChat = useChatStore((s) => s.selectChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const stream = useChatStream();
  const takenOver = useAppStore((s) => s.demoActive || s.story);

  const [value, setValue] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const drafts = useRef(new Map<string, string>());

  const active: Chat | null = chats.find((c) => c.id === activeId) ?? null;
  const messages = active?.messages ?? [];
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const replying = stream.phase !== "idle";
  const showStream = replying && stream.chatId === active?.id;

  const closeList = useCallback(() => setListOpen(false), []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setConfirming(false);
  }, []);
  const listRef = usePopover(closeList, listOpen);
  const menuRef = usePopover(closeMenu, menuOpen);

  const hide = useCallback(() => {
    closeChat();
    document.getElementById("ge-chat-button")?.focus();
  }, [closeChat]);

  // Focus the box when the panel opens.
  useEffect(() => {
    if (!open || takenOver) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, takenOver]);

  // Escape hides the panel (popovers handle their own Escape first).
  useEffect(() => {
    if (!open || takenOver) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, takenOver, hide]);

  // Keep the newest text in view, unless the reader scrolled up.
  useEffect(() => {
    const log = logRef.current;
    if (log && stick.current) log.scrollTop = log.scrollHeight;
  }, [messages.length, stream.text, stream.phase, active?.id, open]);

  // The box grows with its text, up to a limit.
  useEffect(() => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [value, open]);

  if (!open || takenOver) return null;

  const remember = () => {
    if (active) drafts.current.set(active.id, value);
  };
  const switchTo = (id: string) => {
    remember();
    selectChat(id);
    setValue(drafts.current.get(id) ?? "");
    stick.current = true;
    setListOpen(false);
  };
  const startNew = () => {
    remember();
    const id = newChat();
    setValue(drafts.current.get(id) ?? "");
    stick.current = true;
    setListOpen(false);
    closeMenu();
    inputRef.current?.focus();
  };
  const remove = () => {
    if (!active) return;
    dropReplyFor(active.id);
    drafts.current.delete(active.id);
    deleteChat(active.id);
    setValue("");
    closeMenu();
  };

  const submit = (text = value) => {
    if (!text.trim() || replying) return;
    stick.current = true;
    sendMessage(text);
    if (active) drafts.current.delete(active.id);
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter is a new line. Leave IME composition alone.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const onScroll = () => {
    const log = logRef.current;
    if (log) stick.current = log.scrollHeight - log.scrollTop - log.clientHeight < NEAR_BOTTOM_PX;
  };

  const left = MAX_LENGTH - value.length;
  const titleOf = (chat: Chat): string => (chat.title === NEW_CHAT_TITLE ? t("New chat") : chat.title);

  return (
    <aside
      role="dialog"
      aria-label={t("Assistant chat")}
      className="ge-chat ge-surface pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex max-h-[85dvh] flex-col rounded-b-none md:inset-x-auto md:bottom-5 md:right-5 md:top-[4.75rem] md:max-h-none md:w-[27rem] md:rounded-lg"
    >
      <header className="relative flex items-center gap-2 border-b border-line px-3 py-2.5">
        <div ref={listRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={listOpen}
            onClick={() => setListOpen((v) => !v)}
            className="flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-[1.15rem] leading-tight text-ink">{active ? titleOf(active) : t("Ask the globe")}</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {t("Guided answers · offline, not an AI")}
                {chats.length > 1 ? ` · ${t("{n} chats", { n: chats.length })}` : ""}
              </span>
            </span>
            <Icon size={14}>
              <path d="m6 9 6 6 6-6" />
            </Icon>
          </button>

          {listOpen && (
            <ul role="listbox" aria-label={t("Your chats")} className="ge-surface absolute left-0 top-[calc(100%+4px)] z-10 w-full overflow-hidden p-1 shadow-xl">
              {sorted.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={chat.id === activeId}
                    onClick={() => switchTo(chat.id)}
                    className={`flex w-full flex-col rounded px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] ${chat.id === activeId ? "bg-white/[0.07]" : ""}`}
                  >
                    <span className="truncate text-sm text-ink">{titleOf(chat)}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {t("{n, plural, one {# message} other {# messages}}", { n: chat.messages.length })} · {when(chat.updatedAt, t)}
                    </span>
                  </button>
                </li>
              ))}
              <li className="mt-1 border-t border-line pt-1">
                <button type="button" onClick={startNew} className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-sm text-ink transition-colors hover:bg-white/[0.07]">
                  <Icon size={14}>
                    <path d="M12 5v14M5 12h14" />
                  </Icon>
                  {t("New chat")}
                </button>
                <p className="px-2.5 pb-1.5 pt-0.5 text-[11px] leading-snug text-muted">{t("The last {max} chats are kept.", { max: MAX_CHATS })}</p>
              </li>
            </ul>
          )}
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            aria-label={t("Chat options")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            className="ge-demo-button"
          >
            <Icon>
              <circle cx="5.500" cy="12" r="1.100" fill="currentColor" />
              <circle cx="12" cy="12" r="1.100" fill="currentColor" />
              <circle cx="18.500" cy="12" r="1.100" fill="currentColor" />
            </Icon>
          </button>

          {menuOpen && (
            <div role="menu" aria-label={t("Chat options")} className="ge-surface absolute right-0 top-[calc(100%+4px)] z-10 w-52 p-1 shadow-xl">
              {confirming ? (
                <div className="p-2.5">
                  <p className="text-sm leading-snug text-ink">{t("Delete this chat for good?")}</p>
                  <div className="mt-2.5 flex justify-end gap-1.5">
                    <button type="button" onClick={() => setConfirming(false)} className="ge-demo-text-button">
                      {t("Cancel")}
                    </button>
                    <button type="button" onClick={remove} className="ge-demo-text-button ge-demo-text-button--danger">
                      {t("Delete")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" role="menuitem" onClick={startNew} className="ge-menu-item">
                    <Icon size={14}>
                      <path d="M12 5v14M5 12h14" />
                    </Icon>
                    {t("New chat")}
                  </button>
                  <button type="button" role="menuitem" onClick={hide} className="ge-menu-item">
                    <Icon size={14}>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </Icon>
                    {t("Close chat")}
                  </button>
                  <button type="button" role="menuitem" disabled={!active} onClick={() => setConfirming(true)} className="ge-menu-item ge-menu-item--danger">
                    <Icon size={14}>
                      <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
                    </Icon>
                    {t("Delete chat")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div ref={logRef} onScroll={onScroll} role="log" aria-live="polite" aria-label={t("Conversation")} className="ge-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !showStream ? (
          <div className="pt-2">
            <p className="font-display text-[1.6rem] leading-[1.1] text-ink">{t("Ask about what you see on the map.")}</p>
            <ul className="mt-4 space-y-1.5" aria-label={t("Suggested questions")}>
              {SUGGESTIONS[lang].map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => submit(question)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-left text-sm text-ink transition-colors hover:border-white/30 hover:bg-white/[0.05]"
                  >
                    {question}
                    <Icon size={14}>
                      <path d="m9 6 6 6-6 6" />
                    </Icon>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {showStream && <Typing text={stream.text} thinking={stream.phase === "thinking"} />}
          </>
        )}
      </div>

      <footer className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-lg border border-line bg-black/20 p-1.5 focus-within:border-white/35">
          <textarea
            ref={inputRef}
            value={value}
            rows={1}
            maxLength={MAX_LENGTH}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("Ask about radar, NISAR or what you see…")}
            aria-label={t("Message")}
            className="ge-scroll max-h-[140px] min-h-[2.25rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-ink outline-none placeholder:text-muted/70"
          />
          {replying ? (
            <button type="button" onClick={() => stopReply()} aria-label={t("Stop the reply")} title={t("Stop")} className="ge-send">
              <Icon size={14}>
                <rect x="6.500" y="6.500" width="11" height="11" rx="1.500" fill="currentColor" />
              </Icon>
            </button>
          ) : (
            <button type="button" onClick={() => submit()} disabled={!value.trim()} aria-label={t("Send message")} title={t("Send")} className="ge-send">
              <Icon size={15}>
                <path d="M12 19V5M6 11l6-6 6 6" />
              </Icon>
            </button>
          )}
        </div>
        {left <= 200 && (
          <p className={`mt-1.5 px-1 text-right font-mono text-[10px] tracking-[0.1em] ${left <= 0 ? "text-[#fb7185]" : "text-muted"}`}>{left}</p>
        )}
      </footer>
    </aside>
  );
}
