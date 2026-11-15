"use client";

import { useState, type ReactNode } from "react";
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
  // The guided demo and story mode both take over the screen.
  const demoActive = useAppStore((s) => s.demoActive || s.story);
  const audience = useAppStore((s) => s.audience);
  const story = useAppStore((s) => s.story);
  const lens = useAppStore((s) => s.lens);
  const dance = useAppStore((s) => s.dance);
  const community = useAppStore((s) => s.community);
  const setCommunity = useAppStore((s) => s.setCommunity);
  const intro = useAppStore((s) => s.intro);
  const setIntro = useAppStore((s) => s.setIntro);

  const [legendOpen, setLegendOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  // On phones there is room for one panel at a time.
  const narrow = () => window.matchMedia("(max-width: 767px)").matches;
  const closeOthers = (keep: "legend" | "timeline" | "layers") => {
    if (!narrow()) return;
    if (keep !== "legend") setLegendOpen(false);
    if (keep !== "timeline") setTimelineOpen(false);
    if (keep !== "layers") setLayersOpen(false);
  };
  const toggleLegend = () => {
    if (!legendOpen) closeOthers("legend");
    setLegendOpen(!legendOpen);
  };
  const toggleTimeline = () => {
    if (!timelineOpen) closeOthers("timeline");
    setTimelineOpen(!timelineOpen);
  };
  const toggleLayers = () => {
    if (!layersOpen) closeOthers("layers");
    setLayersOpen(!layersOpen);
  };

  const ready = hasEvents && !demoActive;

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] flex flex-col justify-between p-5 sm:p-8">
      {ready && intro && !caseOpen && !lens && !dance && audience !== "technical" && (
        <GeneralIntro onClose={() => setIntro(false)} />
      )}

      <header className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <h1 className="ge-brand mr-auto text-3xl leading-[1.05] text-ink sm:text-4xl">
          Dancing with the <em>SARs</em>
        </h1>

        {/* Phones: the menu holds the pickers, so the bar keeps only search and the community check. */}
        <MenuButton className="md:hidden" />

        <div className={`flex w-full items-center gap-2 md:ml-auto md:w-auto md:flex-wrap md:justify-end ${ready ? "" : "max-md:hidden"}`}>
          <LanguageSelect className="max-md:hidden" />
          {ready && <ViewSelect className="max-md:hidden" />}
          {ready && <SearchBox className="min-w-0 flex-1 md:w-60 md:flex-none xl:w-72" />}
          {ready && !story && (
            <button
              type="button"
              aria-pressed={community}
              onClick={() => setCommunity(!community)}
              title={t("Is my community at risk? See what our radar found around a place")}
              className="ge-ctl ge-ctl--primary pointer-events-auto inline-flex shrink-0"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.500 11.500 12 4l8.500 7.500M6 10v9.500h12V10M10 19.500v-5h4v5" />
              </svg>
              <span className="sr-only lg:not-sr-only">{t("Is my community at risk?")}</span>
            </button>
          )}
          <MenuButton className="max-md:hidden" />
        </div>
      </header>

      {hasEvents && !demoActive && (
        // With the case panel open, keep the dock clear of it.
        <div className={`ge-dock ${caseOpen || chatOpen ? "max-md:hidden md:pr-[28rem]" : ""}`}>
          <div className="ge-dock-panels">
            <div className="ge-slot ge-slot--legend" data-open={legendOpen} inert={!legendOpen}>
              <Legend />
            </div>
            <div className="ge-slot ge-slot--layers" data-open={layersOpen} inert={!layersOpen}>
              <LayersPanel />
            </div>
            <div className="ge-slot ge-slot--timeline" data-open={timelineOpen} inert={!timelineOpen}>
              <Timeline />
            </div>
          </div>

          <div className="pointer-events-auto mt-3 flex gap-2">
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
