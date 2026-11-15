"use client";

import { useState } from "react";
import type { Lang } from "@/lib/assistant/types";
import { downloadAtlas } from "@/lib/pdf/download";

/** The whole collection as one PDF: how it works, one page per case, sources and licences. */
export function AtlasDownload() {
  const [busy, setBusy] = useState<Lang | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [failed, setFailed] = useState(false);

  const make = async (lang: Lang) => {
    setBusy(lang);
    setFailed(false);
    setProgress(null);
    try {
      await downloadAtlas(lang, (done, total) => setProgress([done, total]));
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white/[0.03] p-5">
      <p className="font-display text-xl text-ink">Atlas of surface change · Atlas de cambios en la superficie</p>
      <p className="mt-1.5 text-sm text-muted">
        Every case on one page each, with how the radar works, the limits and every source with its licence. About 35 pages,
        built in your browser. Each case also has its own community sheet and technical report in its panel, under Resources.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void make("es")} className="ge-pill disabled:opacity-60">
          Descargar en español (PDF)
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void make("en")} className="ge-pill disabled:opacity-60">
          Download in English (PDF)
        </button>
        {busy && (
          <span role="status" className="font-mono text-xs text-muted">
            {progress && progress[0] < progress[1] ? `Reading cases ${progress[0]}/${progress[1]}…` : "Building the PDF…"}
          </span>
        )}
      </div>
      {failed && <p className="mt-2 text-xs text-[#f87171]">The atlas could not be made. Please try again.</p>}
    </div>
  );
}
