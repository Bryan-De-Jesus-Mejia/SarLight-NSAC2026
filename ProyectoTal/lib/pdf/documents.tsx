import { Document, Image, Line as SvgLine, Link, Page, Polyline, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ReactNode } from "react";
import { labels, type Chart, type ReportModel, type Row, type Table } from "@/lib/pdf/model";

/**
 * The PDF layouts. Built-in PDF fonts only (Helvetica, Times), so a few
 * symbols they lack are spelled out by clean() before printing.
 */

/** Images as data URLs, keyed by their app path; QR codes keyed by URL. */
export type Assets = Record<string, string | null>;

const INK = "#1a202c";
const MUTED = "#5f6b7a";
const LINE = "#d9dee5";
const ACCENT = "#b7791f";
const SOFT = "#f6f3ec";

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 38, fontFamily: "Helvetica", fontSize: 9.5, color: INK, lineHeight: 1.45 },
  brand: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: ACCENT, paddingBottom: 6, marginBottom: 14 },
  brandName: { fontFamily: "Times-BoldItalic", fontSize: 12 },
  brandKind: { fontSize: 8, color: ACCENT, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 3 },
  title: { fontFamily: "Times-Bold", fontSize: 24, lineHeight: 1.1 },
  sub: { fontSize: 9, color: MUTED, marginTop: 4 },
  h2: { fontSize: 8, color: ACCENT, textTransform: "uppercase", letterSpacing: 1.1, marginTop: 14, marginBottom: 5, fontFamily: "Helvetica-Bold" },
  p: { marginBottom: 4 },
  muted: { color: MUTED, fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 38, right: 38, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 5 },
  figRow: { flexDirection: "row", gap: 8 },
  figure: { flex: 1 },
  img: { width: "100%", objectFit: "contain", backgroundColor: "#0b0f17" },
  caption: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  key: { width: "48.5%", borderWidth: 0.5, borderColor: LINE, padding: 7, borderRadius: 3 },
  keyLabel: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  keyValue: { fontFamily: "Helvetica-Bold", fontSize: 12, marginTop: 2 },
  table: { borderTopWidth: 0.5, borderTopColor: LINE },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: MUTED },
  td: { fontSize: 8.5 },
  box: { backgroundColor: SOFT, borderLeftWidth: 2, borderLeftColor: ACCENT, padding: 9, marginTop: 6 },
  bullet: { flexDirection: "row", gap: 5, marginBottom: 3 },
});

const clean = (text: string) =>
  text
    .replace(/→/g, "-")
    .replace(/–/g, "-")
    .replace(/σ/g, " sigma")
    .replace(/Δ/g, "diff.")
    .replace(/−/g, "-")
    .replace(/≈/g, "~")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...");
const T = ({ children, style }: { children: string; style?: Style | Style[] }) => <Text style={style}>{clean(children)}</Text>;

function Brand({ kind, generated }: { kind: string; generated: string }) {
  return (
    <View style={s.brand} fixed>
      <View>
        <T style={s.brandName}>Dancing with the SARs</T>
        <T style={s.brandKind}>{kind}</T>
      </View>
      <T style={[s.muted, { marginTop: 4 }]}>{generated}</T>
    </View>
  );
}

