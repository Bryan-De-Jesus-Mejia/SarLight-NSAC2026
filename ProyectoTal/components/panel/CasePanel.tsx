"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { BeforeAfter } from "@/components/panel/BeforeAfter";
import { MetricChart } from "@/components/panel/MetricChart";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { EventDetail, SarTechnique, SignificanceLevel } from "@/data/types";
import { formatDate, formatPValue, formatSigned, formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const TECHNIQUE_LABELS: Record<SarTechnique, string> = {
  backscatter: "Backscatter intensity",
  insar: "Interferometry (InSAR)",
  coherence: "Coherence change",
  polarimetry: "Polarimetry",
};

const SIGNIFICANCE: Record<SignificanceLevel, { label: string; note: string; bars: number }> = {
  high: { label: "High", note: "Well outside normal variation", bars: 3 },
  medium: { label: "Medium", note: "Likely a real change", bars: 2 },
  low: { label: "Low", note: "Within normal variation", bars: 1 },
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</h3>
  );
}

function Stat({ label, children, note }: { label: string; children: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.03] px-3 py-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-medium leading-tight text-ink">{children}</dd>
      {note && <p className="mt-0.5 text-[11px] leading-snug text-muted">{note}</p>}
    </div>
  );
}

/** Three-step meter: the level is carried by the bar count and the label, not by colour. */
function SignificanceMeter({ level }: { level: SignificanceLevel }) {
  return (
    <span className="mr-1.5 inline-flex items-end gap-[3px] align-baseline" aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={`w-[4px] rounded-[1px] ${step <= SIGNIFICANCE[level].bars ? "bg-ink" : "bg-white/20"}`}
          style={{ height: 5 + step * 3 }}
        />
      ))}
    </span>
  );
}

function PanelBody({ detail }: { detail: EventDetail }) {
  const meta = CHANGE_TYPES[detail.type];
  const sig = detail.significanceDetail;
  const signedChange = detail.change.direction === "increase" ? detail.change.value : -detail.change.value;

  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-ink/90">{detail.summary}</p>

      <section aria-labelledby="case-imagery">
        <SectionTitle>
          <span id="case-imagery">Before and after</span>
        </SectionTitle>
        <div className="mt-2.5">
          <BeforeAfter detail={detail} />
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Change" note={`${detail.metric.label}, vs baseline`}>
          {formatSigned(signedChange)} <span className="text-sm font-normal text-muted">{detail.change.unit}</span>
        </Stat>
        <Stat label="Significance" note={SIGNIFICANCE[sig.level].note}>
          <SignificanceMeter level={sig.level} />
          {SIGNIFICANCE[sig.level].label}
        </Stat>
        <Stat label="Area affected">
          {formatValue(detail.areaKm2)} <span className="text-sm font-normal text-muted">km²</span>
        </Stat>
        <Stat label="Observed">
          <span className="text-sm">
            {formatDate(detail.startDate)} – {formatDate(detail.endDate)}
          </span>
        </Stat>
      </dl>

      <section aria-labelledby="case-metric">
        <SectionTitle>
          <span id="case-metric">
            {detail.metric.label} · {detail.metric.unit}
          </span>
        </SectionTitle>
        <div className="mt-2.5">
          <MetricChart detail={detail} color={meta.color} />
        </div>
        <p className="mt-3 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-muted">
          <span className="font-mono text-ink">
            z = {formatSigned(sig.zScore)} · {formatPValue(sig.pValue)}
          </span>
          <br />
          {sig.method}
        </p>
      </section>

      <section aria-labelledby="case-sar">
        <SectionTitle>
          <span id="case-sar">How radar saw this</span>
        </SectionTitle>
        <ul className="mt-2.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink">
          <li className="rounded-full border border-line px-2.5 py-1">{TECHNIQUE_LABELS[detail.sar.technique]}</li>
          <li className="rounded-full border border-line px-2.5 py-1">{detail.sar.band}-band</li>
          <li className="rounded-full border border-line px-2.5 py-1">
            {detail.sar.polarizations.join(" + ")}
          </li>
        </ul>
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">{detail.sar.explanation}</p>
      </section>

      <section aria-labelledby="case-drivers">
        <SectionTitle>
          <span id="case-drivers">Possible drivers</span>
        </SectionTitle>
        <p className="mt-1.5 text-xs text-muted">Hypotheses to investigate — radar shows what changed, not why.</p>
        <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-ink/85">
          {detail.drivers.map((driver) => (
            <li key={driver} className="flex gap-2.5">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
              {driver}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="case-impact">
        <SectionTitle>
          <span id="case-impact">Why it matters</span>
        </SectionTitle>
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">{detail.impact}</p>
      </section>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading case">
      {[16, 12, 150, 64, 180].map((height, i) => (
        <div key={i} className="ge-skeleton rounded-lg" style={{ height }} />
      ))}
    </div>
  );
}

/** Case panel: opens when a signal is selected and explains what changed. */
export function CasePanel() {
  const selectedId = useAppStore((s) => s.selectedId);
  const summary = useAppStore((s) => s.events.find((e) => e.id === s.selectedId) ?? null);
  const detail = useAppStore((s) => s.detail);
  const detailStatus = useAppStore((s) => s.detailStatus);
  const detailError = useAppStore((s) => s.detailError);
  const select = useAppStore((s) => s.select);
  const retryDetail = useAppStore((s) => s.retryDetail);

  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // A new case starts at the top, with focus on its title.
  useEffect(() => {
    if (selectedId === null) return;
    scrollRef.current?.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [selectedId]);

  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  if (selectedId === null || summary === null) return null;

  const meta = CHANGE_TYPES[summary.type];

  return (
    <aside
      key={selectedId}
      aria-labelledby="case-title"
      className="ge-panel glass pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex max-h-[72dvh] flex-col rounded-t-2xl md:inset-x-auto md:bottom-5 md:right-5 md:top-[4.75rem] md:max-h-none md:w-[27rem] md:rounded-2xl"
    >
      <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
          style={{
            color: meta.color,
            borderColor: `rgb(${meta.rgb.join(" ")} / 0.5)`,
            backgroundColor: `rgb(${meta.rgb.join(" ")} / 0.12)`,
          }}
        >
          <ChangeTypeIcon type={summary.type} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: meta.color }}>
            {meta.label}
            {summary.featured && <span className="text-muted"> · Featured case</span>}
          </p>
          <h2
            id="case-title"
            ref={titleRef}
            tabIndex={-1}
            className="mt-1 font-display text-[1.7rem] leading-[1.1] text-ink outline-none"
          >
            {summary.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {summary.region} · {summary.country}
          </p>
          {summary.source === "mock" && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              Simulated data — not a measurement
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close case panel"
          className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div ref={scrollRef} className="ge-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
        {detailStatus === "error" ? (
          <div role="alert">
            <p className="font-display text-xl text-ink">This case did not load</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{detailError}</p>
            <button
              type="button"
              onClick={retryDetail}
              className="mt-4 rounded-full border border-accent/70 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Try again
            </button>
          </div>
        ) : detail && detail.id === selectedId ? (
          <PanelBody detail={detail} />
        ) : (
          <PanelSkeleton />
        )}
      </div>
    </aside>
  );
}
