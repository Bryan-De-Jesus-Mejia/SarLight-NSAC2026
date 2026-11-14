"use client";

import { useMemo } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType } from "@/data/types";
import { formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

/** What each kind of search means, in everyday words. */
const PLAIN: Partial<Record<ChangeType, string>> = {
  flood: "Possible flooding",
  wildfire: "Possible fire damage",
  wetland: "Water changing",
  agriculture: "Crops changing",
  earthquake: "Ground shaken",
  deformation: "Ground sinking",
  glacier: "Ice moving",
};

const placeOf = (name: string): string => name.replace(/ (flood|fire)? ?analysis$/i, "");

/**
 * Welcome card of the general view: what this is, in two sentences, and the
 * places where the satellite saw the most land change. Each row opens its story.
 */
export function GeneralIntro() {
  const events = useAppStore((s) => s.events);
  const select = useAppStore((s) => s.select);
  const setStory = useAppStore((s) => s.setStory);

  const ranked = useMemo(() => [...events].sort((a, b) => b.changedAreaKm2 - a.changedAreaKm2).slice(0, 5), [events]);
  if (ranked.length === 0) return null;
  const max = ranked[0].changedAreaKm2 || 1;

  const open = (id: string) => {
    select(id);
    setStory(true);
  };

  return (
    <section
      aria-labelledby="intro-title"
      className="ge-intro glass pointer-events-auto absolute left-5 top-[6.5rem] w-[21.5rem] rounded-2xl p-5 max-md:hidden sm:left-8"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">For everyone</p>
      <h2 id="intro-title" className="mt-2 font-display text-[1.7rem] leading-[1.08] text-ink">
        The ground under us is always changing. A satellite is keeping watch.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink/85">
        It sees through clouds and in the dark. Floods that take homes, fires that take forests, harvests that fail:
        it can pick up the marks they leave. These are the places where it saw the most land change.
      </p>

      <ol className="mt-4 space-y-1">
        {ranked.map((event, i) => {
          const meta = CHANGE_TYPES[event.type];
          return (
            <li key={event.id}>
              <button type="button" onClick={() => open(event.id)} className="ge-case items-start">
                <span className="mt-0.5 w-4 shrink-0 font-mono text-[11px] text-muted">{i + 1}</span>
                <span className="mt-0.5 shrink-0" style={{ color: meta.color }}>
                  <ChangeTypeIcon type={event.type} size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] text-ink">{placeOf(event.name)}</span>
                    <span className="shrink-0 font-mono text-xs text-ink">{formatValue(event.changedAreaKm2)} km²</span>
                  </span>
                  <span className="block text-xs text-muted">{PLAIN[event.type] ?? meta.label}</span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max((event.changedAreaKm2 / max) * 100, 3)}%`, background: meta.color }}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11px] leading-snug text-muted">
        Tap a place to hear its story. These are clues from real radar images, not yet confirmed on the ground.
      </p>
    </section>
  );
}
