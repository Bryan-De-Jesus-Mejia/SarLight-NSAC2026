import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { SignificanceMeter } from "@/components/icons/SignificanceMeter";
import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import type { SignificanceLevel } from "@/data/types";

export const metadata: Metadata = {
  title: "Methods — Dancing with the SARs",
  description:
    "How this explorer works: what SAR and NISAR measure, the four radar techniques behind the signals, how significance is computed, and exactly what is simulated in this prototype.",
};

const TECHNIQUES: readonly { name: string; measures: string; body: string; usedFor: string }[] = [
  {
    name: "Backscatter intensity",
    measures: "How much of the pulse comes back",
    body: "Rough or leafy surfaces scatter a lot of energy back to the satellite and look bright; smooth ones such as calm water send it away and look dark. Tracking brightness over time reveals flooding, burn scars, harvests and clearing.",
    usedFor: "Wildfire, agriculture, glacier fronts",
  },
  {
    name: "Polarimetry",
    measures: "How the pulse's orientation changes",
    body: "NISAR sends horizontally polarised pulses and listens in both horizontal (HH) and vertical (HV). Bare ground mostly keeps the orientation; vegetation rotates it; flooded stems create a strong double bounce in HH. The mix tells surface types apart.",
    usedFor: "Wetlands, flooded vegetation, crops",
  },
  {
    name: "Interferometry (InSAR)",
    measures: "Change in distance, from wave phase",
    body: "Comparing the phase of the returning wave between two passes shows whether the ground moved toward or away from the satellite. One full colour cycle (a fringe) is half a wavelength of motion: about 12 cm at L-band. Stacking many pairs reaches millimetres per year.",
    usedFor: "Earthquakes, subsidence, uplift",
  },
  {
    name: "Coherence change",
    measures: "How much the surface was disturbed",
    body: "If the ground is untouched between passes, the two radar images stay correlated (coherent). Collapsed buildings, landslides, fresh lava or ploughed fields scramble the signal, so a sudden loss of coherence maps where something was disturbed.",
    usedFor: "Damage mapping, landslides, land clearing",
  },
];

const LEVELS: readonly { level: SignificanceLevel; label: string; rule: string; meaning: string }[] = [
  { level: "high", label: "High", rule: "|z| ≥ 3", meaning: "Well outside the baseline's normal variation." },
  { level: "medium", label: "Medium", rule: "2 ≤ |z| < 3", meaning: "Likely a real change; worth a closer look." },
  { level: "low", label: "Low", rule: "|z| < 2", meaning: "Within what the baseline does on its own." },
];

const HONESTY: readonly { item: string; status: "Real" | "Simulated"; note: string }[] = [
  { item: "Places", status: "Real", note: "Every featured case and every cluster of signals sits at a real location where that kind of change is known to occur." },
  { item: "Radar physics", status: "Real", note: "The explanations of how each technique works describe real SAR behaviour." },
  { item: "Signal values", status: "Simulated", note: "Magnitudes, dates, areas, time series and significance are generated from a fixed seed. None is a measurement." },
  { item: "Before / after imagery", status: "Simulated", note: "Drawn procedurally to illustrate what backscatter and interferograms look like. Not satellite images." },
  { item: "Drivers and impacts", status: "Simulated", note: "Written as hypotheses for a real analyst to test, not as findings about these places today." },
];

const PIPELINE: readonly { step: string; body: string }[] = [
  { step: "Discover", body: "Search NASA's Common Metadata Repository and the Alaska Satellite Facility DAAC for NISAR granules over an area and period." },
  { step: "Reduce", body: "NISAR products are multi-gigabyte HDF5 files. An offline step turns them into small per-site time series and image tiles." },
  { step: "Detect", body: "Compare each new pass against that site's own baseline and keep the changes that stand out from its normal variation." },
  { step: "Serve", body: "A NisarProvider returns the same event shape the app already uses, with source set to “nisar” — and the “Simulated data” labels disappear on their own." },
];

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
        {title}
      </h2>
      <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

