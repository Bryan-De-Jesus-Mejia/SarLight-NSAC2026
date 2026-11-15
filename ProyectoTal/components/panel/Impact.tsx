"use client";

import type { EventDetail } from "@/data/types";
import { ACTIONS, fieldWatchOf, peopleLine, type Level } from "@/lib/impact";

/**
 * "For people": who lives there, what it means for those who farm, and what
 * to do. People come from the GHSL population grid crossed with our own change
 * masks; the field watch reads the radar series; the advice is general safety
 * guidance for each kind of event. Nothing here replaces official alerts.
 */

const LEVEL_STYLE: Record<Level, { label: string; color: string }> = {
  alert: { label: "Alert", color: "#f87171" },
  watch: { label: "Watch", color: "#fbbf24" },
  normal: { label: "Seasonal", color: "#4ade80" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{title}</p>
      <div className="mt-1.5 text-[13px] leading-relaxed text-ink/90">{children}</div>
    </div>
  );
}

export function Impact({ detail, compact = false }: { detail: EventDetail; compact?: boolean }) {
  const people = peopleLine(detail);
  const field = fieldWatchOf(detail);
  const actions = ACTIONS[detail.type];
  const home = detail.country === "Dominican Republic";
  if (!people && !field && !actions) return null;

  const body = (
    <div className="space-y-3">
      {people && (
        <Section title="Who lives there">
          <p>{people}</p>
          <p className="mt-1 text-[11px] text-muted">Estimate from the GHSL population grid (1 km squares, 2025), not a census.</p>
        </Section>
      )}
      {field && (
        <Section title="For those who farm">
          <p className="flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#05070d]" style={{ background: LEVEL_STYLE[field.level].color }}>
              {LEVEL_STYLE[field.level].label}
            </span>
            <span className="font-medium text-ink">{field.title}</span>
          </p>
          <p className="mt-1">{field.body}</p>
        </Section>
      )}
      {actions && (
        <Section title="What you can do">
          <ul className="list-disc space-y-1 pl-4 marker:text-muted">
            {actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-ink">
            {home ? (
              <>
                Emergency: <b>9-1-1</b>. Follow the alerts of the <b>COE</b> and <b>Defensa Civil</b>.
              </>
            ) : (
              "In an emergency, call your local emergency number and follow your civil protection's alerts."
            )}
          </p>
        </Section>
      )}
    </div>
  );

  if (compact) return body;
  return (
    <section aria-label="For people" className="rounded-xl border border-line p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">For people</p>
      <div className="mt-3">{body}</div>
    </section>
  );
}
