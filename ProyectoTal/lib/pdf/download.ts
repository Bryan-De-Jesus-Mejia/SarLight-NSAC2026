import type { EventDetail } from "@/data/types";
import type { Lang } from "@/lib/assistant/types";
import type { ReportModel } from "@/lib/pdf/model";

/**
 * Downloads for a case: PDFs built in the browser (nothing leaves the
 * visitor's machine, no server cost) and the raw data. The PDF library is
 * loaded only when someone asks for a PDF.
 */

export type PdfKind = "community" | "technical";

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** App image (webp) to a JPEG data URL the PDF can embed; null if it cannot be read. */
async function toJpeg(src: string, maxW: number): Promise<string | null> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, maxW / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0b0f17";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

async function assetsFor(models: ReportModel[], maxImages: number, maxW: number, qr: boolean): Promise<Record<string, string | null>> {
  const assets: Record<string, string | null> = {};
  const jobs: Array<Promise<void>> = [];
  for (const m of models) {
    for (const f of m.images.slice(0, maxImages)) {
      if (!(f.src in assets)) {
        assets[f.src] = null;
        jobs.push(toJpeg(f.src, maxW).then((v) => void (assets[f.src] = v)));
      }
    }
  }
  if (qr) {
    const QRCode = (await import("qrcode")).default;
    for (const m of models) assets[`qr:${m.url}`] = await QRCode.toDataURL(m.url, { margin: 1, width: 240, color: { dark: "#1a202c", light: "#ffffff" } });
  }
  await Promise.all(jobs);
  return assets;
}

const slug = (lang: Lang, kind: string) => `${kind}-${lang}`;

export async function downloadCasePdf(detail: EventDetail, kind: PdfKind, lang: Lang): Promise<void> {
  const [{ pdf }, docs, { reportModel }] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/documents"), import("@/lib/pdf/model")]);
  const model = reportModel(detail, lang, window.location.origin);
  const assets = await assetsFor([model], kind === "community" ? 1 : 3, kind === "community" ? 1200 : 900, true);
  const element = kind === "community" ? docs.CommunitySheet({ m: model, assets }) : docs.TechnicalReport({ m: model, assets });
  const blob = await pdf(element).toBlob();
  save(blob, `${detail.id}-${slug(lang, kind === "community" ? (lang === "es" ? "ficha" : "sheet") : (lang === "es" ? "informe" : "report"))}.pdf`);
}

/** All cases, one page each. `onProgress` gets (done, total) while case data loads. */
export async function downloadAtlas(lang: Lang, onProgress?: (done: number, total: number) => void): Promise<void> {
  const [{ pdf }, docs, { reportModel }] = await Promise.all([import("@react-pdf/renderer"), import("@/lib/pdf/documents"), import("@/lib/pdf/model")]);
  const list = (await (await fetch("/api/events")).json()) as { events: Array<{ id: string; startDate: string }> };
  const ids = [...list.events].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((e) => e.id);
  const details: EventDetail[] = [];
  let done = 0;
  await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`/api/events/${encodeURIComponent(id)}`);
      if (res.ok) details.push((await res.json()) as EventDetail);
      onProgress?.(++done, ids.length);
    }),
  );
  // Dominican Republic first, then the world, each by date.
  details.sort((a, b) => Number(b.country === "Dominican Republic") - Number(a.country === "Dominican Republic") || a.startDate.localeCompare(b.startDate));
  const origin = window.location.origin;
  const models = details.map((d) => reportModel(d, lang, origin));
  const assets = await assetsFor(models, 1, 900, false);
  const blob = await pdf(docs.Atlas({ models, assets, lang, origin })).toBlob();
  save(blob, `dancing-with-the-sars-atlas-${lang}.pdf`);
}

/* ---------------------------------- data ---------------------------------- */

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const text = String(v);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const toCsv = (rows: Array<Record<string, unknown>>) => {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  return [head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n");
};

/** Every pass-by-pass series of the case, one row per date and orbit. */
export function seriesRows(d: EventDetail): Array<Record<string, unknown>> {
  const x = d.extra;
  if (!x) return d.analyses.flatMap((a) => a.series.map((p) => ({ analysis: a.key, date: p.date, valid_pct: p.validPct, usable: p.usable, changed_land_db: p.insideDb, other_land_db: p.outsideDb })));
  if (x.kind === "agriculture") return x.orbits.flatMap((o) => o.series.map((p) => ({ orbit: o.label, ...p })));
  if (x.kind === "change") return x.orbits.flatMap((o) => o.series.map((p) => ({ orbit: o.label, ...p })));
  if (x.kind === "glacier") return x.groups.flatMap((g) => g.series.map((p) => ({ orbit: g.label, ...p })));
  return x.pairs.map((p) => ({ pair: p.label, ref: p.ref, sec: p.sec, days: p.days, toward_max_cm: p.towardMaxCm, away_max_cm: p.awayMaxCm, area_5cm_km2: p.area5Km2, reliable_pct: p.reliablePct, coherence: p.coherence }));
}

export function downloadJson(d: EventDetail): void {
  save(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), `${d.id}.json`);
}

export function downloadCsv(d: EventDetail): void {
  save(new Blob([toCsv(seriesRows(d))], { type: "text/csv" }), `${d.id}-series.csv`);
}

export function downloadGeoJson(d: EventDetail): void {
  const ring = d.footprint?.length ? [...d.footprint, d.footprint[0]] : null;
  const feature = {
    type: "Feature",
    geometry: ring ? { type: "Polygon", coordinates: [ring] } : { type: "Point", coordinates: [d.lon, d.lat] },
    properties: {
      id: d.id,
      name: d.name,
      type: d.type,
      region: d.region,
      country: d.country,
      start: d.startDate,
      end: d.endDate,
      changedAreaKm2: d.changedAreaKm2,
      peopleInArea: d.people?.areaPeople ?? null,
      peopleOnChangedLand: d.people?.exposedPeople ?? null,
      note: "Radar analysis area. Not verified on the ground.",
    },
  };
  save(new Blob([JSON.stringify(feature, null, 2)], { type: "application/geo+json" }), `${d.id}.geojson`);
}
