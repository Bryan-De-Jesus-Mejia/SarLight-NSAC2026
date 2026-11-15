"use client";

import type { ReactNode } from "react";
import { MenuButton } from "@/components/CommandMenu";
import { GeneralIntro } from "@/components/GeneralIntro";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LayersPanel } from "@/components/LayersPanel";
import { Legend } from "@/components/Legend";
import { SearchBox } from "@/components/SearchBox";
import { Timeline } from "@/components/Timeline";
import { ViewSelect } from "@/components/ViewSelect";
import { useT } from "@/i18n/core";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";

function DockButton({
  label,
  open,
  onClick,
  children,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={open}
      onClick={onClick}
      className="ge-dock-button"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/** Heads-up display layered over the globe. Only its interactive children take pointer events. */
export function Hud() {
  const t = useT();
  const hasEvents = useAppStore((s) => s.events.length > 0);
  const caseOpen = useAppStore((s) => s.selectedId !== null);
  const chatOpen = useChatStore((s) => s.open);
  // Story mode takes over the screen; the tutorial keeps every control visible, since it points at them.
  const demoActive = useAppStore((s) => s.story);
  const audience = useAppStore((s) => s.audience);
  const story = useAppStore((s) => s.story);
  const lens = useAppStore((s) => s.lens);
  const dance = useAppStore((s) => s.dance);
  const community = useAppStore((s) => s.community);
  const setCommunity = useAppStore((s) => s.setCommunity);
  const intro = useAppStore((s) => s.intro);
  const setIntro = useAppStore((s) => s.setIntro);

  // The dock lives in the store: opening a panel there closes the cards on the same side of the screen.
  const dock = useAppStore((s) => s.dock);
  const setDock = useAppStore((s) => s.setDock);
  const legendOpen = dock.legend;
  const timelineOpen = dock.timeline;
  const layersOpen = dock.layers;

  // On phones there is room for one panel at a time.
  const toggle = (panel: "legend" | "timeline" | "layers") => {
    const open = !dock[panel];
    if (open && window.matchMedia("(max-width: 767px)").matches) {
      for (const other of ["legend", "timeline", "layers"] as const) if (other !== panel) setDock(other, false);
    }
    setDock(panel, open);
  };
  const toggleLegend = () => toggle("legend");
  const toggleTimeline = () => toggle("timeline");
  const toggleLayers = () => toggle("layers");

  const ready = hasEvents && !demoActive;

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] flex flex-col justify-between p-5 sm:p-8">
      {ready && intro && !caseOpen && !lens && !dance && audience !== "technical" && (
        <GeneralIntro onClose={() => setIntro(false)} />
      )}

      <header className={`flex items-start gap-x-6 gap-y-3 md:flex-wrap ${caseOpen ? "max-md:hidden" : ""}`}>
        <h1 className="ge-brand mr-auto text-4xl leading-[1.05] text-ink sm:text-5xl">
          Sar<em>Light</em>
        </h1>

        {/* Phones: the menu holds the pickers, so the bar keeps three buttons together: search, community and menu. */}
        <div className="flex items-center gap-2 md:ml-auto md:flex-wrap md:justify-end">
          <LanguageSelect className="max-md:hidden" />
          {ready && (
            <div data-tour="view" className="contents">
              <ViewSelect className="max-md:hidden" />
            </div>
          )}
          {ready && (
            <div data-tour="search" className="contents">
              <SearchBox className="md:w-60 xl:w-72" />
            </div>
          )}
          {ready && !story && (
            <button
              type="button"
              aria-pressed={community}
              onClick={() => setCommunity(!community)}
              data-tour="community"
              title={t("Is my community at risk? See what our radar found around a place")}
              className="ge-ctl ge-ctl--primary pointer-events-auto inline-flex shrink-0"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.500 11.500 12 4l8.500 7.500M6 10v9.500h12V10M10 19.500v-5h4v5" />
              </svg>
              <span className="sr-only lg:not-sr-only">{t("Is my community at risk?")}</span>
            </button>
          )}
          <div data-tour="menu" className="contents">
            <MenuButton />
          </div>
        </div>
      </header>

      {hasEvents && !demoActive && (
        // With the case panel open, keep the dock clear of it.
        <div className={`ge-dock ${caseOpen || chatOpen ? "max-md:hidden md:pr-[28rem]" : ""}`}>
          <div className="ge-dock-panels">
            <div className="ge-slot ge-slot--legend" data-tour="legend" data-open={legendOpen} inert={!legendOpen}>
              <Legend />
            </div>
            <div className="ge-slot ge-slot--layers" data-tour="layers" data-open={layersOpen} inert={!layersOpen}>
              <LayersPanel />
            </div>
            <div className="ge-slot ge-slot--timeline" data-tour="timeline" data-open={timelineOpen} inert={!timelineOpen}>
              <Timeline />
            </div>
          </div>

          <div className="pointer-events-auto mt-3 flex gap-2" data-tour="dock">
            <DockButton label={t("Surface change signals")} open={legendOpen} onClick={toggleLegend}>
              <path d="M12 3.5 3.5 8 12 12.5 20.5 8zM3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16" />
            </DockButton>
            <DockButton label={t("Real data layers")} open={layersOpen} onClick={toggleLayers}>
              <path d="M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6zM3.4 12h17.2M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2z" />
            </DockButton>
            <DockButton label={t("Timeline")} open={timelineOpen} onClick={toggleTimeline}>
              <path d="M3.5 17.5h17M6 17.5v-4M10 17.5V8M14 17.5v-6.5M18 17.5V5.5" />
            </DockButton>
          </div>
        </div>
      )}
    </div>
  );
}