export default function MethodsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
      <nav aria-label="Site">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/60 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          Back to the globe
        </Link>
      </nav>

      <header className="pb-10 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Methods</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
          How radar sees the Earth <em>move</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          What the satellite measures, how a change becomes a signal on the globe, how sure we can
          be about it — and exactly which parts of this prototype are simulated.
        </p>
        <p className="mt-6 inline-flex items-start gap-2.5 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span>
            <strong className="font-medium text-accent">This prototype runs on simulated data.</strong>{" "}
            No value shown in the explorer is a NISAR measurement. The methods below are the ones the
            app is built to apply once real products are connected.
          </span>
        </p>
      </header>

      <div className="space-y-12">
        <Section id="sar" eyebrow="01 · The instrument" title="Radar that makes its own light">
          <p>
            A camera needs sunlight and a clear sky. A Synthetic Aperture Radar (SAR) sends its own
            microwave pulses and records the echo, so it works at night and straight through cloud,
            smoke and rain. By combining echoes collected along its orbit, it synthesises an antenna
            kilometres long and resolves details a few metres across from hundreds of kilometres up.
          </p>
          <p>
            NISAR, a joint mission of NASA and the Indian Space Research Organisation (ISRO) launched
            in July 2025, carries two radars: NASA&rsquo;s L-band (wavelength about 24 cm) and
            ISRO&rsquo;s S-band (about 9 cm). The long L-band waves pass through leaves and reach
            trunks, soil and ice, which is what makes it good at forests, wetlands and ground motion.
            It images nearly all of Earth&rsquo;s land and ice and returns to the same ground track
            every 12 days — which is why every time series in this app has one point per 12-day pass.
          </p>
        </Section>

        <Section id="techniques" eyebrow="02 · Four ways to read an echo" title="The techniques behind the signals">
          <ul className="grid gap-3 sm:grid-cols-2">
            {TECHNIQUES.map((t) => (
              <li key={t.name} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                <h3 className="font-display text-xl text-ink">{t.name}</h3>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{t.measures}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/80">{t.body}</p>
                <p className="mt-3 border-t border-line pt-2.5 text-xs text-muted">Used here for: {t.usedFor}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="types" eyebrow="03 · What we track" title="Six kinds of surface change">
          <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {CHANGE_TYPE_ORDER.map((type) => {
              const info = CHANGE_TYPES[type];
              return (
                <li key={type} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      color: info.color,
                      borderColor: `rgb(${info.rgb.join(" ")} / 0.45)`,
                      backgroundColor: `rgb(${info.rgb.join(" ")} / 0.12)`,
                    }}
                  >
                    <ChangeTypeIcon type={type} size={17} />
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{info.label}</span>
                    <span className="block text-sm leading-relaxed text-muted">{info.blurb}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">
            Each type has its own colour and its own glyph, so the map never relies on colour alone.
          </p>
        </Section>

        <Section id="significance" eyebrow="04 · How sure are we" title="Is the change real, or just noise?">
          <p>
            Every place wobbles on its own: soil gets wet, crops grow, the atmosphere delays the
            signal. A change only matters if it is larger than that normal wobble. For each case the
            app compares the end of the series with its own baseline:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-xs marker:text-muted">
            <li>Take the 8 passes before the event as the baseline; compute their mean and spread (sample standard deviation, σ).</li>
            <li>Take the mean of the last 3 passes as the post-change level.</li>
            <li>The change is the difference between the two means.</li>
            <li>Divide by σ to get a z-score, and convert it to a two-sided p-value under a normal distribution.</li>
          </ol>
          <p className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-center font-mono text-sm text-ink">
            z = ( mean<sub>last 3</sub> − mean<sub>baseline</sub> ) / σ<sub>baseline</sub>
          </p>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Significance levels and their thresholds</caption>
              <thead className="bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-normal">Level</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">Rule</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">Reading</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((row) => (
                  <tr key={row.level} className="border-t border-line">
                    <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium text-ink">
                      <SignificanceMeter level={row.level} className="mr-2" />
                      {row.label}
                    </th>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink">{row.rule}</td>
                    <td className="px-4 py-3 text-ink/80">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The numbers in each case panel are computed from the very points plotted in its chart —
            you can open the data table and check them.
          </p>
          <p className="text-sm text-muted">
            Limits of this test: it assumes roughly normal, independent baseline values, and 8 passes
            is a short baseline. Real radar series have seasons and correlated noise, so a production
            version should model the seasonal cycle and use a longer record before calling a change
            significant.
          </p>
        </Section>

        <Section id="honesty" eyebrow="05 · Honesty" title="What is real and what is simulated">
          <ul className="space-y-2.5">
            {HONESTY.map((row) => (
              <li key={row.item} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-white/[0.03] p-4 sm:flex-row sm:items-start sm:gap-4">
                <span className="flex shrink-0 items-center gap-3 sm:w-56">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      row.status === "Simulated" ? "border-accent/60 text-accent" : "border-line text-ink"
                    }`}
                  >
                    {row.status}
                  </span>
                  <span className="font-medium text-ink">{row.item}</span>
                </span>
                <span className="text-sm leading-relaxed text-ink/80">{row.note}</span>
              </li>
            ))}
          </ul>
          <p>
            The simulated values are deterministic: the same seed always produces the same 328
            signals, so the prototype behaves identically for everyone. Wherever a simulated value
            appears, the interface says so.
          </p>
        </Section>

        <Section id="real-data" eyebrow="06 · Next" title="From prototype to real NISAR data">
          <p>
            The app talks to its data through a single interface. Replacing the simulated provider
            with a real one does not touch the globe, the panel or the timeline. Three NISAR Level-2
            products cover the six change types:
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              ["GCOV", "Geocoded polarimetric covariance", "Backscatter change: wetlands, wildfire, agriculture"],
              ["GUNW", "Geocoded unwrapped interferogram", "Ground displacement: earthquakes, land deformation"],
              ["GOFF", "Geocoded pixel offsets", "Ice flow and terminus motion: glaciers"],
            ].map(([code, name, use]) => (
              <li key={code} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                <p className="font-mono text-lg text-accent">{code}</p>
                <p className="mt-1 text-sm font-medium text-ink">{name}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{use}</p>
              </li>
            ))}
          </ul>
          <ol className="space-y-3">
            {PIPELINE.map((p, i) => (
              <li key={p.step} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium text-ink">{p.step}. </span>
                  <span className="text-ink/80">{p.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <footer className="mt-14 border-t border-line pt-6 text-sm text-muted">
        <p>
          Built for the NASA Space Apps Challenge 2026, challenge “Dancing with the SARs”. Earth
          imagery on the globe: NASA Blue Marble.
        </p>
        <Link href="/" className="mt-3 inline-block text-accent underline-offset-4 hover:underline">
          Back to the globe
        </Link>
      </footer>
    </main>
  );
}
