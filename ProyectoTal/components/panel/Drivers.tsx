"use client";

import type { CaseContext, ChangeType, EventDetail } from "@/data/types";
import { formatDate } from "@/lib/format";

/**
 * "Why it happened": the physical chain from a cause to what people live
 * through, with the step the radar measures in the middle. Where the world
 * left a record (rain, heat, wind from the ERA5 reanalysis; earthquakes from
 * USGS), the cause comes with that evidence. Nothing here is a proof of cause
 * for each pixel: it is the most likely story, and the panel says so.
 */

interface Link {
  icon: string;
  title: string;
  body: string;
  /** A measured fact from outside the radar. */
  evidence?: string;
}

interface Evidence {
  keyDate: string | null;
  rainWeek: number | null;
  rainRatio: number | null;
  hottest: number | null;
  hotDays: number;
  gust: number | null;
  quake: { mag: number; place: string; date: string; depthKm: number; km: number } | null;
}

const ICON = {
  rain: "M7 15.5h9.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6 1.2A3 3 0 0 0 7 15.5zM9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5",
  sun: "M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  wind: "M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h7",
  fault: "M3 7l5 3 4-2 4 4 5-2M3 15l5 3 4-2 4 4 5-2M12 3v18",
  hand: "M8 11V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L4 13.5a1.5 1.5 0 0 1 2.5-1.6L8 14",
  ice: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5",
  water: "M3 9c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 14c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 19c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0",
  leaf: "M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19l7-7",
  slope: "M3 19.5 10 7l4 7 2.5-3.5 4.5 9zM15.5 3.5h.01M19 5.5h.01",
  radar: "M4 12a8 8 0 0 1 16 0M7 12a5 5 0 0 1 10 0M10 12a2 2 0 0 1 4 0M12 12v8",
  people: "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M16.5 11a2.5 2.5 0 1 0 0-5M18 14c2 .5 3.5 2.6 3.5 5",
  home: "M3.5 11.5 12 4l8.5 7.5M6 10v9.5h12V10M10 19.5v-5h4v5",
};

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

