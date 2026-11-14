"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { BackscatterChart } from "@/components/panel/BackscatterChart";
import { Baseline, Channels, GroundCover, Hypotheses, LocalChange, ShareBar } from "@/components/panel/Evidence";
import { SarViewer } from "@/components/panel/SarViewer";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType, EventDetail, SensorAnalysis } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const DAY_MS = 86_400_000;
/** First acquisition day of the validated NISAR L2 release at ASF (earlier ones are provisional). */
const NISAR_VALIDATED_FROM = "2026-10-21";
const day = (iso: string): string => iso.slice(0, 10);
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${day(b)}T00:00:00Z`) - Date.parse(`${day(a)}T00:00:00Z`)) / DAY_MS);

/** What a change in the echo can mean for each kind of analysis. Context, not a finding. */
const READING: Record<ChangeType, string> = {
  wildfire:
    "Vegetation scatters radar energy, so burned or cleared ground tends to return a weaker echo, especially in cross-polarised channels (HV, VH). Rain, soil moisture and farming can move the echo too, so a drop on its own does not prove a fire.",
  flood:
    "Calm open water bounces the radar pulse away from the satellite, so flooded land usually turns dark. Wetter soil and growing crops do the opposite and make the echo brighter, which is not flooding.",
  wetland:
    "Open water turns dark in radar. Flooded vegetation can turn bright, because the pulse bounces off the water and then the stems back to the satellite.",
  glacier: "Ice surfaces carry a stable speckle pattern, so shifts between passes track how the ice moves.",
  earthquake: "Phase changes between passes show how far the ground moved along the satellite's line of sight.",
  agriculture: "Backscatter changes with crop growth, harvest and tillage, so shifts mark changes in what is planted.",
  deformation: "Phase changes between passes reveal slow sinking or uplift of the ground.",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{children}</h3>;
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

const km = (value: number): string => formatValue(value);

/** Plain-language sentence built only from the measured numbers. */
function summaryOf(a: SensorAnalysis): string {
  const { land, method } = a;
  const span = daysBetween(a.pre.date, a.post.date);
  const head = `Comparing two ${a.label.split(" ")[0]} ${a.pol} passes ${span} days apart (${formatDate(day(a.pre.date))} and ${formatDate(day(a.post.date))}), `;
  const t = `${method.thresholdDb} dB`;
  const share = `${land.changedPct.toLocaleString("en-US", { maximumFractionDigits: 2 })}% of the ${km(land.validAreaKm2)} km² of land analysed`;
  if (land.changedAreaKm2 === 0) return `${head}no land crossed the ${t} threshold.`;
  if (method.direction === "decrease") {
    return `${head}the radar echo weakened by at least ${t} over ${km(land.changedAreaKm2)} km² of land (${share}).`;
  }
  if (method.direction === "increase") {
    return `${head}the radar echo strengthened by at least ${t} over ${km(land.changedAreaKm2)} km² of land (${share}).`;
  }
  return `${head}the radar echo changed by at least ${t} over ${km(land.changedAreaKm2)} km² of land (${share}): it weakened over ${km(land.decreaseAreaKm2)} km² and strengthened over ${km(land.increaseAreaKm2)} km².`;
}

/** Reasons to read the numbers with care, worked out from the numbers themselves. */
function cautionsOf(type: ChangeType, a: SensorAnalysis): string[] {
  const notes: string[] = [];
  const { land, stats } = a;

  const flagged = stats.changedAreaKm2;
  if (flagged > 0 && land.changedOnWaterKm2 / flagged >= 0.2) {
    notes.push(
      `${Math.round((100 * land.changedOnWaterKm2) / flagged)}% of the pixels flagged over the whole scene were open water already in the before image. Wind and waves change the echo of the sea, so they are left out of the land figure.`,
    );
  }
  if (land.changedPct < 0.1) {
    notes.push(
      `Under 0.1% of the land changed. At this size radar speckle, soil moisture or wind can account for it: treat it as a lead to check, not a finding.`,
    );
  }
  if (a.sensor === "nisar" && day(a.pre.date) < NISAR_VALIDATED_FROM && day(a.post.date) >= NISAR_VALIDATED_FROM) {
    notes.push(
      `The two passes straddle ASF's switch from provisional to validated NISAR products (${formatDate(NISAR_VALIDATED_FROM)}). They come from different processing releases, so a small shift in level can come from the processing and not from the ground.`,
    );
  }
  if (type === "flood" && land.increaseAreaKm2 > land.decreaseAreaKm2) {
    notes.push(
      `Over land the echo got stronger more often (${km(land.increaseAreaKm2)} km²) than weaker (${km(land.decreaseAreaKm2)} km²). Flooding usually makes open ground darker, so this looks more like wetter soil or crop growth than a flood.`,
    );
  }
  if (a.method.direction === "decrease" && land.increaseAreaKm2 > 0) {
    notes.push(
      `This analysis only looked for weaker echoes. The echo also got stronger by at least ${a.method.thresholdDb} dB over ${km(land.increaseAreaKm2)} km² of land, which is not counted above.`,
    );
  }
  const mappedWater = a.landCover?.classes.find((c) => c.code === 80);
  if (mappedWater && mappedWater.flaggedPct >= 20) {
    notes.push(
      `The 2021 land-cover map marks ${Math.round(mappedWater.flaggedPct)}% of the flagged land as permanent water: shoreline or shallow water that the brightness filter did not catch. That part is not land change.`,
    );
  }
  notes.push("Not verified on the ground or against other sources.");
  return notes;
}

