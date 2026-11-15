"use client";

import { useCallback, useEffect, useState } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { EventDetail, EventSummary } from "@/data/types";
import { usePopover } from "@/hooks/usePopover";
import { useLang, useT } from "@/i18n/core";
import { formatClock, formatDayMonth } from "@/lib/format";
import { buildStudyPrompt } from "@/lib/lesson";
import { useAppStore } from "@/store/useAppStore";
import { MAX_SAVED, useClassroomStore, type SavedCase } from "@/store/useClassroomStore";

const placeOf = (name: string): string => name.replace(/ analysis$/i, "");

/** Bookmark that keeps the open case in the classroom (or takes it out again). */
export function SaveToClassroom({ className = "" }: { className?: string }) {
  const t = useT();
  const selectedId = useAppStore((s) => s.selectedId);
  const student = useAppStore((s) => s.audience === "student");
  const items = useClassroomStore((s) => s.items);
  const save = useClassroomStore((s) => s.save);
  const remove = useClassroomStore((s) => s.remove);
  // The classroom belongs to the student view.
  if (!selectedId || !student) return null;
  const saved = items.some((item) => item.id === selectedId);

  const toggle = () => {
    if (saved) return remove(selectedId);
    const { audience, story } = useAppStore.getState();
    save(selectedId, { audience, story });
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={toggle}
      title={saved ? t("Saved in the classroom. Tap to remove it.") : t("Save this case in the classroom")}
      aria-label={saved ? t("Remove from the classroom") : t("Save to the classroom")}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 ${saved ? "text-accent" : "text-muted hover:text-ink"} ${className}`}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6.500 4h11a1 1 0 0 1 1 1v15l-6.500-4-6.500 4V5a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}

function when(at: number, t: ReturnType<typeof useT>): string {
  return new Date(at).toDateString() === new Date().toDateString()
    ? t("Today, {time}", { time: formatClock(at) })
    : t("{date}, {time}", { date: formatDayMonth(at), time: formatClock(at) });
}

async function loadDetail(id: string): Promise<EventDetail | null> {
  try {
    const response = await fetch(`/api/events/${encodeURIComponent(id)}`);
    return response.ok ? ((await response.json()) as EventDetail) : null;
  } catch {
    return null;
  }
}

function Row({ item, event, onDone }: { item: SavedCase; event: EventSummary | undefined; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const remove = useClassroomStore((s) => s.remove);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  if (!event) return null;
  const meta = CHANGE_TYPES[event.type];

  const open = () => {
    const app = useAppStore.getState();
    app.setAudience(item.audience);
    app.select(item.id);
    if (item.story) app.setStory(true);
    onDone();
  };

  const copyPrompt = async () => {
    const detail = await loadDetail(item.id);
    try {
      if (!detail) throw new Error("no detail");
      await navigator.clipboard.writeText(buildStudyPrompt({ ...detail, figures: [] }));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied("idle"), 2200);
  };

  return (
    <li className="rounded-lg border border-line p-2.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0" style={{ color: meta.color }}>
          <ChangeTypeIcon type={event.type} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{t(placeOf(event.name))}</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {t(event.region)} · {when(item.savedAt, t)}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={open} className="ge-pill">
          {t("Open")}
        </button>
        <a href={`/aula/${lang}/${item.id}`} target="_blank" rel="noopener" className="ge-pill">
          {t("Study guide (PDF)")}
        </a>
        <button type="button" onClick={() => void copyPrompt()} className="ge-pill">
          {copied === "ok" ? t("Prompt copied") : copied === "fail" ? t("Could not copy") : t("Copy AI study prompt")}
        </button>
        <button type="button" onClick={() => remove(item.id)} className="ge-link text-xs">
          {t("Remove")}
        </button>
      </div>
    </li>
  );
}

/** The list of saved cases. It opens from the menu and only exists in the student view. */
export function ClassroomPanel() {
  const t = useT();
  const events = useAppStore((s) => s.events);
  const student = useAppStore((s) => s.audience === "student");
  const items = useClassroomStore((s) => s.items);
  const open = useClassroomStore((s) => s.open);
  const pending = useClassroomStore((s) => s.pending);
  const setOpen = useClassroomStore((s) => s.setOpen);
  const replace = useClassroomStore((s) => s.replace);

  const close = useCallback(() => setOpen(false), [setOpen]);
  const shown = open && student;
  const ref = usePopover(close, shown);
  const eventOf = (id: string) => events.find((e) => e.id === id);
  const pendingEvent = pending ? eventOf(pending.id) : undefined;

  // Leaving the student view puts the list away, so it does not pop back open later.
  useEffect(() => {
    if (open && !student) setOpen(false);
  }, [open, student, setOpen]);

  return (
    <div ref={ref} className="pointer-events-none fixed right-5 top-[7.25rem] z-40 sm:right-8 xl:top-[4.75rem]">
      {shown && (
        <section
          role="dialog"
          aria-label={t("Classroom")}
          className="ge-pop ge-menu-surface pointer-events-auto w-[min(22rem,calc(100vw-2.5rem))] origin-top-right p-3"
        >
          <h2 className="font-display text-xl text-ink">{t("Classroom")}</h2>
          <p className="mt-1 text-xs leading-snug text-muted">
            {t("Keep up to {max} cases to come back to, and get a study guide for each one.", { max: MAX_SAVED })}
          </p>

          {pending ? (
            <div className="mt-3" role="alert">
              <p className="text-sm leading-snug text-ink">
                {t("The classroom is full. Which case do you want to replace with “{name}”?", {
                  name: pendingEvent ? t(placeOf(pendingEvent.name)) : pending.id,
                })}
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => replace(item.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-white/[0.07]"
                    >
                      <span className="truncate">{t(placeOf(eventOf(item.id)?.name ?? item.id))}</span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">{t("Replace")}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setOpen(false)} className="ge-link mt-2 text-xs">
                {t("Cancel")}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm leading-relaxed text-muted">
              {t("Nothing saved yet. Open a case and tap the bookmark to keep it here.")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <Row key={item.id} item={item} event={eventOf(item.id)} onDone={close} />
              ))}
            </ul>
          )}

          <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-muted">
            {t("Saved only in this browser: they are not shared between devices.")}
          </p>
        </section>
      )}
    </div>
  );
}
