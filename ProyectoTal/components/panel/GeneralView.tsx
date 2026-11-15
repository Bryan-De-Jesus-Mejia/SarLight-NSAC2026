"use client";

import type { ReactNode } from "react";
import { Drivers } from "@/components/panel/Drivers";
import { Impact } from "@/components/panel/Impact";
import { SarViewer } from "@/components/panel/SarViewer";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType, EventDetail, SensorAnalysis } from "@/data/types";
import { formatDate, formatValue } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

/**
 * The case for everyone: the same real numbers as the technical view, said in
 * plain words, with what was on that land and why it matters to people.
 * Nothing here claims more than the radar shows.
 */

const DAY_MS = 86_400_000;
/** A football pitch is about 0.71 hectares, so one km² holds about 140 of them. */
const PITCHES_PER_KM2 = 140;

const day = (iso: string): string => iso.slice(0, 10);
const pitches = (km2: number): string => Math.max(1, Math.round(km2 * PITCHES_PER_KM2)).toLocaleString("en-US");

/** Land-cover classes in everyday words, and why each matters to people. */
const GROUND: Record<number, { name: string; why: string; icon: string }> = {
  40: { name: "Farmland", why: "Food and income for families", icon: "M12 21v-9M12 12c0-3.6-2.6-6-7-6 0 3.9 2.7 6 7 6zM12 14.5c0-3.2 2.4-5.500 7-5.500 0 3.500-2.700 5.500-7 5.500z" },
  50: { name: "Homes and streets", why: "Where people live and work", icon: "M3.5 11.5 12 4l8.5 7.5M6 10v9.500h12V10M10 19.500v-5h4v5" },
  10: { name: "Forest", why: "Shade, clean water and wildlife", icon: "M12 3.500 6.500 11h3L5.500 16.500h13L14.500 11h3zM12 16.500V21" },
  30: { name: "Pasture and grassland", why: "Where animals graze", icon: "M3 19.500h18M6 19.500c0-4 1-6 2.500-7.500M10 19.500c0-5 .5-8 2-10.500M14 19.500c0-4 1-6.500 3-8" },
  20: { name: "Scrubland", why: "Dry-land habitat", icon: "M3 19.500h18M8 19.500c0-3 1.500-4.500 4-4.500s4 1.500 4 4.500M12 15V9M9 11l3-2 3 2" },
  90: { name: "Wetland", why: "A natural sponge against floods", icon: "M3 9c2-1.600 4-1.600 6 0s4 1.600 6 0 4-1.600 6 0M3 14c2-1.600 4-1.600 6 0s4 1.600 6 0 4-1.600 6 0M3 19c2-1.600 4-1.600 6 0s4 1.600 6 0 4-1.600 6 0" },
  95: { name: "Mangroves", why: "They shield the coast from storms", icon: "M12 4v9M12 13c-3 0-5 2-5 6M12 13c3 0 5 2 5 6M12 13v6M8 8c1.500-1 6.500-1 8 0" },
  60: { name: "Bare ground", why: "Open soil and rock", icon: "M3 18.500h18M5 18.500l4-7 3 4 2-3 5 6" },
};

const WHY: Partial<Record<ChangeType, string>> = {
  flood:
    "When water covers farmland, a season of food and income can be lost. When it reaches homes, families have to leave them. Radar sees through storm clouds, so help can be pointed to the right place sooner.",
  wildfire:
    "A fire takes the forest that holds soil and water in place, and it can threaten the homes and farms nearby. Radar sees the damage through smoke, while it is still burning.",
};

