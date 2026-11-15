"use client";

import { useState, type ReactNode } from "react";
import type { EventDetail } from "@/data/types";

/**
 * "Why?" cards: the science behind one story step, in three lines and a
 * drawing. Picked by step and kind of case, so every story gets them without
 * writing anything per case. For anyone learning on their own or in class.
 */

export interface Why {
  question: string;
  answer: string;
  art: ReactNode;
}

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** A satellite in the top-left corner. */
const Sat = () => (
  <g {...S}>
    <rect x="14" y="10" width="12" height="8" rx="1.5" />
    <path d="M6 14h8M26 14h8" />
  </g>
);

const ART = {
  clouds: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <Sat />
      <path d="M44 42c-8 0-12-10-3-13 2-8 16-9 19-1 9-2 14 9 6 14z" fill="currentColor" opacity="0.18" />
      <path d="M26 20 Q 40 30 54 40 T 82 60 T 110 80" {...S} strokeDasharray="5 4" className="text-accent" />
      <path d="M0 82h200" {...S} opacity="0.5" />
      <text x="120" y="30" fontSize="9" fill="currentColor" opacity="0.8">cloud droplet: 0.01 mm</text>
      <text x="120" y="44" fontSize="9" fill="currentColor" opacity="0.8">radar wave: 24 cm</text>
    </svg>
  ),
  mirror: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <Sat />
      <path d="M26 20 70 76 120 20" {...S} strokeDasharray="5 4" />
      <path d="M40 78h70" stroke="currentColor" strokeWidth="3" opacity="0.6" />
      <text x="128" y="26" fontSize="9" fill="currentColor" opacity="0.8">bounces away:</text>
      <text x="128" y="38" fontSize="9" fill="currentColor" opacity="0.8">no echo, dark pixel</text>
    </svg>
  ),
  rough: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <Sat />
      <path d="M26 20 64 66" {...S} strokeDasharray="5 4" />
      <path d="M64 66 30 24M64 66 58 26M64 66 90 34M64 66 100 60" {...S} opacity="0.55" />
      <path d="M50 80c2-10 4-14 6-16M62 80c0-9 2-14 2-16M74 80c-1-8-3-12-6-15" {...S} />
      <path d="M30 80h80" {...S} opacity="0.5" />
      <text x="118" y="26" fontSize="9" fill="currentColor" opacity="0.8">scatters everywhere:</text>
      <text x="118" y="38" fontSize="9" fill="currentColor" opacity="0.8">part comes back, bright</text>
    </svg>
  ),
  orbit: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <circle cx="60" cy="45" r="20" {...S} />
      <ellipse cx="60" cy="45" rx="44" ry="16" {...S} strokeDasharray="4 4" transform="rotate(-25 60 45)" />
      <rect x="96" y="22" width="8" height="6" rx="1" fill="currentColor" />
      <text x="118" y="40" fontSize="9" fill="currentColor" opacity="0.8">same spot, same angle,</text>
      <text x="118" y="52" fontSize="9" fill="currentColor" opacity="0.8">every 12 days</text>
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <rect x="30" y="20" width="22" height="60" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="70" y="50" width="22" height="30" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="110" y="65" width="22" height="15" rx="2" fill="currentColor" opacity="0.6" />
      <text x="30" y="14" fontSize="9" fill="currentColor">0 dB</text>
      <text x="68" y="44" fontSize="9" fill="currentColor">−3 dB</text>
      <text x="106" y="59" fontSize="9" fill="currentColor">−6 dB</text>
      <text x="142" y="78" fontSize="9" fill="currentColor" opacity="0.8">half, a quarter</text>
    </svg>
  ),
  fringes: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      {["#f87171", "#fbbf24", "#4ade80", "#38bdf8", "#a78bfa"].map((c, i) => (
        <circle key={c} cx="60" cy="45" r={40 - i * 8} fill="none" stroke={c} strokeWidth="5" opacity="0.8" />
      ))}
      <text x="112" y="40" fontSize="9" fill="currentColor" opacity="0.8">one full colour cycle</text>
      <text x="112" y="52" fontSize="9" fill="currentColor" opacity="0.8">= about 12 cm of motion</text>
    </svg>
  ),
  slant: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <Sat />
      <path d="M26 20 84 72" {...S} />
      <path d="M84 72 74 62M84 72 70 70" {...S} />
      <path d="M40 80h90" {...S} opacity="0.5" />
      <text x="118" y="34" fontSize="9" fill="currentColor" opacity="0.8">only motion along this line</text>
      <text x="118" y="46" fontSize="9" fill="currentColor" opacity="0.8">(toward or away from it)</text>
    </svg>
  ),
  track: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <path d="M20 60l14-10 10 6 12-12" {...S} opacity="0.4" />
      <path d="M70 60l14-10 10 6 12-12" {...S} />
      <path d="M50 30h30" {...S} className="text-accent" />
      <path d="M74 25l6 5-6 5" {...S} />
      <text x="118" y="40" fontSize="9" fill="currentColor" opacity="0.8">same crack, 12 days later:</text>
      <text x="118" y="52" fontSize="9" fill="currentColor" opacity="0.8">distance ÷ days = speed</text>
    </svg>
  ),
  people: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={i} x={20 + (i % 6) * 14} y={14 + Math.floor(i / 6) * 16} width="12" height="14" fill="currentColor" opacity={[0.1, 0.3, 0.6, 0.2, 0.45, 0.15][(i * 7) % 6]} />
      ))}
      <path d="M38 30c14-6 30 0 42 14s10 26-4 28" fill="none" stroke="#38bdf8" strokeWidth="2" />
      <text x="118" y="40" fontSize="9" fill="currentColor" opacity="0.8">people per 1 km square,</text>
      <text x="118" y="52" fontSize="9" fill="currentColor" opacity="0.8">counted where it changed</text>
    </svg>
  ),
  cause: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <path d="M20 70h30M60 70h30M100 70h30" {...S} opacity="0.5" />
      <circle cx="35" cy="50" r="10" {...S} />
      <circle cx="75" cy="50" r="10" {...S} />
      <circle cx="115" cy="50" r="10" {...S} />
      <path d="M47 50h16M87 50h16" {...S} />
      <text x="20" y="22" fontSize="9" fill="currentColor" opacity="0.8">record + radar + place = most likely story</text>
    </svg>
  ),
  seasons: (
    <svg viewBox="0 0 250 90" aria-hidden="true">
      <path d="M14 60c20-30 40-30 60 0s40 30 60 0" {...S} opacity="0.5" />
      <path d="M134 60l12 -36" {...S} className="text-accent" />
      <text x="20" y="84" fontSize="9" fill="currentColor" opacity="0.8">slow, repeating: seasons</text>
      <text x="120" y="18" fontSize="9" fill="currentColor" opacity="0.8">sudden jump: an event</text>
    </svg>
  ),
};