function Footer({ m }: { m: Pick<ReportModel, "lang"> }) {
  const L = labels(m.lang);
  return (
    <View style={s.footer} fixed>
      <T>{`${L.footer} · NASA Space Apps Challenge 2026`}</T>
      <Text render={({ pageNumber, totalPages }) => `${L.page} ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View wrap={false}>
      <T style={s.h2}>{title}</T>
      {children}
    </View>
  );
}

function KeyFigures({ rows }: { rows: Row[] }) {
  return (
    <View style={s.keyGrid}>
      {rows.map((r) => (
        <View key={r.label} style={s.key}>
          <T style={s.keyLabel}>{r.label}</T>
          <T style={s.keyValue}>{r.value}</T>
        </View>
      ))}
    </View>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <View style={s.table}>
      {rows.map((r) => (
        <View key={r.label} style={s.tr}>
          <View style={{ width: "38%", paddingRight: 4 }}>
            <T style={[s.td, { color: MUTED }]}>{r.label}</T>
          </View>
          <View style={{ width: "62%" }}>
            <T style={s.td}>{r.value}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

function DataTable({ table }: { table: Table }) {
  const w = `${100 / table.head.length}%`;
  return (
    <Section title={table.title}>
      <View style={s.table}>
        <View style={s.tr}>
          {table.head.map((h) => (
            <View key={h} style={{ width: w, paddingRight: 4 }}>
              <T style={s.th}>{h}</T>
            </View>
          ))}
        </View>
        {table.rows.map((row, i) => (
          <View key={i} style={s.tr}>
            {row.map((cell, j) => (
              <View key={j} style={{ width: w, paddingRight: 4 }}>
                <T style={s.td}>{cell}</T>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Section>
  );
}

function Pictures({ items, assets, height = 150 }: { items: ReportModel["images"]; assets: Assets; height?: number }) {
  const shown = items.filter((f) => assets[f.src]);
  if (!shown.length) return null;
  return (
    <View style={s.figRow}>
      {shown.map((f) => (
        <View key={f.src} style={s.figure}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={assets[f.src] as string} style={[s.img, { height }]} />
          <T style={s.caption}>{f.caption}</T>
        </View>
      ))}
    </View>
  );
}

/** A small chart: lines or bars over dates, with a marker for the key date. */
function ChartView({ chart, lang }: { chart: Chart; lang: ReportModel["lang"] }) {
  const W = 500;
  const H = 120;
  const dates = [...new Set(chart.lines.flatMap((l) => l.points.map((p) => p.date)))].sort();
  const values = chart.lines.flatMap((l) => l.points.map((p) => p.value)).filter((v): v is number => v !== null && Number.isFinite(v));
  if (dates.length < 2 || !values.length) return null;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (chart.kind === "bar") lo = Math.min(0, lo);
  if (hi === lo) hi = lo + 1;
  const t0 = Date.parse(dates[0]);
  const t1 = Date.parse(dates[dates.length - 1]);
  const x = (d: string) => 8 + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - 16);
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  const barW = Math.max(1.5, Math.min(10, (W - 16) / dates.length / Math.max(1, chart.lines.length) - 1));
  const fmt = (v: number) => v.toLocaleString(lang === "es" ? "es-DO" : "en-US", { maximumFractionDigits: 1 });
  const day = (iso: string) => iso.slice(0, 10);

  return (
    <View wrap={false} style={{ marginTop: 6 }}>
      <T style={s.h2}>{`${chart.title} (${chart.unit})`}</T>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 34, justifyContent: "space-between", height: H }}>
          <T style={s.muted}>{fmt(hi)}</T>
          <T style={s.muted}>{fmt(lo)}</T>
        </View>
        <Svg width={W - 34} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={0} y={0} width={W} height={H} fill="#fbfbfc" />
          <SvgLine x1={0} y1={y(Math.max(lo, Math.min(hi, 0)))} x2={W} y2={y(Math.max(lo, Math.min(hi, 0)))} stroke={LINE} strokeWidth={0.8} />
          {chart.marker && Date.parse(chart.marker) >= t0 && Date.parse(chart.marker) <= t1 && (
            <SvgLine x1={x(chart.marker)} y1={0} x2={x(chart.marker)} y2={H} stroke={ACCENT} strokeWidth={1} strokeDasharray="3 3" />
          )}
          {chart.lines.map((line, li) =>
            chart.kind === "bar" ? (
              line.points
                .filter((p) => p.value !== null)
                .map((p) => {
                  const v = p.value as number;
                  const top = y(Math.max(v, 0));
                  const base = y(Math.min(v, 0));
                  return <Rect key={`${li}-${p.date}`} x={x(p.date) - (barW * chart.lines.length) / 2 + li * barW} y={top} width={barW} height={Math.max(0.6, base - top)} fill={line.color} />;
                })
            ) : (
              <Polyline
                key={li}
                points={line.points
                  .filter((p) => p.value !== null)
                  .map((p) => `${x(p.date)},${y(p.value as number)}`)
                  .join(" ")}
                fill="none"
                stroke={line.color}
                strokeWidth={1.6}
              />
            ),
          )}
        </Svg>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginLeft: 34 }}>
        <T style={s.muted}>{day(dates[0])}</T>
        <T style={s.muted}>{day(dates[dates.length - 1])}</T>
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 2, marginLeft: 34 }}>
        {chart.lines.map((l) => (
          <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <View style={{ width: 8, height: 3, backgroundColor: l.color }} />
            <T style={s.muted}>{l.label}</T>
          </View>
        ))}
        {chart.marker && <T style={[s.muted, { color: ACCENT }]}>{`- - ${day(chart.marker)}`}</T>}
      </View>
    </View>
  );
}

function Qr({ m, assets }: { m: ReportModel; assets: Assets }) {
  const L = labels(m.lang);
  const src = assets[`qr:${m.url}`];
  if (!src) return null;
  return (
    <View style={{ alignItems: "center", width: 96 }}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={src} style={{ width: 84, height: 84 }} />
      <T style={[s.muted, { textAlign: "center", marginTop: 2 }]}>{L.scan}</T>
    </View>
  );
}

/** A head count rounded to two significant figures, as the app says it. */
const roughly = (lang: ReportModel["lang"], n: number) => {
  if (n < 100) return lang === "es" ? "menos de 100" : "fewer than 100";
  const digits = Math.floor(Math.log10(n)) - 1;
  return `~${(Math.round(n / 10 ** digits) * 10 ** digits).toLocaleString(lang === "es" ? "es-DO" : "en-US")}`;
};

const generatedOn = (lang: ReportModel["lang"]) =>
  new Date().toLocaleDateString(lang === "es" ? "es-DO" : "en-US", { year: "numeric", month: "long", day: "numeric" });

/* ----------------------------- community sheet ----------------------------- */

export function CommunitySheet({ m, assets }: { m: ReportModel; assets: Assets }) {
  const L = labels(m.lang);
  const people = m.fact.exposed && m.fact.exposed > 0 ? m.fact.exposed : m.fact.people;
  const key: Row[] = [
    ...(people ? [{ label: m.fact.exposed ? L.t("Personas en la tierra que cambió", "People on the changed land") : L.t("Personas en la zona", "People in the area"), value: roughly(m.lang, people) }] : []),
    ...m.keyFigures.slice(0, people ? 1 : 2),
  ];
  return (
    <Document title={`${m.title} - ${L.communityTitle}`} author="Dancing with the SARs" language={m.lang}>
      <Page size="A4" style={s.page}>
        <Brand kind={L.communityTitle} generated={generatedOn(m.lang)} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T style={s.title}>{m.title}</T>
            <T style={s.sub}>{`${m.place} · ${m.kind} · ${m.period}`}</T>
          </View>
          <Qr m={m} assets={assets} />
        </View>

        <View style={{ marginTop: 10 }}>
          <Pictures items={m.images.slice(0, 1)} assets={assets} height={200} />
        </View>
        <View style={{ marginTop: 8 }}>
          <KeyFigures rows={key} />
        </View>

        <Section title={L.whatHappened}>
          <T style={s.p}>{m.what}</T>
        </Section>
        {m.cause && (
          <Section title={L.whyItHappened}>
            <T style={s.p}>{m.cause}</T>
          </Section>
        )}
        {m.people && (
          <Section title={L.whoLives}>
            <T style={s.p}>{m.people}</T>
            <T style={s.muted}>{L.t("Estimación del mapa de población GHSL (cuadros de 1 km), no un censo.", "Estimate from the GHSL population grid (1 km squares), not a census.")}</T>
          </Section>
        )}
        {m.field && (
          <Section title={L.forFarmers}>
            <T style={s.p}>{m.field}</T>
          </Section>
        )}
        {m.advice.length > 0 && (
          <View style={s.box} wrap={false}>
            <T style={[s.h2, { marginTop: 0 }]}>{L.whatToDo}</T>
            {m.advice.map((a) => (
              <View key={a} style={s.bullet}>
                <T>-</T>
                <T style={{ flex: 1 }}>{a}</T>
              </View>
            ))}
            <T style={{ fontFamily: "Helvetica-Bold", marginTop: 3 }}>{m.emergency}</T>
          </View>
        )}
        <T style={[s.muted, { marginTop: 10 }]}>{`${m.caveat} ${L.t("Fuentes: NISAR (NASA-ISRO), ERA5/Open-Meteo, USGS, GHSL (CE). Más detalles en el informe técnico.", "Sources: NISAR (NASA-ISRO), ERA5/Open-Meteo, USGS, GHSL (EC). More detail in the technical report.")}`}</T>
        <Footer m={m} />
      </Page>
    </Document>
  );
}

/* ----------------------------- technical report ---------------------------- */

function TechnicalPages({ m, assets }: { m: ReportModel; assets: Assets }) {
  const L = labels(m.lang);
  return (
    <Page size="A4" style={s.page}>
      <Brand kind={L.technicalTitle} generated={generatedOn(m.lang)} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T style={s.title}>{m.title}</T>
          <T style={s.sub}>{`${m.place} · ${m.kind} · ${m.period} · ${m.fact.lat}°, ${m.fact.lon}°`}</T>
          <T style={[s.p, { marginTop: 8 }]}>{m.summary}</T>
        </View>
        <Qr m={m} assets={assets} />
      </View>

      <Section title={L.keyFigures}>
        <KeyFigures rows={m.keyFigures} />
      </Section>
      <Section title={L.radarSaw}>
        <Pictures items={m.images} assets={assets} height={m.images.length > 2 ? 130 : 170} />
      </Section>
      <Section title={L.method}>
        <Rows rows={m.method} />
      </Section>
      {m.charts.map((c) => (
        <ChartView key={c.title} chart={c} lang={m.lang} />
      ))}
      {m.tables.map((t) => (
        <DataTable key={t.title} table={t} />
      ))}
      {(m.cause || m.weather) && (
        <Section title={L.whyItHappened}>
          {m.cause ? <T style={s.p}>{m.cause}</T> : <T style={s.muted}>{L.t("Sin registro externo que lo explique.", "No outside record explains it.")}</T>}
        </Section>
      )}
      {m.weather && <ChartView chart={m.weather} lang={m.lang} />}
      {m.quakes && <DataTable table={m.quakes} />}
      {(m.people || m.field) && (
        <Section title={L.whoLives}>
          {m.people && <T style={s.p}>{m.people}</T>}
          {m.field && <T style={s.p}>{m.field}</T>}
        </Section>
      )}
      <Section title={L.limits}>
        {m.limits.map((l) => (
          <View key={l} style={s.bullet}>
            <T>-</T>
            <T style={{ flex: 1 }}>{l}</T>
          </View>
        ))}
      </Section>
      <Section title={L.sources}>
        {m.sources.map((l) => (
          <T key={l} style={s.muted}>{`- ${l}`}</T>
        ))}
      </Section>
      <Section title={L.cite}>
        <T style={s.muted}>{m.citation}</T>
        <Link src={m.url} style={[s.muted, { color: ACCENT }]}>
          {m.url}
        </Link>
      </Section>
      <Footer m={m} />
    </Page>
  );
}

export function TechnicalReport({ m, assets }: { m: ReportModel; assets: Assets }) {
  const L = labels(m.lang);
  return (
    <Document title={`${m.title} - ${L.technicalTitle}`} author="Dancing with the SARs" language={m.lang}>
      <TechnicalPages m={m} assets={assets} />
    </Document>
  );
}

/* ---------------------------------- atlas ---------------------------------- */

export function Atlas({ models, assets, lang, origin }: { models: ReportModel[]; assets: Assets; lang: ReportModel["lang"]; origin: string }) {
  const L = labels(lang);
  const how = [
    L.t("NISAR envía sus propias ondas de radar (banda L, unos 24 cm) y escucha el eco: ve de noche y a través de las nubes, y repite cada lugar cada 12 días.", "NISAR sends its own radar waves (L-band, about 24 cm) and listens to the echo: it sees at night and through clouds, and repeats every place every 12 days."),
    L.t("Comparamos pasadas del mismo lugar: el agua en calma se ve oscura, las plantas brillan, y una caída del eco tras un incendio, una cosecha o el viento marca el cambio.", "We compare passes over the same place: calm water looks dark, plants are bright, and a drop in echo after a fire, a harvest or the wind marks the change."),
    L.t("Con interferometría medimos cuánto se movió el suelo tras un terremoto (una franja de color, unos 12 cm) y rastreamos grietas para medir la velocidad del hielo.", "With interferometry we measure how far the ground moved after an earthquake (one colour fringe, about 12 cm) and track cracks to measure ice speed."),
    L.t("Añadimos registros independientes: lluvia, calor y viento (ERA5), terremotos (USGS) y población (GHSL).", "We add independent records: rain, heat and wind (ERA5), earthquakes (USGS) and population (GHSL)."),
  ];
  return (
    <Document title={L.atlasTitle} author="Dancing with the SARs" language={lang}>
      <Page size="A4" style={s.page}>
        <Brand kind={L.atlasTitle} generated={generatedOn(lang)} />
        <T style={[s.title, { fontSize: 26 }]}>{L.atlasTitle}</T>
        <T style={[s.p, { fontSize: 10, marginTop: 6 }]}>{L.atlasIntro}</T>
        <T style={s.h2}>{L.howItWorks}</T>
        {how.map((h) => (
          <View key={h} style={[s.bullet, { marginBottom: 1 }]}>
            <T style={{ fontSize: 8.5 }}>-</T>
            <T style={{ flex: 1, fontSize: 8.5 }}>{h}</T>
          </View>
        ))}
        <T style={s.h2}>{L.contents}</T>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {[0, 1].map((col) => {
            const half = Math.ceil(models.length / 2);
            return (
              <View key={col} style={{ flex: 1 }}>
                {models.slice(col * half, (col + 1) * half).map((m, j) => (
                  <View key={m.fact.id} style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 1.5 }}>
                    <View style={{ flex: 1, paddingRight: 4 }}>
                      <T style={[s.td, { fontSize: 7.5 }]}>{m.title}</T>
                    </View>
                    <T style={[s.td, { fontSize: 7.5, color: MUTED }]}>{String(col * half + j + 2)}</T>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
        <Footer m={{ lang }} />
      </Page>
      {models.map((m) => (
        <Page key={m.fact.id} size="A4" style={s.page}>
          <Brand kind={`${m.kind} · ${m.place}`} generated={m.period} />
          <T style={s.title}>{m.title}</T>
          <T style={s.sub}>{`${m.place} · ${m.period}`}</T>
          <View style={{ marginTop: 10 }}>
            <Pictures items={m.images.slice(0, 1)} assets={assets} height={260} />
          </View>
          <View style={{ marginTop: 8 }}>
            <KeyFigures rows={m.keyFigures.slice(0, 4)} />
          </View>
          <T style={[s.p, { marginTop: 10 }]}>{m.summary}</T>
          <Link src={m.url} style={[s.muted, { color: ACCENT, marginTop: 6 }]}>
            {m.url}
          </Link>
          <Footer m={m} />
        </Page>
      ))}
      <Page size="A4" style={s.page}>
        <Brand kind={L.sources} generated={generatedOn(lang)} />
        <Section title={L.limits}>
          {(models[0]?.limits ?? []).map((l) => (
            <View key={l} style={s.bullet}>
              <T>-</T>
              <T style={{ flex: 1 }}>{l}</T>
            </View>
          ))}
        </Section>
        <Section title={L.sources}>
          {(models[0]?.sources ?? []).map((l) => (
            <T key={l} style={s.p}>{`- ${l}`}</T>
          ))}
        </Section>
        <Section title={L.cite}>
          <T style={s.p}>{`Dancing with the SARs (2026). ${L.atlasTitle}. NASA Space Apps Challenge 2026. ${origin}`}</T>
        </Section>
        <Footer m={{ lang }} />
      </Page>
    </Document>
  );
}
