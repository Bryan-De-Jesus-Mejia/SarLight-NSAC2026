"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePopover } from "@/hooks/usePopover";
import { useT } from "@/i18n/core";
import { formatBytes, loadManifest, packBytes, packCases, supported, type Manifest } from "@/lib/offline";
import { matchesQuery, queryTokens } from "@/lib/search";
import { useAppStore } from "@/store/useAppStore";
import { useOfflineStore } from "@/store/useOfflineStore";

const SHOWN = 6;

function Bar({ done, total }: { done: number; total: number }) {
  return (
    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
      <span className="block h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round((done / Math.max(total, 1)) * 100)}%` }} />
    </span>
  );
}

/** "Work offline": what is on this device, and a way to add or remove cases and the Dominican Republic pack. */
export function OfflinePanel() {
  const t = useT();
  const open = useOfflineStore((s) => s.open);
  const setOpen = useOfflineStore((s) => s.setOpen);
  const online = useOfflineStore((s) => s.online);
  const meta = useOfflineStore((s) => s.meta);
  const busy = useOfflineStore((s) => s.busy);
  const failed = useOfflineStore((s) => s.failed);
  const space = useOfflineStore((s) => s.space);
  const download = useOfflineStore((s) => s.download);
  const remove = useOfflineStore((s) => s.remove);
  const downloadPack = useOfflineStore((s) => s.downloadPack);
  const removePack = useOfflineStore((s) => s.removePack);
  const clear = useOfflineStore((s) => s.clear);
  const events = useAppStore((s) => s.events);

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [query, setQuery] = useState("");
  const close = useCallback(() => setOpen(false), [setOpen]);
  const ref = usePopover(close, open);
  const works = supported();

  useEffect(() => {
    if (!open || manifest) return;
    let alive = true;
    loadManifest()
      .then((loaded) => alive && setManifest(loaded))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, manifest]);

  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const kept = Object.keys(meta.cases);
  const keptBytes = kept.reduce((sum, id) => sum + meta.cases[id].bytes, 0);

  const results = useMemo(() => {
    const tokens = queryTokens(query);
    const pool = events.filter((event) => !meta.cases[event.id] && manifest?.cases[event.id]);
    const matching = tokens.length ? pool.filter((event) => matchesQuery(event, tokens)) : pool;
    return [...matching].sort((a, b) => b.changedAreaKm2 - a.changedAreaKm2).slice(0, SHOWN);
  }, [events, meta.cases, manifest, query]);

  if (!open) return null;

  const pack = busy.pack;
  const packOn = Boolean(meta.packs.dr);
  const sizeOf = (id: string): string => (manifest?.cases[id] ? formatBytes(manifest.cases[id].bytes) : "");

  return (
    <div ref={ref} className="pointer-events-none fixed right-5 top-[7.25rem] z-40 sm:right-8 xl:top-[5.75rem]">
      <section
        role="dialog"
        aria-label={t("Work offline")}
        className="ge-pop ge-menu-surface pointer-events-auto flex max-h-[min(36rem,calc(100dvh-9rem))] w-[min(24rem,calc(100vw-2.5rem))] origin-top-right flex-col p-3"
      >
        <h2 className="font-display text-xl text-ink">{t("Work offline")}</h2>
        <p className="mt-1 text-xs leading-snug text-muted">{t("Keep cases on this device to open them without internet, for example in a classroom.")}</p>

        {!works ? (
          <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
            {t("Offline mode is not available in this browser.")}
          </p>
        ) : (
          <div className="ge-scroll mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {!online && (
              <p role="status" className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-xs leading-snug text-ink">
                {t("You are offline. Downloaded cases still open.")}
              </p>
            )}

            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-ink">{t("Essentials")}</p>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {meta.essentials ? t("Ready") : t("Preparing…")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">{t("The app, the list of cases and a coarse map of the world.")}</p>
            </div>

            <div className="rounded-xl border border-line p-3">
              <p className="text-[13px] font-medium text-ink">{t("Dominican Republic pack")}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {manifest
                  ? t("{n, plural, one {# case} other {# cases}} and the map of the island, about {size}.", {
                      n: packCases(manifest).length,
                      size: formatBytes(packBytes(manifest)),
                    })
                  : t("Preparing…")}
              </p>
              {pack ? (
                <>
                  <p className="mt-2 text-xs text-ink">{t("Downloading… {pct}%", { pct: Math.round((pack.done / Math.max(pack.total, 1)) * 100) })}</p>
                  <Bar done={pack.done} total={pack.total} />
                </>
              ) : packOn ? (
                <button type="button" onClick={() => void removePack()} className="ge-pill mt-2">
                  {t("Remove")}
                </button>
              ) : (
                <button type="button" disabled={!manifest || !online} onClick={() => void downloadPack()} className="ge-pill mt-2 disabled:opacity-40">
                  {t("Download")}
                </button>
              )}
              {failed.pack && <p role="alert" className="mt-1.5 text-xs text-accent">{t("Could not download. Check your connection and try again.")}</p>}
            </div>

            <div>
              <p className="ge-eyebrow mb-1.5">{t("On this device")}</p>
              {kept.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-xs text-muted">{t("Nothing downloaded yet.")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {kept.map((id) => {
                    const event = byId.get(id);
                    const entry = meta.cases[id];
                    return (
                      <li key={id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">{event ? t(event.name.replace(/ analysis$/, "")) : id}</span>
                          <span className="block truncate text-[11px] text-muted">
                            {formatBytes(entry.bytes)}
                            {entry.keeper === "aula" ? ` · ${t("Kept with your classroom")}` : ""}
                            {entry.guide ? ` · ${t("Study guide")}` : ""}
                          </span>
                        </span>
                        <button type="button" onClick={() => void remove(id)} className="ge-link shrink-0 text-xs">
                          {t("Remove")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="ge-eyebrow mb-1.5">{t("Add a case")}</p>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search a place or signal")}
                aria-label={t("Search a place or signal")}
                autoComplete="off"
                className="ge-ctl ge-no-ring flex w-full !justify-start !rounded-xl !px-3 text-sm placeholder:text-muted/80"
              />
              <ul className="mt-1.5 space-y-1.5">
                {results.map((event) => {
                  const job = busy[event.id];
                  return (
                    <li key={event.id} className="rounded-lg border border-line px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">{t(event.name.replace(/ analysis$/, ""))}</span>
                          <span className="block truncate text-[11px] text-muted">
                            {t(event.country)} · {sizeOf(event.id)}
                          </span>
                        </span>
                        {!job && (
                          <button type="button" disabled={!online} onClick={() => void download(event.id)} className="ge-pill shrink-0 disabled:opacity-40">
                            {t("Download")}
                          </button>
                        )}
                      </div>
                      {job && <Bar done={job.done} total={job.total} />}
                      {failed[event.id] && <p role="alert" className="mt-1 text-xs text-accent">{t("Could not download. Check your connection and try again.")}</p>}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[11px] leading-snug text-muted">
              <span>
                {kept.length > 0 && t("{size} downloaded.", { size: formatBytes(keptBytes) })}{" "}
                {space && t("Space used on this device: {used} of {quota}.", { used: formatBytes(space.usage), quota: formatBytes(space.quota) })}
              </span>
              {kept.length > 0 && (
                <button type="button" onClick={() => void clear()} className="ge-link shrink-0 text-xs">
                  {t("Delete everything downloaded")}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
