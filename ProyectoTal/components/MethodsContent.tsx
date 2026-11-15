"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { CHANGE_TYPES, CHANGE_TYPE_ORDER } from "@/data/changeTypes";
import { msg, useT } from "@/i18n/core";
import { formatDate, formatValue } from "@/lib/format";

/** One analysis, reduced to what the table shows (so the server page can hand it over as plain data). */
export interface MethodsRow {
  key: string;
  name: string;
  sensor: "nisar" | "opera";
  pol: string;
  pre: string;
  post: string;
  changedKm2: number;
  seaKm2: number;
}

const TECHNIQUES: readonly { name: string; measures: string; body: string; usedFor: string }[] = [
  {
    name: msg("Backscatter intensity"),
    measures: msg("How much of the pulse comes back"),
    body: msg(
      "Rough or leafy surfaces scatter a lot of energy back to the satellite and look bright; smooth ones such as calm water send it away and look dark. Tracking brightness over time reveals flooding, burn scars, harvests and clearing.",
    ),
    usedFor: msg("Wildfire, agriculture, glacier fronts"),
  },
  {
    name: msg("Polarimetry"),
    measures: msg("How the pulse's orientation changes"),
    body: msg(
      "NISAR sends horizontally polarised pulses and listens in both horizontal (HH) and vertical (HV). Bare ground mostly keeps the orientation; vegetation rotates it; flooded stems create a strong double bounce in HH. The mix tells surface types apart.",
    ),
    usedFor: msg("Wetlands, flooded vegetation, crops"),
  },
  {
    name: msg("Interferometry (InSAR)"),
    measures: msg("Change in distance, from wave phase"),
    body: msg(
      "Comparing the phase of the returning wave between two passes shows whether the ground moved toward or away from the satellite. One full colour cycle (a fringe) is half a wavelength of motion: about 12 cm at L-band. Stacking many pairs reaches millimetres per year.",
    ),
    usedFor: msg("Earthquakes, subsidence, uplift"),
  },
  {
    name: msg("Coherence change"),
    measures: msg("How much the surface was disturbed"),
    body: msg(
      "If the ground is untouched between passes, the two radar images stay correlated (coherent). Collapsed buildings, landslides, fresh lava or ploughed fields scramble the signal, so a sudden loss of coherence maps where something was disturbed.",
    ),
    usedFor: msg("Damage mapping, landslides, land clearing"),
  },
];

const STEPS: readonly { step: string; body: string }[] = [
  { step: msg("Pick two passes"), body: msg("Two scenes from the same satellite track and polarisation, so both look at the ground from the same angle.") },
  { step: msg("Convert to decibels"), body: msg("Backscatter power becomes 10·log10(power). Differences then read as ratios: −3 dB is about half the echo.") },
  { step: msg("Align and subtract"), body: msg("The second scene is resampled onto the pixel grid of the first and subtracted: after − before.") },
  { step: msg("Calm the speckle"), body: msg("Radar images are naturally grainy. A median filter (5×5 pixels) smooths the difference without blurring edges.") },
  { step: msg("Apply a threshold"), body: msg("A pixel is flagged when it changed by at least 3 dB. Fire analyses look for weaker echoes only; flood analyses look in both directions.") },
  { step: msg("Count the area"), body: msg("Flagged pixels become square kilometres using the pixel size: 10 m for NISAR, 30 m for Sentinel-1.") },
  { step: msg("Compare with the rest"), body: msg("For every pass of the track we take the median echo of the flagged land and of all the other land. If only the flagged land moves, the change is local.") },
  { step: msg("Check the other channel"), body: msg("The same two passes are compared again with the other polarisation, over the same land and with the same threshold.") },
  { step: msg("Measure normal variation"), body: msg("Where a track has at least 7 passes, the differences between consecutive passes give each pixel its own typical variation; we report how much of the flagged land moved more than 3 times that.") },
  { step: msg("Set the sea aside"), body: msg("Pixels that were already open water in the before image (darker than −17 dB in HH/VV, −22 dB in HV/VH) are reported separately: wind and waves change their echo, so they are not counted as land change.") },
];

