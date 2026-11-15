"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChatButton } from "@/components/chat/ChatButton";
import { ClassroomButton } from "@/components/Classroom";
import { GeneralIntro } from "@/components/GeneralIntro";
import { LanguageToggle } from "@/components/LanguageToggle";
import { LayersPanel } from "@/components/LayersPanel";
import { Legend } from "@/components/Legend";
import { SearchBox } from "@/components/SearchBox";
import { Timeline } from "@/components/Timeline";
import { useT } from "@/i18n/core";
import { globeApi } from "@/lib/globeApi";
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
  const startDemo = useAppStore((s) => s.startDemo);
  const audience = useAppStore((s) => s.audience);
  const setAudience = useAppStore((s) => s.setAudience);
  const story = useAppStore((s) => s.story);
  const lens = useAppStore((s) => s.lens);
  const dance = useAppStore((s) => s.dance);
  const setLens = useAppStore((s) => s.setLens);
  const community = useAppStore((s) => s.community);
  const setCommunity = useAppStore((s) => s.setCommunity);
  const setDance = useAppStore((s) => s.setDance);

  const toggleDance = () => {
    if (dance) return setDance(false);
    // Seen from far away, so the whole planet fills in.
    globeApi.current?.flyTo({ lat: 12, lng: -45, altitude: 2.7 });
    setDance(true);
  };
  const [introOpen, setIntroOpen] = useState(false);
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

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 sm:p-8">
      {hasEvents && introOpen && !demoActive && !caseOpen && !lens && !dance && audience === "general" && (
        <GeneralIntro onClose={() => setIntroOpen(false)} />
      )}

      <div className="flex flex-wrap items-start gap-x-4 gap-y-4">
        <h1 className="mr-auto font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
          Dancing with the <em>SARs</em>
        </h1>

        <LanguageToggle />

        {hasEvents && !demoActive && (
          <div className="ge-surface pointer-events-auto flex h-10 shrink-0 overflow-hidden" role="group" aria-label={t("Who is reading")}>
            <button
              type="button"
              aria-pressed={audience === "general"}
              onClick={() => setAudience("general")}
              title={t("Simple view")}
              className={`flex w-10 items-center justify-center transition-colors hover:text-accent ${audience === "general" ? "bg-white/10 text-accent" : "text-muted"}`}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20.300s-7.300-4.400-7.300-10A4.200 4.200 0 0 1 12 7.600a4.200 4.200 0 0 1 7.300 2.700c0 5.600-7.300 10-7.300 10z" />
              </svg>
              <span className="sr-only">{t("Simple view")}</span>
            </button>
            <button
              type="button"
              aria-pressed={audience === "technical"}
              onClick={() => setAudience("technical")}
              title={t("Technical view")}
              className={`flex w-10 items-center justify-center border-l border-line transition-colors hover:text-accent ${audience === "technical" ? "bg-white/10 text-accent" : "text-muted"}`}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.500h16M7 16v-5M12 16V6M17 16v-8" />
              </svg>
              <span className="sr-only">{t("Technical view")}</span>
            </button>
          </div>
        )}

        {hasEvents && !demoActive && audience === "general" && (
          <button
            type="button"
            aria-pressed={introOpen}
            onClick={() => setIntroOpen((open) => !open)}
            title={t("Where the land changed most")}
            className={`ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center transition-colors hover:text-accent ${introOpen ? "text-accent" : "text-ink"}`}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6.5h16M4 12h10.500M4 17.500h6" />
            </svg>
            <span className="sr-only">{t("Where the land changed most")}</span>
          </button>
        )}

        {hasEvents && !demoActive && <SearchBox className="w-full md:order-none md:w-72 max-md:order-last" />}

        {hasEvents && !demoActive && (
          <button
            type="button"
            onClick={startDemo}
            title={t("Guided demo")}
            className="ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center text-sm text-ink transition-colors hover:text-accent"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z" />
            </svg>
            <span className="sr-only">{t("Guided demo")}</span>
          </button>
        )}

        {hasEvents && !demoActive && !story && (
          <button
            type="button"
            aria-pressed={community}
            onClick={() => setCommunity(!community)}
            title={t("Is my community at risk? See what our radar found around a place")}
            className={`ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center text-sm transition-colors hover:text-accent ${community ? "text-accent" : "text-ink"}`}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 11.5 12 4l8.5 7.5M6 10v9.5h12V10M10 19.5v-5h4v5" />
            </svg>
            <span className="sr-only">{t("Is my community at risk?")}</span>
          </button>
        )}

        {hasEvents && !demoActive && (
          <>
            <button
              type="button"
              aria-pressed={lens}
              onClick={() => {
                if (!lens) globeApi.current?.flyTo({ lat: 18.75, lng: -70.3, altitude: 0.6 });
                setLens(!lens);
              }}
              title={t("See through the clouds: the day as a camera saw it, the ground underneath inside a circle")}
              className={`ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center text-sm transition-colors hover:text-accent max-md:hidden ${lens ? "text-accent" : "text-ink"}`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5 20 20M7.5 10.5h6" />
              </svg>
              <span className="sr-only">{t("Radar lens")}</span>
            </button>
            <button
              type="button"
              aria-pressed={dance}
              onClick={toggleDance}
              title={t("Watch one real 12-day cycle of NISAR scenes cover the planet")}
              className={`ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center text-sm transition-colors hover:text-accent max-md:hidden ${dance ? "text-accent" : "text-ink"}`}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M5.5 17.5c3-7 8-10 13-11M12 3.5v2M12 18.5v2" />
              </svg>
              <span className="sr-only">{t("12-day dance of the satellite")}</span>
            </button>
          </>
        )}

{hasEvents && !demoActive && <ClassroomButton />}
{hasEvents && !demoActive && <ChatButton />}

{!story && (
        <Link
            href="/methods"
            title={t("How it works")}
            className="ge-surface pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center text-sm text-ink transition-colors hover:text-accent"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9.5M9 8.5h5" />
            </svg>
            <span className="sr-only">{t("How it works")}</span>
          </Link>
        )}
      </div>

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
