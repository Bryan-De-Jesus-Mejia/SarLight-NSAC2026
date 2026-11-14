"use client";

import { Legend } from "@/components/Legend";
import { Timeline } from "@/components/Timeline";
import { useAppStore } from "@/store/useAppStore";

/** Heads-up display layered over the globe. Only its interactive children take pointer events. */
export function Hud() {
  const hasEvents = useAppStore((s) => s.events.length > 0);
  const meta = useAppStore((s) => s.meta);
  const caseOpen = useAppStore((s) => s.selectedId !== null);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 sm:p-8">
      <div className="flex items-start justify-between gap-6">
        <header className="max-w-xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            NISAR · NASA–ISRO Synthetic Aperture Radar
          </p>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">
            Dancing with the <em>SARs</em>
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted sm:text-[15px]">
            Earth&rsquo;s surface never holds still. Follow where radar sees it move.
          </p>
        </header>

        {meta?.source === "mock" && (
          <p
            className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-accent backdrop-blur-md"
            title="Every value shown is synthetic, generated for this prototype. It is not a NISAR measurement."
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Simulated data
          </p>
        )}
      </div>

      {hasEvents && (
        // With the case panel open, keep the bottom row clear of it.
        <div
          className={`flex flex-col gap-3 md:flex-row md:items-end md:gap-5 ${caseOpen ? "md:pr-[27.5rem]" : ""}`}
        >
          <Legend className={caseOpen ? "max-md:hidden" : ""} />
          <Timeline
            className={`md:max-w-2xl md:flex-1 ${caseOpen ? "max-lg:hidden" : ""}`}
          />
          {!caseOpen && (
            <p className="ml-auto hidden pb-1 text-right font-mono text-[11px] uppercase leading-relaxed tracking-[0.16em] text-muted 2xl:block">
              Drag to rotate · Scroll to zoom
              <br />
              Click a signal
            </p>
          )}
        </div>
      )}
    </div>
  );
}