function AnalysisView({ detail, analysis }: { detail: EventDetail; analysis: SensorAnalysis }) {
  const meta = CHANGE_TYPES[detail.type];
  const { land, stats, method, grid } = analysis;
  const span = daysBetween(analysis.pre.date, analysis.post.date);
  const cautions = cautionsOf(detail.type, analysis);

  return (
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-ink/90">{summaryOf(analysis)}</p>

      <section aria-labelledby="case-imagery">
        <SectionTitle>
          <span id="case-imagery">The two passes</span>
        </SectionTitle>
        <div className="mt-2.5">
          <SarViewer key={analysis.key} analysis={analysis} />
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Changed on land" note={`${land.changedPct.toLocaleString("en-US", { maximumFractionDigits: 2 })}% of ${km(land.validAreaKm2)} km² of land`}>
          {km(land.changedAreaKm2)} <span className="text-sm font-normal text-muted">km²</span>
        </Stat>
        <Stat label="Weaker / stronger" note={`on land, ≥ ${method.thresholdDb} dB`}>
          <span className="text-base">
            {km(land.decreaseAreaKm2)} <span className="font-normal text-muted">/</span> {km(land.increaseAreaKm2)}{" "}
            <span className="text-sm font-normal text-muted">km²</span>
          </span>
        </Stat>
        <Stat label="Mean change" note="over the whole scene, after − before">
          {stats.meanDiffDb === null ? "—" : `${stats.meanDiffDb > 0 ? "+" : stats.meanDiffDb < 0 ? "−" : ""}${Math.abs(stats.meanDiffDb).toFixed(2)}`}{" "}
          <span className="text-sm font-normal text-muted">dB</span>
        </Stat>
        <Stat label="Passes" note={`${span} days apart`}>
          <span className="text-sm">
            {formatDate(day(analysis.pre.date))}
            <br />→ {formatDate(day(analysis.post.date))}
          </span>
        </Stat>
      </dl>

      <section aria-labelledby="case-series">
        <SectionTitle>
          <span id="case-series">Flagged land vs the rest · every pass · dB</span>
        </SectionTitle>
        <div className="mt-2.5 space-y-3">
          <BackscatterChart analysis={analysis} color={meta.color} />
          <LocalChange analysis={analysis} />
        </div>
      </section>

      <Channels detail={detail} analysis={analysis} color={meta.color} />
      <GroundCover analysis={analysis} />
      <Baseline analysis={analysis} />

      <section aria-labelledby="case-reading">
        <SectionTitle>
          <span id="case-reading">What a change like this can mean</span>
        </SectionTitle>
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">{READING[detail.type]}</p>
      </section>

      <Hypotheses type={detail.type} />

      <section aria-labelledby="case-care">
        <SectionTitle>
          <span id="case-care">Read with care</span>
        </SectionTitle>
        <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-ink/85">
          {cautions.map((note) => (
            <li key={note} className="flex gap-2.5">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-accent" />
              {note}
            </li>
          ))}
        </ul>
      </section>

      <details className="text-xs leading-relaxed text-muted">
        <summary className="cursor-pointer select-none rounded font-mono text-[11px] uppercase tracking-[0.18em] hover:text-ink">
          How this was computed
        </summary>
        <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>Sensor</dt>
          <dd className="text-ink/85">
            {analysis.label}, {analysis.band}-band, {analysis.pol}, {grid.pixelSizeM} m pixels
          </dd>
          <dt>Track</dt>
          <dd className="text-ink/85">{analysis.group}</dd>
          <dt>Threshold</dt>
          <dd className="text-ink/85">
            {method.direction === "both" ? "±" : method.direction === "decrease" ? "−" : "+"}
            {method.thresholdDb} dB, {method.medianFilterPx}×{method.medianFilterPx} median filter
          </dd>
          <dt>Open water</dt>
          <dd className="text-ink/85">before image darker than {method.waterDb} dB ({km(land.waterAreaKm2)} km²)</dd>
          <dt>Overlap</dt>
          <dd className="text-ink/85">{grid.overlapPct === null ? "—" : `${grid.overlapPct}% of the area seen on both passes`}</dd>
        </dl>
        <p className="mt-2.5">
          Both passes are converted to decibels, the second is resampled onto the first, and the difference is
          thresholded.{" "}
          <Link href="/methods" className="text-accent underline-offset-4 hover:underline">
            Read the methods
          </Link>
          .
        </p>
      </details>

      <ShareBar detail={detail} analysis={analysis} />
    </div>
  );
}