function Title({ children }: { children: ReactNode }) {
  return <h3 className="font-display text-xl leading-tight text-ink">{children}</h3>;
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function headline(type: ChangeType, a: SensorAnalysis): string {
  if (type === "flood") {
    return a.land.decreaseAreaKm2 >= a.land.increaseAreaKm2
      ? "Signs of water where there was land"
      : "The land changed here, but it does not look like a flood";
  }
  if (type === "wildfire") return "Signs of vegetation lost";
  return "The ground changed here";
}

/** How much weight the clue deserves, from the same checks the technical view shows. */
function confidence(type: ChangeType, a: SensorAnalysis): { level: 1 | 2 | 3; label: string; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const pre = a.series.find((p) => p.date === day(a.pre.date));
  const post = a.series.find((p) => p.date === day(a.post.date));
  if (pre?.insideDb != null && post?.insideDb != null && pre.outsideDb != null && post.outsideDb != null) {
    const inside = Math.abs(post.insideDb - pre.insideDb);
    const outside = Math.abs(post.outsideDb - pre.outsideDb);
    if (inside >= 3 * Math.max(outside, 0.2)) {
      score += 1;
      reasons.push("Only this land changed. Everything around it stayed the same.");
    } else {
      reasons.push("The whole area shifted a little too, so part of this may be the weather.");
    }
  }
  if (a.baseline && a.baseline.beyond3SigmaPct >= 50) {
    score += 1;
    reasons.push("This land rarely changes this much from one visit to the next.");
  }
  const water = a.landCover?.classes.find((c) => c.code === 80);
  if (water && water.flaggedPct >= 20) {
    score -= 1;
    reasons.push("Part of it is sea or lake, where waves confuse the radar.");
  }
  if (type === "flood" && a.land.increaseAreaKm2 > a.land.decreaseAreaKm2) {
    score -= 1;
    reasons.push("Most of the change points to wetter soil or growing crops, not standing water.");
  }
  if (a.land.changedPct < 0.1) {
    score -= 1;
    reasons.push("The area is very small, so it could be noise.");
  }
  reasons.push("Nobody has checked it on the ground yet.");
  const level = score >= 2 ? 3 : score === 1 ? 2 : 1;
  return { level, label: level === 3 ? "A strong clue" : level === 2 ? "A clue" : "A weak clue", reasons };
}

export function GeneralView({ detail, analysis: a }: { detail: EventDetail; analysis: SensorAnalysis }) {
  const setAudience = useAppStore((s) => s.setAudience);
  const meta = CHANGE_TYPES[detail.type];
  const area = a.land.changedAreaKm2;
  const span = Math.round((Date.parse(day(a.post.date)) - Date.parse(day(a.pre.date))) / DAY_MS);
  const sure = confidence(detail.type, a);
  const ground = (a.landCover?.classes ?? []).filter((c) => GROUND[c.code] && c.flaggedKm2 >= 0.01).slice(0, 3);

  return (
    <div className="space-y-7">
      {/* The headline */}
      <section>
        <p className="font-display text-[1.65rem] leading-[1.12] text-ink">{headline(detail.type, a)}</p>
        <p className="mt-4">
          <span className="font-display text-6xl leading-none" style={{ color: meta.color }}>
            {formatValue(area)}
          </span>
          <span className="ml-1.5 text-xl text-muted">km²</span>
          <span className="mt-1 block text-sm text-muted">
            about <b className="font-medium text-ink">{pitches(area)} football pitches</b> of land
          </span>
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink/90">
          A radar satellite passed over {detail.region} on {formatDate(day(a.pre.date))}, and again {span} days later.
          This much land looked different the second time.
        </p>
      </section>

      {/* See it */}
      <section aria-labelledby="g-see">
        <Title>
          <span id="g-see">See it for yourself</span>
        </Title>
        <p className="mb-3 mt-1 text-sm text-muted">Drag the line to compare the two visits.</p>
        <SarViewer key={a.key} analysis={a} simple />
      </section>

      {/* What was on that land */}
      {ground.length > 0 && (
        <section aria-labelledby="g-ground">
          <Title>
            <span id="g-ground">What was on that land</span>
          </Title>
          <ul className="mt-3 space-y-2">
            {ground.map((c) => {
              const g = GROUND[c.code];
              return (
                <li key={c.code} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.03] px-3.5 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-ink">
                    <Icon d={g.icon} size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{g.name}</span>
                    <span className="block text-xs text-muted">{g.why}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm text-ink">{formatValue(c.flaggedKm2)} km²</span>
                    <span className="block text-[11px] text-muted">{pitches(c.flaggedKm2)} pitches</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-muted">From a 2021 map of land use, so the ground may be different today.</p>
        </section>
      )}

      {/* Why it matters */}
      {WHY[detail.type] && (
        <section aria-labelledby="g-why">
          <Title>
            <span id="g-why">Why it matters to people</span>
          </Title>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/90">{WHY[detail.type]}</p>
        </section>
      )}

      <div className="rounded-2xl border border-line bg-white/[0.03] p-4">
        <Drivers detail={detail} />
      </div>

      <Impact detail={detail} />

      {/* How sure */}
      <section aria-labelledby="g-sure" className="rounded-2xl border border-line bg-white/[0.03] p-4">
        <Title>
          <span id="g-sure">How sure are we?</span>
        </Title>
        <p className="mt-2.5 flex items-center gap-2.5">
          <span className="flex gap-1" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-2.5 w-7 rounded-full ${n <= sure.level ? "bg-accent" : "bg-white/15"}`} />
            ))}
          </span>
          <span className="text-[15px] font-medium text-ink">{sure.label}</span>
        </p>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-ink/85">
          {sure.reasons.map((r) => (
            <li key={r} className="flex gap-2.5">
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-muted" />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">The satellite shows that something changed. It cannot tell us why.</p>
      </section>

      {/* How the satellite sees */}
      <section aria-labelledby="g-how">
        <Title>
          <span id="g-how">How can a satellite see this?</span>
        </Title>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["It makes its own light", "Like a bat, it sends a signal and listens for the echo.", "M4 12h3M17 12h3M12 4v3M12 17v3M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"],
            ["Clouds do not stop it", "It works at night, in rain and through smoke.", "M7 17.500h9.500a3.500 3.500 0 0 0 .5-6.960A5.500 5.500 0 0 0 6.400 11.200 3.200 3.200 0 0 0 7 17.500z"],
            ["Water looks dark", "Calm water is a mirror. Forests and towns look bright.", "M12 3.200s5 5.400 5 9.100a5 5 0 0 1-10 0c0-3.700 5-9.100 5-9.100z"],
          ].map(([t, body, d]) => (
            <li key={t} className="rounded-xl border border-line bg-white/[0.03] px-2 py-3">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-line text-accent">
                <Icon d={d} />
              </span>
              <span className="mt-2 block text-[13px] font-medium leading-tight text-ink">{t}</span>
              <span className="mt-1 block text-[11px] leading-snug text-muted">{body}</span>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" onClick={() => setAudience("technical")} className="ge-link text-sm">
        See the technical details behind this →
      </button>
    </div>
  );
}
