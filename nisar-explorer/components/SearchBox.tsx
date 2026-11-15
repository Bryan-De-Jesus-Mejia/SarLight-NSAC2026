"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES } from "@/data/changeTypes";
import { useT } from "@/i18n/core";
import { matchesQuery, queryTokens } from "@/lib/search";
import { useAppStore } from "@/store/useAppStore";

interface SearchBoxProps {
  className?: string;
}

const MAX_RESULTS = 7;

/**
 * Search by name, region, country or change type. Typing narrows the globe
 * live; picking a result opens that case and clears the search.
 */
export function SearchBox({ className = "" }: SearchBoxProps) {
  const t = useT();
  const events = useAppStore((s) => s.events);
  const query = useAppStore((s) => s.query);
  const setQuery = useAppStore((s) => s.setQuery);
  const select = useAppStore((s) => s.select);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const { results, matchCount } = useMemo(() => {
    const tokens = queryTokens(query);
    if (tokens.length === 0) return { results: [], matchCount: 0 };
    const matches = events.filter((e) => matchesQuery(e, tokens));
    // Largest change first.
    const ranked = [...matches].sort((a, b) => b.changedAreaKm2 - a.changedAreaKm2);
    return { results: ranked.slice(0, MAX_RESULTS), matchCount: matches.length };
  }, [events, query]);

  const searching = query.trim().length > 0;
  const showList = open && searching;

  // Close when the pointer goes elsewhere.
  useEffect(() => {
    if (!showList) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [showList]);

  const pick = (id: string) => {
    select(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (searching || open) {
        // Keep Escape from also closing the case panel.
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        setQuery("");
        setOpen(false);
      }
      return;
    }
    if (!showList || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[Math.min(activeIndex, results.length - 1)];
      if (target) pick(target.id);
    }
  };

  const active = Math.min(activeIndex, Math.max(results.length - 1, 0));

  return (
    <div ref={rootRef} className={`pointer-events-auto relative ${className}`}>
      <div className="ge-search ge-ctl flex w-full !justify-start !gap-2 !px-3 focus-within:!border-accent/70">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={t("Search signals by name, place or type")}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results.length > 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={t("Search a place or signal")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/80"
        />
        {searching && (
          <button
            type="button"
            onClick={clear}
            aria-label={t("Clear search")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {showList && (
        <div className="ge-pop ge-menu-surface ge-search-list absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 origin-top overflow-hidden p-1.5">
          {results.length > 0 ? (
            <>
              <ul id={listId} role="listbox" aria-label={t("Matching signals")}>
                {results.map((event, i) => {
                  const info = CHANGE_TYPES[event.type];
                  return (
                    <li
                      key={event.id}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onPointerEnter={() => setActiveIndex(i)}
                      // pointerdown, not click: act before the input loses focus.
                      onPointerDown={(e) => {
                        e.preventDefault();
                        pick(event.id);
                      }}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 ${
                        i === active ? "bg-white/10" : ""
                      }`}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                        style={{
                          color: info.color,
                          borderColor: `rgb(${info.rgb.join(" ")} / 0.45)`,
                          backgroundColor: `rgb(${info.rgb.join(" ")} / 0.12)`,
                        }}
                      >
                        <ChangeTypeIcon type={event.type} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{t(event.name)}</span>
                        <span className="block truncate text-xs text-muted">
                          {t(event.region)} · {t(event.country)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                        {event.sensors.map((s) => (s === "nisar" ? "NISAR" : "S-1")).join(" + ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {matchCount > results.length
                  ? t("Top {shown} of {total} matches · all shown on the globe", { shown: results.length, total: matchCount })
                  : t("{n, plural, one {# match} other {# matches}} · shown on the globe", { n: matchCount })}
              </p>
            </>
          ) : (
            <p id={listId} className="px-3 py-3 text-sm text-muted">
              {t("No signal matches “{query}”. Try a country, a region or a type such as “glacier”.", { query: query.trim() })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