function PanelBody({ detail }: { detail: EventDetail }) {
  const [picked, setPicked] = useState<string | null>(null);
  const analysis = detail.analyses.find((a) => a.key === picked) ?? detail.analyses[0];

  return (
    <div className="space-y-5">
      {detail.analyses.length > 1 && (
        <div className="ge-segments" role="group" aria-label="Satellite">
          {detail.analyses.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={a.key === analysis.key}
              onClick={() => setPicked(a.key)}
              className="ge-segment"
            >
              {a.sensor === "nisar" ? "NISAR" : "Sentinel-1"} · {a.pol}
            </button>
          ))}
        </div>
      )}
      <AnalysisView detail={detail} analysis={analysis} />
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

/** Case panel: opens when an analysed area is selected and shows what the radar saw. */
export function CasePanel() {
  const selectedId = useAppStore((s) => s.selectedId);
  const summary = useAppStore((s) => s.events.find((e) => e.id === s.selectedId) ?? null);
  const detail = useAppStore((s) => s.detail);
  const detailStatus = useAppStore((s) => s.detailStatus);
  const detailError = useAppStore((s) => s.detailError);
  const select = useAppStore((s) => s.select);
  const retryDetail = useAppStore((s) => s.retryDetail);
  const story = useAppStore((s) => s.story);
  const setStory = useAppStore((s) => s.setStory);

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
      if (event.key === "Escape" && !useAppStore.getState().story) select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  if (selectedId === null || summary === null || story) return null;

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
          </p>
          <h2
            id="case-title"
            ref={titleRef}
            tabIndex={-1}
            className="ge-no-ring mt-1 font-display text-[1.7rem] leading-[1.1] text-ink"
          >
            {summary.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {summary.region} · {summary.country}
          </p>
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/50 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
            Real radar data · not verified on the ground
          </p>
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
          <>
            <button
              type="button"
              onClick={() => setStory(true)}
              className="mb-5 flex w-full items-center gap-3 rounded-xl border border-accent/60 bg-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/70 text-accent">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.4-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2z" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-medium text-accent">Tell me the story</span>
                <span className="block text-xs text-muted">A step-by-step walk through what the radar saw</span>
              </span>
            </button>
            <PanelBody key={detail.id} detail={detail} />
          </>
        ) : (
          <PanelSkeleton />
        )}
      </div>
    </aside>
  );
}