const LIMITS: readonly { title: string; body: string }[] = [
  { title: msg("No ground truth"), body: msg("Nothing here has been checked against field reports, fire detections or flood maps. A flagged area is a lead, not a finding.") },
  { title: msg("Only two passes"), body: msg("With one before and one after there is no baseline: we cannot say whether the change is unusual for that place. The chart of every pass shows how much the whole area normally moves.") },
  { title: msg("Radar is not a camera"), body: msg("A weaker echo can come from burned or cleared vegetation, but also from drier or smoother ground. A stronger one can come from wetter soil or growing crops.") },
  { title: msg("The threshold is a choice"), body: msg("3 dB is a convention that balances false alarms against missed changes. A different value would flag a different area.") },
  { title: msg("Data releases differ"), body: msg("ASF labels NISAR L-band products beta, provisional or validated. Provisional covers acquisitions from 17 June to 20 October 2026 and validated starts on 21 October, so a comparison across that date mixes two processing releases. There is also a gap with no data from 27 July to 10 August 2026.") },
];

const SOURCES: readonly { name: string; body: string }[] = [
  { name: "NISAR L2 GCOV", body: msg("L-band (about 24 cm), polarimetric backscatter at 10 m, from the Alaska Satellite Facility archive of NASA (ASF DAAC).") },
  { name: "OPERA RTC-S1", body: msg("C-band (about 5.6 cm) Sentinel-1 backscatter at 30 m, terrain-corrected by the OPERA project of NASA, also from ASF.") },
  { name: msg("Base map and radar layers"), body: msg("Satellite base map: Sentinel-2 cloudless by EOX (contains modified Copernicus Sentinel data 2021). Radar overlays and the same-day camera view of the radar lens (NOAA-20 VIIRS true colour): NASA GIBS.") },
  { name: msg("Land cover"), body: msg("ESA WorldCover 2021 v200 at 10 m (© ESA WorldCover project, contains modified Copernicus Sentinel data), used to say what kind of ground the flagged pixels sit on.") },
  { name: msg("Weather records"), body: msg("Daily rain, maximum temperature and wind gusts from the ERA5 reanalysis through the Open-Meteo historical weather API (CC BY 4.0), at the centre of each area. They support the “Why it happened” chain; they do not prove a cause pixel by pixel.") },
  { name: msg("Population"), body: msg("People per 1 km square from the GHSL population grid (GHS-POP R2023A, epoch 2025, European Commission JRC, CC BY 4.0). We add up the people living on the pixels our analysis flagged; each 20 m pixel takes the density of its square, so the result is an estimate, not a census.") },
  { name: msg("Earthquake catalogue"), body: msg("Magnitude, depth, time and place of earthquakes from the USGS catalogue (public domain). For Venezuela (M7.5, 24 June 2026) and Mexico (M7.3, 17 July 2026) it independently confirms the events our radar analysis was built around.") },
  { name: msg("NISAR scene footprints"), body: msg("The 12-day dance draws the footprints of every NISAR L2 GCOV scene of one cycle, as listed in the public NASA CMR catalogue.") },
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

export function MethodsContent({ rows }: { rows: MethodsRow[] }) {
  const t = useT();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12">
      <nav aria-label={t("Site")} className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-accent/60 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          {t("Back to the globe")}
        </Link>
        <LanguageToggle />
      </nav>

      <header className="pb-10 pt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{t("Methods")}</p>
        <h1 className="mt-3 font-display text-5xl leading-[1.02] text-ink sm:text-6xl">
          {t("How radar sees the Earth")} <em>{t("move")}</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
          {t("What the satellite measures, how two radar passes become a change map, and what the numbers can and cannot tell you.")}
        </p>
        <p className="mt-6 inline-flex items-start gap-2.5 rounded-2xl border border-accent/50 bg-accent/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
          <span>
            <strong className="font-medium text-accent">{t("Every figure in the explorer is computed from real radar scenes.")}</strong>{" "}
            {t("It is a first-pass analysis: nothing has been verified on the ground yet, and the limits are listed below.")}
          </span>
        </p>
      </header>

      <div className="space-y-12">
        <Section id="sar" eyebrow={t("01 · The instrument")} title={t("Radar that makes its own light")}>
          <p>
            {t(
              "A camera needs sunlight and a clear sky. A Synthetic Aperture Radar (SAR) sends its own microwave pulses and records the echo, so it works at night and straight through cloud, smoke and rain. By combining echoes collected along its orbit, it synthesises an antenna kilometres long and resolves details a few metres across from hundreds of kilometres up.",
            )}
          </p>
          <p>
            {t(
              "NISAR, a joint mission of NASA and the Indian Space Research Organisation (ISRO) launched in July 2025, carries two radars: NASA’s L-band (wavelength about 24 cm) and ISRO’s S-band (about 9 cm). The long L-band waves pass through leaves and reach trunks, soil and ice, which is what makes it good at forests, wetlands and ground motion. It images nearly all of Earth’s land and ice and returns to the same ground track every 12 days — which is why the charts in this app have one point per pass.",
            )}
          </p>
        </Section>

        <Section id="techniques" eyebrow={t("02 · Four ways to read an echo")} title={t("The techniques behind the signals")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TECHNIQUES.map((row) => (
              <li key={row.name} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                <h3 className="font-display text-xl text-ink">{t(row.name)}</h3>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{t(row.measures)}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/80">{t(row.body)}</p>
                <p className="mt-3 border-t border-line pt-2.5 text-xs text-muted">{t("Used here for: {uses}", { uses: t(row.usedFor) })}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="types" eyebrow={t("03 · What we track")} title={t("What the analyses look for")}>
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
                    <span className="block font-medium text-ink">{t(info.label)}</span>
                    <span className="block text-sm leading-relaxed text-muted">{t(info.blurb)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">
            {t(
              "Today the analyses cover fire and flood searches in the Dominican Republic; the other types are what the explorer is built to grow into. Each type has its own colour and its own glyph, so the map never relies on colour alone.",
            )}
          </p>
        </Section>

        <Section id="pipeline" eyebrow={t("04 · From two images to a number")} title={t("How a change is measured")}>
          <ol className="space-y-3">
            {STEPS.map((p, i) => (
              <li key={p.step} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium text-ink">{t(p.step)}. </span>
                  <span className="text-ink/80">{t(p.body)}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-xl border border-line bg-white/[0.03] px-4 py-3 text-center font-mono text-sm text-ink">
            Δ = 10·log<sub>10</sub>(after) − 10·log<sub>10</sub>(before) &nbsp;→&nbsp; {t("flagged where")} |Δ| ≥ 3 dB
          </p>

          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <caption className="sr-only">{t("The analyses behind the explorer")}</caption>
              <thead className="bg-white/[0.04] font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-normal">{t("Area")}</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">{t("Satellite")}</th>
                  <th scope="col" className="px-4 py-2.5 font-normal">{t("Passes")}</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-normal">{t("Land changed")}</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-normal">{t("On sea")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-line align-top">
                    <th scope="row" className="px-4 py-3 font-medium text-ink">
                      {t(row.name.replace(" analysis", ""))}
                    </th>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/80">
                      {row.sensor === "nisar" ? "NISAR" : "Sentinel-1"} · {row.pol}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink/80">
                      {formatDate(row.pre)} → {formatDate(row.post)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-ink">
                      {formatValue(row.changedKm2)} km²
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-muted">
                      {formatValue(row.seaKm2)} km²
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">
            {t("These rows come straight from the analysis files; the case panel shows the same figures with the images behind them.")}
          </p>
        </Section>

        <Section id="limits" eyebrow={t("05 · How sure are we")} title={t("What these numbers cannot tell you")}>
          <ul className="space-y-2.5">
            {LIMITS.map((row) => (
              <li key={row.title} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                <p className="font-medium text-ink">{t(row.title)}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/80">{t(row.body)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="data" eyebrow={t("06 · Where the data comes from")} title={t("Sources")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SOURCES.map((row) => (
              <li key={row.name} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                <p className="font-mono text-sm text-accent">{t(row.name)}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{t(row.body)}</p>
              </li>
            ))}
          </ul>
          <p>
            {t(
              "Next steps: compare each flagged area against independent records (fire detections, flood reports), build a per-pixel baseline from the whole time series so significance can be measured, and add live hazard feeds as a separate layer.",
            )}
          </p>
        </Section>
      </div>

      <footer className="mt-14 border-t border-line pt-6 text-sm text-muted">
        <p>
          {t(
            "Built for the NASA Space Apps Challenge 2026, challenge “Dancing with the SARs”. Radar data: NASA ASF DAAC (NISAR) and ESA Copernicus Sentinel-1 via the NASA OPERA project.",
          )}
        </p>
        <Link href="/" className="mt-3 inline-block text-accent underline-offset-4 hover:underline">
          {t("Back to the globe")}
        </Link>
      </footer>
    </main>
  );
}
