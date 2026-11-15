"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { GlobeIcon } from "@/components/LanguageSelect";
import { ViewIcon, useViewOptions } from "@/components/ViewSelect";
import { LANGS, useLang, useLangStore, useT, type Lang } from "@/i18n/core";
import { globeApi } from "@/lib/globeApi";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";
import { MAX_SAVED, useClassroomStore } from "@/store/useClassroomStore";
import { useMenuStore } from "@/store/useMenuStore";
import { useOfflineStore } from "@/store/useOfflineStore";
import { usePassesStore } from "@/store/usePassesStore";

type Group = "explore" | "study" | "settings" | "learn";

interface Command {
  id: string;
  group: Group;
  label: string;
  hint: string;
  icon: ReactNode;
  /** Lit when the thing the command controls is on. */
  active?: boolean;
  /** A small count on the right. */
  badge?: string;
  /** Needs a pointer and room: left out of the phone drawer. */
  wide?: boolean;
  run: () => void;
}

const GROUPS: Group[] = ["explore", "study", "settings", "learn"];
const NAMES: Record<Lang, string> = { en: "English", es: "Español" };

function Glyph({ children, size = 17 }: { children: ReactNode; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Folds case and accents, so “mision” finds “misión”. */
const fold = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Gives the focus back to whichever menu button is on screen. */
export function focusMenuButton() {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>("[data-menu-button]"));
  buttons.find((button) => button.offsetParent !== null)?.focus();
}

/** Every command of the app that is not on screen by default. */
function useCommands(): Command[] {
  const t = useT();
  const router = useRouter();
  const lang = useLang();
  const setLang = useLangStore((s) => s.setLang);
  const viewOptions = useViewOptions();

  const hasEvents = useAppStore((s) => s.events.length > 0);
  const demoActive = useAppStore((s) => s.demoActive);
  const story = useAppStore((s) => s.story);
  const audience = useAppStore((s) => s.audience);
  const setAudience = useAppStore((s) => s.setAudience);
  const intro = useAppStore((s) => s.intro);
  const setIntro = useAppStore((s) => s.setIntro);
  const lens = useAppStore((s) => s.lens);
  const setLens = useAppStore((s) => s.setLens);
  const dance = useAppStore((s) => s.dance);
  const setDance = useAppStore((s) => s.setDance);
  const community = useAppStore((s) => s.community);
  const setCommunity = useAppStore((s) => s.setCommunity);
  const startDemo = useAppStore((s) => s.startDemo);
  const chatOpen = useChatStore((s) => s.open);
  const openChat = useChatStore((s) => s.openChat);
  const closeChat = useChatStore((s) => s.closeChat);
  const saved = useClassroomStore((s) => s.items.length);
  const setClassroomOpen = useClassroomStore((s) => s.setOpen);
  const setOfflineOpen = useOfflineStore((s) => s.setOpen);
  const setPassesOpen = usePassesStore((s) => s.setOpen);
  const downloaded = useOfflineStore((s) => Object.keys(s.meta.cases).length);

  const live = hasEvents && !demoActive && !story;
  const list: Command[] = [];

  if (live) {
    list.push({
      id: "demo",
      group: "explore",
      label: t("How to use SarLight"),
      hint: t("A step-by-step tour of every control"),
      icon: (
        <Glyph size={14}>
          <path d="M8 5.200v13.600a.6.6 0 0 0 .92.5l10.400-6.800a.6.6 0 0 0 0-1L8.920 4.700A.6.6 0 0 0 8 5.200z" fill="currentColor" stroke="none" />
        </Glyph>
      ),
      run: startDemo,
    });
    list.push({
      id: "community",
      group: "explore",
      label: t("Is my community at risk?"),
      hint: t("See what our radar found around a place"),
      icon: (
        <Glyph>
          <path d="M3.500 11.500 12 4l8.500 7.500M6 10v9.500h12V10M10 19.500v-5h4v5" />
        </Glyph>
      ),
      active: community,
      run: () => setCommunity(!community),
    });
    list.push({
      id: "passes",
      group: "explore",
      label: t("Next NISAR pass"),
      hint: t("See when the satellite can image a place"),
      icon: (
        <Glyph>
          <circle cx="12" cy="12" r="3" />
          <path d="M4.500 12a7.500 7.500 0 0 1 7.500-7.500M19.500 12A7.500 7.500 0 0 1 12 19.500M12 2v2M12 20v2M2 12h2M20 12h2" />
        </Glyph>
      ),
      run: () => setPassesOpen(true),
    });
    if (audience !== "technical") {
      list.push({
        id: "intro",
        group: "explore",
        label: t("Where the land changed most"),
        hint: t("The places where the radar saw the most change"),
        icon: (
          <Glyph>
            <path d="M4 6.500h16M4 12h10.500M4 17.500h6" />
          </Glyph>
        ),
        active: intro,
        run: () => setIntro(!intro),
      });
    }
    list.push({
      id: "lens",
      group: "explore",
      label: t("Cloud lens"),
      hint: t("The day as a camera saw it, with the ground under the clouds inside a circle"),
      icon: (
        <Glyph>
          <circle cx="10.500" cy="10.500" r="6.500" />
          <path d="M15.500 15.500 20 20M7.500 10.500h6" />
        </Glyph>
      ),
      active: lens,
      wide: true,
      run: () => {
        if (!lens) globeApi.current?.flyTo({ lat: 18.75, lng: -70.3, altitude: 0.6 });
        setLens(!lens);
      },
    });
    list.push({
      id: "dance",
      group: "explore",
      label: t("12-day dance of the satellite"),
      hint: t("Watch one real 12-day cycle of NISAR scenes cover the planet"),
      icon: (
        <Glyph>
          <circle cx="12" cy="12" r="8.500" />
          <path d="M5.500 17.500c3-7 8-10 13-11M12 3.500v2M12 18.500v2" />
        </Glyph>
      ),
      active: dance,
      wide: true,
      run: () => {
        if (dance) return setDance(false);
        // Seen from far away, so the whole planet fills in.
        globeApi.current?.flyTo({ lat: 12, lng: -45, altitude: 2.7 });
        setDance(true);
      },
    });
    if (audience === "student") {
      list.push({
        id: "classroom",
        group: "study",
        label: t("Classroom"),
        hint: t("Your saved cases and study guides"),
        icon: <ViewIcon audience="student" />,
        badge: saved > 0 ? `${saved}/${MAX_SAVED}` : undefined,
        run: () => setClassroomOpen(true),
      });
    }
    list.push({
      id: "offline",
      group: "study",
      label: t("Work offline"),
      hint: t("Keep cases and study guides on this device"),
      icon: (
        <Glyph>
          <path d="M12 4v10M7.500 10 12 14.500 16.500 10M5 19h14" />
        </Glyph>
      ),
      badge: downloaded > 0 ? String(downloaded) : undefined,
      run: () => setOfflineOpen(true),
    });
    list.push({
      id: "assistant",
      group: "study",
      label: t("Ask the assistant"),
      hint: t("Questions about what you see on the globe"),
      icon: (
        <Glyph>
          <path d="M5 5.500h14a1.500 1.500 0 0 1 1.500 1.500v8a1.500 1.500 0 0 1-1.500 1.500h-7.500L7.500 20v-3.500H5A1.500 1.500 0 0 1 3.500 15V7A1.500 1.500 0 0 1 5 5.500z" />
          <path d="M8 10h8M8 13h5" />
        </Glyph>
      ),
      active: chatOpen,
      run: chatOpen ? closeChat : openChat,
    });
  }

  for (const code of LANGS) {
    list.push({
      id: `lang-${code}`,
      group: "settings",
      label: t("Language: {name}", { name: NAMES[code] }),
      hint: t("Switch the whole app to this language"),
      icon: <GlobeIcon size={17} />,
      active: lang === code,
      run: () => setLang(code),
    });
  }
  if (live) {
    for (const option of viewOptions) {
      list.push({
        id: `view-${option.value}`,
        group: "settings",
        label: option.label,
        hint: option.hint ?? "",
        icon: option.icon,
        active: audience === option.value,
        run: () => setAudience(option.value),
      });
    }
  }

  if (!story) {
    list.push({
      id: "methods",
      group: "learn",
      label: t("How it works"),
      hint: t("The data and methods behind the globe"),
      icon: (
        <Glyph>
          <path d="M5 4.500h9.500a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9.500M9 8.500h5" />
        </Glyph>
      ),
      run: () => router.push("/methods"),
    });
  }

  return list;
}

/** A row of choices that works on a touch screen (language, view) inside the drawer. */
function Choices<V extends string>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: V;
  options: { value: V; label: string; hint?: string; icon?: ReactNode }[];
  onChange: (value: V) => void;
  columns?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={columns ? "grid grid-cols-2 gap-1.5" : "grid gap-1.5"}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className="ge-choice"
          >
            {option.icon && <span className="shrink-0 text-muted">{option.icon}</span>}
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[13px] font-medium text-ink">{option.label}</span>
              {option.hint && <span className="mt-0.5 block text-xs leading-snug text-muted">{option.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MenuPanel() {
  const t = useT();
  const lang = useLang();
  const setLang = useLangStore((s) => s.setLang);
  const audience = useAppStore((s) => s.audience);
  const setAudience = useAppStore((s) => s.setAudience);
  const live = useAppStore((s) => s.events.length > 0 && !s.demoActive && !s.story);
  const viewOptions = useViewOptions();
  const setOpen = useMenuStore((s) => s.setOpen);
  const commands = useCommands();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Where the focus goes back to when the menu is dismissed without choosing anything.
  const restoreRef = useRef<HTMLElement | null>(null);
  const choseRef = useRef(false);

  const needle = fold(query.trim());
  const matching = needle ? commands.filter((c) => fold(`${c.label} ${c.hint}`).includes(needle)) : commands;
  // In the order they are drawn, so the arrow keys and the list agree.
  const visible = GROUPS.flatMap((group) => matching.filter((c) => c.group === group));
  const current = Math.min(active, Math.max(visible.length - 1, 0));

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const narrow = window.matchMedia("(max-width: 767px)").matches;
    (narrow ? closeRef.current : inputRef.current)?.focus();
    return () => {
      if (!choseRef.current) restoreRef.current?.focus?.();
    };
  }, []);

  // Escape closes only this window, and Tab stays inside it.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("button, input, a[href], [tabindex]:not([tabindex='-1'])")).filter(
        (el) => el.offsetParent !== null && !el.hasAttribute("disabled"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const here = document.activeElement;
      if (event.shiftKey && (here === first || !panelRef.current.contains(here))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (here === last || !panelRef.current.contains(here))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [setOpen]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    choseRef.current = true;
    setOpen(false);
    command.run();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (visible.length ? (Math.min(i, visible.length - 1) + 1) % visible.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (visible.length ? (Math.min(i, visible.length - 1) - 1 + visible.length) % visible.length : 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(visible.length - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(visible[current]);
    }
  };

  const groupNames: Record<Group, string> = {
    explore: t("Explore"),
    study: t("Ask and study"),
    settings: t("Settings"),
    learn: t("Learn"),
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="ge-scrim absolute inset-0" onClick={() => setOpen(false)} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t("Menu")} className="ge-menu-panel">
        {/* Desktop: a search field over the list. */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 max-md:hidden">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
            <circle cx="11" cy="11" r="6.500" />
            <path d="M16 16l4.500 4.500" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-label={t("Search the menu")}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={visible.length ? `${listId}-${current}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("Type a command")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKeyDown}
            className="ge-no-ring h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted/80"
          />
          <kbd className="ge-kbd inline-flex">Esc</kbd>
        </div>

        {/* Phones: a title and a way out. */}
        <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 md:hidden">
          <h2 className="font-display text-3xl leading-none text-ink">{t("Menu")}</h2>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={t("Close")} className="ge-ctl inline-flex !w-10 !px-0">
            <Glyph>
              <path d="M6 6l12 12M18 6L6 18" />
            </Glyph>
          </button>
        </div>

        <div ref={listRef} className="ge-scroll min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-2">
          {/* Phones have no room for the pickers on the bar: they live here. */}
          <div className="space-y-4 px-1.5 pb-3 md:hidden">
            <div>
              <p className="ge-eyebrow mb-2">{t("Language")}</p>
              <Choices
                label={t("Language")}
                value={lang}
                options={LANGS.map((code) => ({ value: code, label: NAMES[code] }))}
                onChange={setLang}
                columns
              />
            </div>
            {live && (
              <div>
                <p className="ge-eyebrow mb-2">{t("Who is reading")}</p>
                <Choices label={t("Who is reading")} value={audience} options={viewOptions} onChange={setAudience} />
              </div>
            )}
          </div>

          <div id={listId} role="listbox" aria-label={t("Menu")}>
            {GROUPS.map((group) => {
              const items = visible.filter((c) => c.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} role="presentation" className={group === "settings" ? "max-md:hidden" : ""}>
                  <p className="ge-eyebrow px-2.5 pb-1.5 pt-3">{groupNames[group]}</p>
                  {items.map((command) => {
                    const i = visible.indexOf(command);
                    return (
                      <div
                        key={command.id}
                        id={`${listId}-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={i === current}
                        data-active={i === current}
                        onPointerEnter={() => setActive(i)}
                        onClick={() => run(command)}
                        className={`ge-command flex ${command.wide ? "max-md:hidden" : ""}`}
                      >
                        <span className="ge-command-icon" data-on={command.active}>
                          {command.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-ink">{command.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted">{command.hint}</span>
                        </span>
                        {command.badge !== undefined && (
                          <span className="shrink-0 font-mono text-[11px] text-muted">
                            {command.badge}
                          </span>
                        )}
                        {command.active && (
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent" aria-hidden="true">
                            <path d="m5 12.500 4.500 4.500L19 7.500" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted">{t("Nothing matches “{query}”.", { query: query.trim() })}</p>
            )}
          </div>
        </div>

        <p className="hidden border-t border-line px-4 py-2.5 text-[11px] text-muted md:block">
          {t("Use the arrow keys to move, Enter to open, Esc to close.")}
        </p>
      </div>
    </div>
  );
}

/** Opens with the menu button or Ctrl+K (⌘K on a Mac). Renders the window only while it is open. */
export function CommandMenu() {
  const open = useMenuStore((s) => s.open);
  const toggle = useMenuStore((s) => s.toggle);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return open ? <MenuPanel /> : null;
}

/** The button that opens the menu: three lines, and the shortcut on wide screens. */
export function MenuButton({ className = "" }: { className?: string }) {
  const t = useT();
  const open = useMenuStore((s) => s.open);
  const toggle = useMenuStore((s) => s.toggle);

  return (
    <button
      type="button"
      data-menu-button=""
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts="Control+K Meta+K"
      title={t("All options (Ctrl + K)")}
      onClick={toggle}
      className={`ge-ctl pointer-events-auto inline-flex shrink-0 ${className}`}
    >
      <Glyph>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </Glyph>
      <span className="sr-only 2xl:not-sr-only">{t("Menu")}</span>
      <kbd className="ge-kbd hidden 2xl:inline-flex">Ctrl K</kbd>
    </button>
  );
}
