"use client";

import { useMemo } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import type { ChangeType } from "@/data/types";
import { useAppStore } from "@/store/useAppStore";

/** Heads-up display layered over the globe. Only its interactive children take pointer events. */
export function Hud() {
  const events = useAppStore((s) => s.events);
  const meta = useAppStore((s) => s.meta);

  const { counts, featuredCount } = useMemo(() => {
    const byType: Record<ChangeType, number> = {
      wetland: 0,
      glacier: 0,
      wildfire: 0,
      earthquake: 0,
      agriculture: 0,
      deformation: 0,
    };
    let featured = 0;
    for (const event of events) {
      byType[event.type] += 1;
      if (event.featured) featured += 1;
    }
    return { counts: byType, featuredCount: featured };
  }, [events]);

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

      <div className="flex items-end justify-between gap-6">
        {events.length > 0 && (
          <section
            className="glass pointer-events-auto w-64 rounded-2xl p-4"
            aria-labelledby="legend-title"
          >
            <h2
              id="legend-title"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
            >
              Surface change signals
            </h2>
            <ul className="mt-3 space-y-2">
              {CHANGE_TYPE_ORDER.map((type) => {
                const info = CHANGE_TYPES[type];
                return (
                  <li key={type} className="flex items-center gap-3 text-sm text-ink">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        color: info.color,
                        borderColor: `rgb(${info.rgb.join(" ")} / 0.45)`,
                        backgroundColor: `rgb(${info.rgb.join(" ")} / 0.12)`,
                      }}
                    >
                      <ChangeTypeIcon type={type} size={15} />
                    </span>
                    <span className="flex-1">{info.label}</span>
                    <span className="font-mono text-xs tabular-nums text-muted">{counts[type]}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3.5 border-t border-line pt-3 text-xs leading-relaxed text-muted">
              {events.length} signals · {featuredCount} featured cases with pulsing rings
            </p>
          </section>
        )}

        <p className="ml-auto hidden font-mono text-[11px] uppercase tracking-[0.16em] text-muted md:block">
          Drag to rotate · Scroll to zoom · Click a signal
        </p>
      </div>
    </div>
  );
}
