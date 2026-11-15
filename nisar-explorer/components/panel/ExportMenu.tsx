"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { EventDetail } from "@/data/types";
import { usePopover } from "@/hooks/usePopover";
import { useT } from "@/i18n/core";
import { buildPackage, download, geojsonOf, hasSeries, json, seriesCsv } from "@/lib/exportCase";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Download the open case: its data, its figures as a table, its area, or everything in one package. */
export function ExportMenu({ detail }: { detail: EventDetail | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = usePopover(close, open);

  const run = (action: () => void) => {
    setFailed(false);
    action();
    setOpen(false);
  };

  const pack = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      download(`sarlight-${detail.id}.zip`, await buildPackage(detail), "application/zip");
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const items: Array<{ label: string; hint: string; icon: ReactNode; disabled?: boolean; onClick: () => void }> = detail
    ? [
        {
          label: t("Full package (.zip)"),
          hint: t("Data, tables, area, images and a README"),
          icon: <Icon><path d="M4 8.5 12 4l8 4.500v7L12 20l-8-4.500zM4 8.500l8 4.500 8-4.500M12 13v7" /></Icon>,
          onClick: () => void pack(),
        },
        {
          label: t("Case data (JSON)"),
          hint: t("Everything the app knows about this case"),
          icon: <Icon><path d="M9 4C6.500 4 6 5 6 6.500v2C6 10 5 11 4 12c1 1 2 2 2 3.500v2C6 19 6.500 20 9 20M15 4c2.500 0 3 1 3 2.500v2c0 1.500 1 2.500 2 3.500-1 1-2 2-2 3.500v2c0 1.500-.5 2.500-3 2.500" /></Icon>,
          onClick: () => run(() => download(`${detail.id}.json`, json(detail), "application/json")),
        },
        {
          label: t("Figures (CSV)"),
          hint: t("One row per pass or pair, for a spreadsheet"),
          icon: <Icon><path d="M4 5h16v14H4zM4 10h16M4 15h16M10 5v14" /></Icon>,
          disabled: !hasSeries(detail),
          onClick: () => run(() => download(`${detail.id}-figures.csv`, seriesCsv(detail), "text/csv;charset=utf-8")),
        },
        {
          label: t("Area analysed (GeoJSON)"),
          hint: t("The outline, to open in a map program"),
          icon: <Icon><path d="M12 21s-6.500-5.200-6.500-10.500a6.500 6.500 0 0 1 13 0C18.500 15.800 12 21 12 21zM12 8.500a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" /></Icon>,
          onClick: () => run(() => download(`${detail.id}.geojson`, geojsonOf(detail), "application/geo+json")),
        },
      ]
    : [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={!detail}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={t("Export this case")}
        aria-label={t("Export this case")}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 disabled:opacity-40 ${open ? "text-accent" : "text-muted hover:text-ink"}`}
      >
        <Icon>
          <path d="M12 4v11M7.500 10.500 12 15l4.500-4.500M5 19h14" />
        </Icon>
      </button>

      {open && (
        <div role="menu" aria-label={t("Export this case")} className="ge-pop ge-menu-surface absolute right-0 top-[calc(100%+0.5rem)] z-30 w-72 origin-top-right p-1.5">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled || (busy && item.label === items[0].label)}
              onClick={item.onClick}
              className="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.07] disabled:opacity-40"
            >
              <span className="mt-0.5 shrink-0 text-muted">{item.icon}</span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">
                  {busy && item === items[0] ? t("Preparing the package…") : item.label}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{item.hint}</span>
              </span>
            </button>
          ))}
          {failed && (
            <p role="alert" className="px-2.5 pb-1.5 pt-1 text-xs text-accent">
              {t("The package could not be prepared. Try again.")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
