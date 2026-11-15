import type { EventDetail } from "@/data/types";
import { getLang, t } from "@/i18n/core";
import { formatDate } from "@/lib/format";
import { zip, type ZipEntry } from "@/lib/zip";

/**
 * Everything a case can give back: its data as JSON, its figures as CSV tables,
 * the analysed area as GeoJSON, the images the app draws, and all of it in one
 * ZIP with a README. Built in the browser, on demand, from what the app already holds.
 */

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;
export interface Table {
  name: string;
  rows: Row[];
}

const isCell = (value: unknown): value is Cell =>
  value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** The plain values of an object (no nested objects or arrays, no image paths). */
function flat(source: Record<string, unknown>, skip: readonly string[] = ["frame", "src"]): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(source)) {
    if (skip.includes(key) || !isCell(value)) continue;
    row[key] = value;
  }
  return row;
}

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "table";

/** The summary and the series of passes of every analysis of the case. */
export function tablesOf(detail: EventDetail): Table[] {
  const tables: Table[] = [];

  if (detail.analyses.length > 0) {
    tables.push({
      name: "summary",
      rows: detail.analyses.map((a) => ({
        analysis: a.key,
        sensor: a.sensor,
        polarisation: a.pol,
        band: a.band,
        before: a.pre.date,
        after: a.post.date,
        threshold_db: a.method.thresholdDb,
        valid_land_km2: a.land.validAreaKm2,
        changed_land_km2: a.land.changedAreaKm2,
        changed_land_pct: a.land.changedPct,
        weaker_land_km2: a.land.decreaseAreaKm2,
        stronger_land_km2: a.land.increaseAreaKm2,
      })),
    });
    for (const a of detail.analyses) {
      tables.push({ name: `series-${slug(a.key)}`, rows: a.series.map((point) => ({ analysis: a.key, ...flat({ ...point }) })) });
    }
  }

  const extra = detail.extra as unknown as Record<string, unknown> | undefined;
  if (extra) {
    for (const group of ["orbits", "groups"] as const) {
      const list = extra[group];
      if (!Array.isArray(list)) continue;
      for (const item of list as Array<Record<string, unknown>>) {
        const series = item.series;
        if (!Array.isArray(series)) continue;
        const key = typeof item.key === "string" ? item.key : typeof item.label === "string" ? item.label : group;
        tables.push({
          name: `series-${slug(key)}`,
          rows: (series as Array<Record<string, unknown>>).map((point) => ({ group: key, ...flat(point) })),
        });
      }
    }
    if (Array.isArray(extra.pairs)) {
      tables.push({ name: "pairs", rows: (extra.pairs as Array<Record<string, unknown>>).map((pair) => flat(pair)) });
    }
  }
  return tables;
}

const csvCell = (value: Cell | undefined): string => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function csvOf(rows: Row[]): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  return `${lines.join("\n")}\n`;
}

/** The series of every analysis in one table (the summary stays out). */
export function seriesCsv(detail: EventDetail): string {
  const rows = tablesOf(detail)
    .filter((table) => table.name !== "summary")
    .flatMap((table) => table.rows.map((row) => ({ table: table.name, ...row })));
  return csvOf(rows);
}

export function hasSeries(detail: EventDetail): boolean {
  return tablesOf(detail).some((table) => table.name !== "summary" && table.rows.length > 0);
}

export function geojsonOf(detail: EventDetail): string {
  const ring = (polygon: Array<[number, number]>): Array<[number, number]> => [...polygon, polygon[0]];
  const base = { id: detail.id, name: detail.name, type: detail.type, note: "Radar change analysis, not verified on the ground." };
  const features = [
    {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring(detail.footprint)] },
      properties: { ...base, area: "case", changedOnLandKm2: detail.changedAreaKm2, changedPct: detail.changedPct },
    },
    ...detail.analyses.map((a) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring(a.footprint.polygon)] },
      properties: {
        ...base,
        area: "analysis",
        analysis: a.key,
        sensor: a.label,
        polarisation: a.pol,
        before: a.pre.date,
        after: a.post.date,
        thresholdDb: a.method.thresholdDb,
        changedOnLandKm2: a.land.changedAreaKm2,
        weakerKm2: a.land.decreaseAreaKm2,
        strongerKm2: a.land.increaseAreaKm2,
      },
    })),
  ];
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}

/** Every image path the case points to (before, after, maps, frames…). */
export function imagePaths(detail: EventDetail): string[] {
  const found = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string") {
      if (/^\/analysis(?:-extra)?\/.+\.(?:webp|png|jpe?g)$/i.test(value)) found.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(detail);
  return [...found];
}

function readme(detail: EventDetail, missing: number): string {
  const link = `${window.location.origin}/?case=${detail.id}&lang=${getLang()}`;
  const lines = [
    t("SarLight data package: {name}", { name: t(detail.name) }),
    t("Place: {place}", { place: `${t(detail.region)}, ${t(detail.country)}` }),
    t("Passes analysed: {from} to {to}", { from: formatDate(detail.startDate), to: formatDate(detail.endDate) }),
    "",
    t("These figures come from real radar scenes (NASA–ISRO NISAR and ESA Sentinel-1, through NASA ASF and OPERA) compared pass against pass by our own pipeline."),
    t("A flagged change is a lead, not a verdict: nothing has been verified on the ground."),
    "",
    t("Files"),
    t("case.json: everything the app knows about this case."),
    t("area.geojson: the area that was analysed."),
    t("tables/: the figures of each analysis and its series of passes, one row per pass or pair."),
    t("images/: the radar images the app draws (before, after, difference and change maps)."),
    ...(missing > 0 ? [t("{n, plural, one {# image could not be downloaded and is missing.} other {# images could not be downloaded and are missing.}}", { n: missing })] : []),
    "",
    t("How to cite: SarLight, Team ONAT. NASA Space Apps Challenge 2026. {url}", { url: link }),
    t("The radar scenes come from NASA–ISRO NISAR and ESA Sentinel-1, which are freely available: credit them when you reuse the figures."),
  ];
  return `${lines.join("\n")}\n`;
}

export function download(name: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export const json = (detail: EventDetail): string => JSON.stringify(detail, null, 2);

/** Fetches the images a few at a time; the ones that fail are counted, not fatal. */
async function fetchImages(paths: string[]): Promise<{ entries: ZipEntry[]; missing: number }> {
  const entries: ZipEntry[] = [];
  let missing = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < paths.length) {
      const path = paths[next];
      next += 1;
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(String(response.status));
        const data = new Uint8Array(await response.arrayBuffer());
        entries.push({ name: `images/${path.replace(/^\/analysis(?:-extra)?\//, "")}`, data });
      } catch {
        missing += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { entries, missing };
}

/** The whole case in one ZIP: data, tables, area, images and a README. */
export async function buildPackage(detail: EventDetail): Promise<Blob> {
  const text = new TextEncoder();
  const { entries: images, missing } = await fetchImages(imagePaths(detail));
  const files: ZipEntry[] = [
    { name: "README.txt", data: text.encode(readme(detail, missing)) },
    { name: "case.json", data: text.encode(json(detail)) },
    { name: "area.geojson", data: text.encode(geojsonOf(detail)) },
    ...tablesOf(detail)
      .filter((table) => table.rows.length > 0)
      .map((table) => ({ name: `tables/${table.name}.csv`, data: text.encode(csvOf(table.rows)) })),
    ...images,
  ];
  return zip(files);
}
