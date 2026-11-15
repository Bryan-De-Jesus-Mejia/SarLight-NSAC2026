"use client";

import { useState } from "react";
import type { EventDetail } from "@/data/types";
import type { Lang } from "@/lib/assistant/types";
import { downloadCasePdf, downloadCsv, downloadGeoJson, downloadJson, type PdfKind } from "@/lib/pdf/download";

/**
 * "Resources": take the case away. A one-page sheet for neighbours, councils
 * and schools; a technical report for scientists and judges; and the raw data.
 * PDFs are built in the browser, in Spanish or English.
 */

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const DOC = "M7 3.5h7l4 4v13H7zM14 3.5v4h4M9.5 12.5h6M9.5 15.5h6M9.5 18h4";
const DOWN = "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14";

export function Resources({ detail }: { detail: EventDetail }) {
  const [lang, setLang] = useState<Lang>(() =>
    detail.country === "Dominican Republic" || (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es")) ? "es" : "en",
  );
  const [busy, setBusy] = useState<PdfKind | null>(null);
  const [failed, setFailed] = useState(false);
  const es = lang === "es";

  const make = async (kind: PdfKind) => {
    setBusy(kind);
    setFailed(false);
    try {
      await downloadCasePdf(detail, kind, lang);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const pdfs: Array<{ kind: PdfKind; title: string; note: string }> = [
    {
      kind: "community",
      title: es ? "Ficha comunitaria" : "Community sheet",
      note: es ? "1–2 páginas para juntas de vecinos, escuelas y ayuntamientos: qué pasó, a quién afecta y qué hacer." : "1–2 pages for neighbours, schools and councils: what happened, who it affects and what to do.",
    },
    {
      kind: "technical",
      title: es ? "Informe técnico" : "Technical report",
      note: es ? "Método, imágenes, gráficos, clima, sismos, límites y fuentes con sus licencias." : "Method, images, charts, weather, earthquakes, limits and sources with their licences.",
    },
  ];

  return (
    <section id="case-resources" aria-labelledby="resources-title" className="rounded-2xl border border-line bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p id="resources-title" className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {es ? "Recursos" : "Resources"}
        </p>
        <div className="ge-segments !w-auto" role="group" aria-label={es ? "Idioma del PDF" : "PDF language"}>
          {(["es", "en"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className="ge-segment !px-2.5 uppercase">
              {l}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {pdfs.map((p) => (
          <li key={p.kind}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void make(p.kind)}
              className="flex w-full items-start gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] disabled:opacity-60"
            >
              <span className="mt-0.5 text-accent">
                <Icon d={DOC} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {p.title} <span className="font-mono text-[10px] text-muted">PDF</span>
                </span>
                <span className="block text-xs leading-snug text-muted">{busy === p.kind ? (es ? "Preparando el PDF…" : "Preparing the PDF…") : p.note}</span>
              </span>
              <span className="mt-0.5 text-muted">
                <Icon d={DOWN} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {failed && <p className="mt-2 text-xs text-[#f87171]">{es ? "No se pudo crear el PDF. Inténtalo de nuevo." : "The PDF could not be made. Please try again."}</p>}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{es ? "Datos" : "Data"}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadCsv(detail)} className="ge-pill">
          {es ? "Serie temporal (CSV)" : "Time series (CSV)"}
        </button>
        <button type="button" onClick={() => downloadGeoJson(detail)} className="ge-pill">
          {es ? "Área (GeoJSON)" : "Area (GeoJSON)"}
        </button>
        <button type="button" onClick={() => downloadJson(detail)} className="ge-pill">
          {es ? "Todo (JSON)" : "Everything (JSON)"}
        </button>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-muted">
        {es
          ? "Análisis de radar real, no verificado en el terreno. Úsalo citando la fuente; las licencias van en el informe."
          : "Real radar analysis, not verified on the ground. Cite the source when you use it; licences are in the report."}
      </p>
    </section>
  );
}