const W = {
  clouds: {
    question: "How can a satellite see through clouds?",
    answer: "NISAR's L-band radar uses waves about 24 cm long. Cloud droplets are thousands of times smaller, so the wave passes them as if they were not there. It also brings its own signal, so it works at night.",
    art: ART.clouds,
  },
  orbit: {
    question: "Why every 12 days?",
    answer: "NISAR repeats the same path over the planet every 12 days, at the same angle. Comparing two identical visits means any difference comes from the ground, not from the way the picture was taken.",
    art: ART.orbit,
  },
  water: {
    question: "Why does water look black?",
    answer: "Calm water is a mirror. The radar pulse hits it at an angle and bounces away, like a ball off a smooth floor, so almost nothing comes back to the satellite. Little echo means a dark pixel.",
    art: ART.mirror,
  },
  leaves: {
    question: "Why do plants shine on radar?",
    answer: "Leaves, stems and branches scatter the pulse in every direction and some of it comes back. When a fire, a harvest or the wind removes them, the echo weakens and the pixel gets darker.",
    art: ART.rough,
  },
  db: {
    question: "What is a decibel (dB)?",
    answer: "A way of counting echo strength by multiplying, not adding. Every 3 dB less means half the echo. A drop of 6 dB means only a quarter of the echo came back.",
    art: ART.bars,
  },
  seasons: {
    question: "Why watch for months, not just one day?",
    answer: "Fields grow and dry every season, so a single difference can fool you. Watching every pass shows the slow normal rhythm, and a sudden jump against it is what points to an event.",
    art: ART.seasons,
  },
  fringes: {
    question: "What are the coloured rings?",
    answer: "The radar also measures the exact timing of the wave. If the ground moved between two visits, the timing shifts. Every full cycle of colours means about 12 cm of movement, half the 24 cm wave.",
    art: ART.fringes,
  },
  slant: {
    question: "Why only one direction?",
    answer: "The radar looks sideways at the ground and measures motion only along its line of sight: toward it or away from it. Two passes from different sides help rebuild the real motion.",
    art: ART.slant,
  },
  track: {
    question: "How do you measure ice speed from space?",
    answer: "The radar finds the same cracks and textures in two images 12 days apart and measures how far they travelled. Distance divided by time gives the speed, even in the dark polar winter.",
    art: ART.track,
  },
  cause: {
    question: "Does the weather prove the cause?",
    answer: "No, it supports it. Rain, heat or an earthquake recorded at the right time, plus a change the radar saw in the right place, make the most likely story. Only a visit on the ground can confirm it.",
    art: ART.cause,
  },
  people: {
    question: "How do we count the people?",
    answer: "A European population map splits the planet into 1 km squares with an estimate of how many people live in each. We add up the squares where our radar flagged change, so it is an estimate, not a census.",
    art: ART.people,
  },
} satisfies Record<string, Why>;

/** The card for one story step of one case, or null when there is nothing to add. */
export function whyFor(stepKey: string, detail: EventDetail): Why | null {
  const t = detail.type;
  const darkens = t === "wildfire" || t === "storm" || t === "drought" || t === "agriculture" || t === "landslide";
  switch (stepKey) {
    case "place":
      return W.clouds;
    case "before":
    case "passes":
      return W.orbit;
    case "after":
    case "difference":
    case "map":
      return t === "flood" || t === "wetland" ? W.water : darkens ? W.leaves : t === "glacier" ? W.track : null;
    case "flagged":
      return W.db;
    case "time":
      return W.seasons;
    case "fringes":
      return W.fringes;
    case "moved":
      return W.slant;
    case "speed":
      return W.track;
    case "drivers":
    case "why":
      return W.cause;
    case "people":
      return W.people;
    default:
      return null;
  }
}

/** A small "Why?" button that opens the card under it. */
export function WhyButton({ why }: { why: Why }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 px-3 py-1 text-xs text-accent transition-colors hover:bg-accent/10"
      >
        <span aria-hidden="true" className="font-display text-sm leading-none">?</span>
        {why.question}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-white/[0.03] p-3">
          <div className="text-muted [&>svg]:h-auto [&>svg]:max-h-28 [&>svg]:w-full">{why.art}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/90">{why.answer}</p>
        </div>
      )}
    </div>
  );
}
