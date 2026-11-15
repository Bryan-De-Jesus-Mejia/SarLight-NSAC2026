"use client";

import { useMemo } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType, EventSummary } from "@/data/types";
import { msg, useT, type TFunction } from "@/i18n/core";
import { useAppStore } from "@/store/useAppStore";

/** What each kind of case means for people, in everyday words. */
const PLAIN: Record<ChangeType, string> = {
  flood: msg("Water where people live"),
  storm: msg("Wind that flattened crops"),
  drought: msg("Land drying in the heat"),
  landslide: msg("Slopes on the move"),
  wildfire: msg("Forest lost"),
  agriculture: msg("Fields changing"),
  earthquake: msg("Ground shaken"),
  glacier: msg("Ice sliding to the sea"),
  wetland: msg("Water changing"),
  deformation: msg("Ground sinking"),
};

/** Closest to daily life first. */
const PRIORITY: ChangeType[] = ["flood", "storm", "drought", "landslide", "wildfire", "agriculture", "earthquake", "glacier", "wetland", "deformation"];
const placeOf = (name: string): string => name.replace(/ (flood|fire)? ?analysis$/i, "");

function Row({ event, onOpen, t }: { event: EventSummary; onOpen: (id: string) => void; t: TFunction }) {
  const meta = CHANGE_TYPES[event.type];
  return (
    <li>
      <button type="button" onClick={() => onOpen(event.id)} className="ge-case">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.thumb} alt="" loading="lazy" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-tight text-ink">{t(placeOf(event.name))}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span style={{ color: meta.color }}>
              <ChangeTypeIcon type={event.type} size={13} />
            </span>
            {t(PLAIN[event.type])}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Welcome card of the simple view: what this is in two sentences, the places
 * at home first, then the world. Every row opens that place's story.
 */
export function GeneralIntro({ onClose }: { onClose: () => void }) {
  const t = useT();
  const events = useAppStore((s) => s.events);
  const select = useAppStore((s) => s.select);
  const setStory = useAppStore((s) => s.setStory);

  const { home, world } = useMemo(() => {
    const rank = (e: EventSummary) => PRIORITY.indexOf(e.type);
    const sorted = [...events].sort((a, b) => rank(a) - rank(b) || b.changedAreaKm2 - a.changedAreaKm2);
    return {
      home: sorted.filter((e) => e.country === "Dominican Republic"),
      world: sorted.filter((e) => e.country !== "Dominican Republic"),
    };
  }, [events]);
  if (events.length === 0) return null;

  const open = (id: string) => {
    onClose();
    select(id);
    setStory(true);
  };

  return (
    <section
      aria-labelledby="intro-title"
      className="ge-intro glass pointer-events-auto absolute left-5 top-[6.5rem] flex max-h-[calc(100dvh-9rem)] w-[22rem] flex-col rounded-2xl max-md:hidden sm:left-8"
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{t("Stories from space")}</p>
          <h2 id="intro-title" className="mt-2 font-display text-[1.6rem] leading-[1.08] text-ink">
            {t("The ground under us is always changing. A satellite is keeping watch.")}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t("Close")} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <p className="mt-3 px-5 text-sm leading-relaxed text-ink/85">
        {t(
          "It sees through clouds and in the dark. Floods that take homes, wind that flattens a harvest, heat that dries the land: it picks up the marks they leave. Tap a place to hear its story.",
        )}
      </p>

      <div className="ge-scroll mt-4 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{t("Close to home · Dominican Republic")}</p>
        <ul className="mt-1.5 space-y-0.5">
          {home.map((e) => (
            <Row key={e.id} event={e} onOpen={open} t={t} />
          ))}
        </ul>
        <p className="mt-4 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{t("Around the world")}</p>
        <ul className="mt-1.5 space-y-0.5">
          {world.map((e) => (
            <Row key={e.id} event={e} onOpen={open} t={t} />
          ))}
        </ul>
      </div>
      <p className="border-t border-line px-5 py-3 text-[11px] leading-snug text-muted">
        {t("Clues from real NISAR radar images, read by our team. Not yet confirmed on the ground.")}
      </p>
    </section>
  );
}