function keyDateOf(detail: EventDetail): string | null {
  const x = detail.extra;
  if (!x) return detail.analyses[0]?.post.date.slice(0, 10) ?? null;
  if (x.kind === "change" || x.kind === "displacement") return x.eventDate;
  if (x.kind === "agriculture") {
    const o = x.orbits[0];
    return o.mode === "flood" ? o.peakDate : o.peakIntervalEnd;
  }
  return null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function evidenceOf(detail: EventDetail, ctx: CaseContext | undefined): Evidence {
  const keyDate = keyDateOf(detail);
  const e: Evidence = { keyDate, rainWeek: null, rainRatio: null, hottest: null, hotDays: 0, gust: null, quake: null };
  const w = ctx?.weather;
  if (w && w.dates.length) {
    const t = keyDate ? ms(keyDate) : ms(w.dates[w.dates.length - 1]);
    const inWeek = (d: string) => ms(d) <= t && ms(d) > t - 7 * DAY;
    const rain = w.rainMm.map((v) => v ?? 0);
    e.rainWeek = w.dates.reduce((sum, d, i) => sum + (inWeek(d) ? rain[i] : 0), 0);
    const meanWeek = (rain.reduce((a, b) => a + b, 0) / rain.length) * 7;
    e.rainRatio = meanWeek > 0.5 ? e.rainWeek / meanWeek : null;
    const temps = w.tmaxC.filter((v): v is number => v !== null);
    e.hottest = temps.length ? Math.max(...temps) : null;
    e.hotDays = temps.filter((v) => v >= 35).length;
    const near = w.dates.map((d, i) => (Math.abs(ms(d) - t) <= 3 * DAY ? w.gustKmh[i] : null)).filter((v): v is number => v !== null);
    e.gust = near.length ? Math.max(...near) : null;
  }
  const q = ctx?.quakes?.[0];
  if (q) {
    e.quake = {
      mag: q.mag,
      place: q.place,
      date: q.time.slice(0, 10),
      depthKm: Math.round(q.depthKm),
      km: Math.round(haversineKm(detail.lat, detail.lon, q.lat, q.lon)),
    };
  }
  return e;
}

const mm = (v: number) => `${Math.round(v)} mm`;
const rainLine = (e: Evidence) =>
  e.rainWeek === null
    ? undefined
    : `${mm(e.rainWeek)} of rain in the week before ${e.keyDate ? formatDate(e.keyDate) : "the last pass"}` +
      (e.rainRatio !== null && e.rainRatio >= 1.3 ? `, ${e.rainRatio.toFixed(1)}× a usual week of this record` : e.rainRatio !== null && e.rainRatio < 0.7 ? ", less than a usual week" : "");

function chainFor(type: ChangeType, detail: EventDetail, e: Evidence): Link[] {
  const x = detail.extra;
  const activity = x?.kind === "agriculture" ? x.activity : null;
  const radar = (body: string): Link => ({ icon: ICON.radar, title: "What the radar measured", body });

  if (type === "flood" || type === "wetland") {
    return [
      { icon: ICON.rain, title: "Heavy rain", body: "Rain falls faster than the soil and drains can take it.", evidence: rainLine(e) },
      { icon: ICON.water, title: "Water spreads over land", body: "Rivers and gullies overflow; low streets and fields fill." },
      radar("Calm water is a mirror: the pulse bounces away, so flooded open ground turns dark. Flooded trees and crops can turn brighter instead, as the pulse bounces off the water and then the stems."),
      { icon: ICON.home, title: "What people live through", body: "Homes to leave, roads cut, a harvest that rots in the field." },
    ];
  }
  if (type === "wildfire") {
    return [
      {
        icon: ICON.sun,
        title: "Heat and dry fuel",
        body: "Hot, dry weeks turn leaves and grass into fuel.",
        evidence: e.hottest !== null ? `Hottest day ${Math.round(e.hottest)} °C; ${e.rainWeek !== null ? `${mm(e.rainWeek)} of rain in the week before` : ""}` : undefined,
      },
      { icon: ICON.leaf, title: "The canopy burns", body: "Leaves and branches go; bare trunks and soil remain." },
      radar("Leaves scatter the pulse in all directions. Without them the cross-polarised echo (HV) drops."),
      { icon: ICON.people, title: "What people live through", body: "Smoke, lost forest that held soil and water, risk to homes and farms nearby." },
    ];
  }
  if (type === "storm") {
    return [
      {
        icon: ICON.wind,
        title: "Strong wind",
        body: "A storm sweeps across the valley.",
        evidence: e.gust !== null ? `Strongest gust ${Math.round(e.gust)} km/h around ${e.keyDate ? formatDate(e.keyDate) : "the event"}` : undefined,
      },
      { icon: ICON.leaf, title: "Crops and trees go down", body: "Banana plants, maize and branches are flattened or snapped." },
      radar("Standing plants send back a strong echo. Flattened ones lose that structure, so the echo weakens where the wind hit."),
      { icon: ICON.people, title: "What people live through", body: "A season of crops lost, fallen power lines, blocked roads." },
    ];
  }
  if (type === "drought") {
    return [
      {
        icon: ICON.sun,
        title: "Heat and little rain",
        body: "Day after day of strong sun dries the land.",
        evidence:
          e.hottest !== null
            ? `${e.hotDays} days at 35 °C or more, hottest ${Math.round(e.hottest)} °C${e.rainWeek !== null ? `; ${mm(e.rainWeek)} of rain in the week before ${e.keyDate ? formatDate(e.keyDate) : ""}` : ""}`
            : undefined,
      },
      { icon: ICON.leaf, title: "Soil and plants dry out", body: "Pasture yellows, crops wilt, soil loses its water." },
      radar("Water makes things bright to radar (a high dielectric constant). Dry soil and dry plants send back a weaker echo. The radar does not measure heat: it sees what heat does."),
      { icon: ICON.people, title: "What people live through", body: "Smaller harvests, thirsty animals, less water for homes." },
    ];
  }
  if (type === "earthquake") {
    return [
      {
        icon: ICON.fault,
        title: "A fault slips",
        body: "Stress built up over years is released in seconds.",
        evidence: e.quake ? `USGS: magnitude ${e.quake.mag} on ${formatDate(e.quake.date)}, ${e.quake.depthKm} km deep, ${e.quake.km} km from the centre of this area` : undefined,
      },
      { icon: ICON.slope, title: "The ground moves", body: "Whole regions rise, sink or shift by centimetres." },
      radar("The radar wave is about 24 cm long. Comparing its phase before and after, each colour cycle is about 12 cm of motion toward or away from the satellite."),
      { icon: ICON.home, title: "What people live through", body: "Cracked buildings and roads; the map shows engineers and rescuers where the ground moved most." },
    ];
  }
  if (type === "landslide") {
    return [
      {
        icon: ICON.rain,
        title: "A soaked slope",
        body: "Rain fills the soil until the slope can no longer hold.",
        evidence: e.quake ? `USGS: magnitude ${e.quake.mag} earthquake nearby on ${formatDate(e.quake.date)}` : rainLine(e),
      },
      { icon: ICON.slope, title: "The slope gives way", body: "Soil and rock slide down, burying what lies below." },
      radar("Fresh scars and debris change how rough the surface is, so the echo shifts where the ground moved."),
      { icon: ICON.home, title: "What people live through", body: "Roads cut off, homes on the slope at risk." },
    ];
  }
  if (type === "glacier") {
    return [
      { icon: ICON.sun, title: "Warmer ocean and air", body: "Warm water reaches the front of the ice and melts it from below." },
      { icon: ICON.ice, title: "The ice speeds up", body: "With less to hold it back, the glacier flows and breaks off faster." },
      radar("By tracking the same patch of ice in two passes, the radar measures how many metres it moved per day, even in polar night."),
      { icon: ICON.water, title: "What it means for everyone", body: "Ice that reaches the sea raises sea level, for every coast, the Caribbean included." },
    ];
  }
  // agriculture
  const human =
    activity === "burning"
      ? { title: "Farmers burn the stubble", body: "After harvest, leftover straw is burned to clear the field fast." }
      : activity === "clearing"
        ? { title: "Forest is cleared", body: "Trees are cut and burned to make room for pasture or crops." }
        : activity === "flood"
          ? { title: "Paddies are flooded", body: "Rice is grown in standing water: farmers flood the fields on purpose." }
          : { title: "Harvest time", body: "The crop calendar decides when fields are cut." };
  return [
    { icon: ICON.hand, title: human.title, body: human.body, evidence: rainLine(e) },
    { icon: ICON.leaf, title: "The fields change", body: activity === "flood" ? "Green fields turn to sheets of water, then back to green." : "Tall plants are replaced by bare soil or stubble." },
    radar(activity === "flood" ? "Open water turns dark; young rice standing in water can turn bright." : "Tall crops scatter the pulse; bare fields send back much less, so the echo drops."),
    { icon: ICON.people, title: "What people live through", body: activity === "clearing" ? "Forest lost for good, with its water, wildlife and carbon." : activity === "burning" ? "Smoke that chokes cities hundreds of kilometres away." : "Food on the table, and income for the families who grow it." },
  ];
}

function MiniWeather({ ctx, keyDate, kind }: { ctx: CaseContext; keyDate: string | null; kind: "rain" | "heat" | "wind" }) {
  const w = ctx.weather;
  if (!w || w.dates.length < 5) return null;
  const values = (kind === "rain" ? w.rainMm : kind === "heat" ? w.tmaxC : w.gustKmh).map((v) => v ?? 0);
  const max = Math.max(...values, kind === "rain" ? 5 : 1);
  const min = kind === "rain" ? 0 : Math.min(...values) - 2;
  const W = 100;
  const H = 30;
  const bw = W / values.length;
  const keyIndex = keyDate ? w.dates.findIndex((d) => d >= keyDate) : -1;
  const color = kind === "rain" ? "#60a5fa" : kind === "heat" ? "#fb923c" : "#a78bfa";
  return (
    <figure className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label={`Daily ${kind === "rain" ? "rain" : kind === "heat" ? "maximum temperature" : "maximum wind gust"} from ${formatDate(w.dates[0])} to ${formatDate(w.dates[w.dates.length - 1])}`}>
        {values.map((v, i) => {
          const h = ((v - min) / (max - min || 1)) * (H - 2);
          return <rect key={w.dates[i]} x={i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={Math.max(h, 0.3)} fill={color} opacity={i === keyIndex ? 1 : 0.55} />;
        })}
        {keyIndex >= 0 && <line x1={keyIndex * bw + bw / 2} x2={keyIndex * bw + bw / 2} y1={0} y2={H} stroke="#f2b866" strokeWidth={0.6} strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      <figcaption className="flex justify-between font-mono text-[10px] text-muted">
        <span>{formatDate(w.dates[0])}</span>
        <span className="text-accent">{keyDate ? `↑ ${formatDate(keyDate)}` : ""}</span>
        <span>{formatDate(w.dates[w.dates.length - 1])}</span>
      </figcaption>
    </figure>
  );
}

export function Drivers({ detail, compact = false }: { detail: EventDetail; compact?: boolean }) {
  const ctx = detail.context;
  const e = evidenceOf(detail, ctx);
  const chain = chainFor(detail.type, detail, e);
  const weatherKind =
    detail.type === "storm" ? "wind" : detail.type === "drought" || detail.type === "wildfire" ? "heat" : detail.type === "glacier" || detail.type === "earthquake" ? null : "rain";

  return (
    <section aria-labelledby={compact ? undefined : "why-title"}>
      {!compact && (
        <h3 id="why-title" className="font-display text-xl leading-tight text-ink">
          Why it happened
        </h3>
      )}
      <ol className={`relative ${compact ? "mt-1" : "mt-3"} space-y-0`}>
        {chain.map((link, i) => (
          <li key={link.title} className="relative flex gap-3 pb-4 last:pb-0">
            {i < chain.length - 1 && <span className="absolute left-[17px] top-9 bottom-0 w-px bg-gradient-to-b from-white/30 to-white/5" aria-hidden="true" />}
            <span
              className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                link.title === "What the radar measured" ? "border-accent/70 bg-accent/15 text-accent" : "border-line bg-[#0b101b] text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={link.icon} />
              </svg>
            </span>
            <span className="min-w-0 pt-1">
              <span className="block text-[15px] font-medium leading-tight text-ink">{link.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink/80">{link.body}</span>
              {link.evidence && (
                <span className="mt-1.5 inline-flex items-start gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2 py-1 text-xs leading-snug text-ink">
                  <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  {link.evidence}
                </span>
              )}
              {i === 0 && ctx && weatherKind && <MiniWeather ctx={ctx} keyDate={e.keyDate} kind={weatherKind} />}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] leading-snug text-muted">
        Weather: ERA5 reanalysis via Open-Meteo, at the centre of the area (a grid of about 25 km). Earthquakes: USGS catalogue.
        These records make the cause likely; they do not prove it for each pixel.
      </p>
    </section>
  );
}
