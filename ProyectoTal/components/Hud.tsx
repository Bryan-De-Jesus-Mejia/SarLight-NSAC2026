"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Legend } from "@/components/Legend";
import { SearchBox } from "@/components/SearchBox";
import { Timeline } from "@/components/Timeline";
import { useAppStore } from "@/store/useAppStore";

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
  const hasEvents = useAppStore((s) => s.events.length > 0);
  const caseOpen = useAppStore((s) => s.selectedId !== null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  // On phones there is room for one panel at a time.
  const narrow = () => window.matchMedia("(max-width: 767px)").matches;
  const toggleLegend = () => {
    if (!legendOpen && narrow()) setTimelineOpen(false);
    setLegendOpen(!legendOpen);
  };
  const toggleTimeline = () => {
    if (!timelineOpen && narrow()) setLegendOpen(false);
    setTimelineOpen(!timelineOpen);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 sm:p-8">
      <Breadcrumb className="pointer-events-auto absolute left-1/2 top-5 z-10 -translate-x-1/2 max-2xl:top-[5.5rem]" />

      <div className="flex flex-wrap items-start gap-x-4 gap-y-4">
        <h1 className="mr-auto font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
          Dancing with the <em>SARs</em>
        </h1>

        {hasEvents && <SearchBox className="w-full md:order-none md:w-72 max-md:order-last" />}

        <Link
          href="/methods"
          className="ge-surface pointer-events-auto flex h-10 shrink-0 items-center gap-2 px-3.5 text-sm text-ink transition-colors hover:text-accent"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9.5M9 8.5h5" />
          </svg>
          Methods
        </Link>
      </div>

      {hasEvents && (
        // With the case panel open, keep the dock clear of it.
        <div className={`ge-dock ${caseOpen ? "max-md:hidden md:pr-[28rem]" : ""}`}>
          <div className="ge-dock-panels">
            <div className="ge-slot ge-slot--legend" data-open={legendOpen} inert={!legendOpen}>
              <Legend />
            </div>
            <div className="ge-slot ge-slot--timeline" data-open={timelineOpen} inert={!timelineOpen}>
              <Timeline />
            </div>
          </div>

          <div className="pointer-events-auto mt-3 flex gap-2">
            <DockButton label="Surface change signals" open={legendOpen} onClick={toggleLegend}>
              <path d="M12 3.5 3.5 8 12 12.5 20.5 8zM3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16" />
            </DockButton>
            <DockButton label="Timeline" open={timelineOpen} onClick={toggleTimeline}>
              <path d="M3.5 17.5h17M6 17.5v-4M10 17.5V8M14 17.5v-6.5M18 17.5V5.5" />
            </DockButton>
          </div>
        </div>
      )}
    </div>
  );
}
