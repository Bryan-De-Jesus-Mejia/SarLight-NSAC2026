"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePopover } from "@/hooks/usePopover";
import { useT } from "@/i18n/core";
import { formatWhen } from "@/lib/format";
import type { CatalogueScene, Pass, PassesResponse } from "@/lib/nisarPasses";
import { useAppStore } from "@/store/useAppStore";
import { usePassesStore } from "@/store/usePassesStore";

interface Place {
  lat: number;
  lon: number;
  /** "home" and "me" are named in the visitor's language when drawn; anything else is shown as is. */
  label: string;
}

/** The Dominican Republic, where the team lives, until the visitor picks another place. */
const HOME: Place = { lat: 18.9, lon: -70.2, label: "home" };

/** "18.5, -70.2" → a place, or null. */
function parseCoordinates(text: string): Place | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?)\s*[;\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/.exec(text.replace(/,\s+/, ";"));
  if (!match) return null;
  const lat = Number(match[1].replace(",", "."));
  const lon = Number(match[2].replace(",", "."));
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, label: `${lat.toFixed(2)}, ${lon.toFixed(2)}` };
}

const pad = (n: number): string => String(n).padStart(2, "0");

/** A calendar file (.ics) with one 30-minute event around the moment of the pass. */
function calendarFile(pass: Pass, title: string, note: string): string {
  const stamp = (ms: number): string => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(pass.time).getTime() - 5 * 60_000;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SarLight//NISAR passes//EN",
    "BEGIN:VEVENT",
    `UID:nisar-${stamp(start)}@sarlight`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + 30 * 60_000)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${note}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function countdown(ms: number, t: ReturnType<typeof useT>): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return t("in {d}d {h}h", { d: days, h: hours });
  if (hours > 0) return t("in {h}h {m}min", { h: hours, m: minutes % 60 });
  return t("in {m} min", { m: minutes });
}

export function PassesPanel() {
  const t = useT();
  const open = usePassesStore((s) => s.open);
  const setOpen = usePassesStore((s) => s.setOpen);
  const events = useAppStore((s) => s.events);
  const selectedId = useAppStore((s) => s.selectedId);

  const [place, setPlace] = useState<Place>(HOME);
  const [data, setData] = useState<PassesResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [text, setText] = useState("");
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const close = useCallback(() => setOpen(false), [setOpen]);
  const ref = usePopover(close, open);
  const openCase = useMemo(() => events.find((event) => event.id === selectedId) ?? null, [events, selectedId]);

  // Ask the server for this place (nothing is kept about it).
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/nisar/passes?lat=${place.lat}&lon=${place.lon}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<PassesResponse>;
      })
      .then((body) => {
        setData(body);
        setStatus("idle");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [open, place]);

  // The countdown moves twice a minute.
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [open]);

  const choose = (next: Place) => {
    setStatus("loading");
    setData(null);
    setPlace(next);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return setDenied(true);
    setLocating(true);
    setDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        choose({ lat: position.coords.latitude, lon: position.coords.longitude, label: "me" });
      },
      () => {
        setLocating(false);
        setDenied(true);
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const upcoming = data ? data.passes.filter((pass) => new Date(pass.time).getTime() > now - 10 * 60_000) : [];
  const next = upcoming[0];

  const hourText = (hour: number): string => `${Math.floor(hour)}:${pad(Math.round((hour % 1) * 60) % 60)}`;
  const kind = (pass: Pass): string => (pass.solarHour < 12 ? t("Dawn pass") : t("Dusk pass"));
  const where = place.label === "me" ? t("My location") : place.label === "home" ? t("Dominican Republic") : place.label;

  const addToCalendar = (pass: Pass) => {
    const content = calendarFile(
      pass,
      t("NISAR can image {place}", { place: where }),
      t("Estimated from public orbit data. Not an official NASA schedule."),
    );
    const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nisar-pass.ics";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div ref={ref} className="pointer-events-none fixed right-5 top-[7.25rem] z-40 sm:right-8 xl:top-[5.75rem]">
      <section
        role="dialog"
        aria-label={t("When does NISAR pass over me?")}
        className="ge-pop ge-menu-surface pointer-events-auto flex max-h-[min(38rem,calc(100dvh-9rem))] w-[min(25rem,calc(100vw-2.5rem))] origin-top-right flex-col p-3"
      >
        <h2 className="font-display text-xl text-ink">{t("When does NISAR pass over me?")}</h2>
        <p className="mt-1 text-xs leading-snug text-muted">
          {t("The satellite looks sideways, so it images a place when it flies by at a distance, not when it is overhead.")}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={locate} disabled={locating} className="ge-pill disabled:opacity-50">
            {locating ? t("Locating…") : t("Use my location")}
          </button>
          {openCase && (
            <button
              type="button"
              onClick={() => choose({ lat: openCase.lat, lon: openCase.lon, label: t(openCase.name.replace(/ analysis$/, "")) })}
              className="ge-pill"
            >
              {t("The open case")}
            </button>
          )}
          <button type="button" onClick={() => choose(HOME)} className="ge-pill">
            {t("Dominican Republic")}
          </button>
        </div>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseCoordinates(text);
            if (parsed) choose(parsed);
          }}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("Latitude, longitude (18.5, -70.2)")}
            aria-label={t("Latitude, longitude (18.5, -70.2)")}
            autoComplete="off"
            className="ge-ctl ge-no-ring flex min-w-0 flex-1 !justify-start !rounded-xl !px-3 text-sm placeholder:text-muted/80"
          />
          <button type="submit" disabled={!parseCoordinates(text)} className="ge-pill disabled:opacity-40">
            {t("Go")}
          </button>
        </form>
        {denied && (
          <p role="alert" className="mt-1.5 text-xs text-accent">
            {t("Your location is not available. Type the coordinates instead.")}
          </p>
        )}

        <div className="ge-scroll mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <p className="ge-eyebrow">{where}</p>

          {status === "error" ? (
            <p role="alert" className="rounded-lg border border-line px-3 py-3 text-sm text-muted">
              {t("The orbital data is not available right now. Try again in a few minutes.")}
            </p>
          ) : !data ? (
            <p className="px-1 py-3 text-sm text-muted" role="status">
              {t("Calculating…")}
            </p>
          ) : (
            <>
              {next ? (
                <div className="rounded-xl border border-accent/50 bg-accent/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">{t("Next time NISAR can image it")}</p>
                  <p className="mt-1 font-display text-2xl leading-tight text-ink">{countdown(new Date(next.time).getTime() - now, t)}</p>
                  <p className="mt-0.5 text-sm text-ink">{formatWhen(new Date(next.time).getTime())}</p>
                  <p className="mt-1 text-xs leading-snug text-muted">
                    {kind(next)} · {t("about {hour} solar time there", { hour: hourText(next.solarHour) })} ·{" "}
                    {next.direction === "ascending" ? t("heading north") : t("heading south")}
                  </p>
                  <p className="mt-1.5 text-xs leading-snug text-ink/80">
                    {next.imagedBefore ? t("This slot was imaged in an earlier cycle.") : t("No scene of this slot is in the public catalogue yet.")}
                  </p>
                  <button type="button" onClick={() => addToCalendar(next)} className="ge-pill mt-2">
                    {t("Add to calendar")}
                  </button>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">{t("No pass in the next two weeks.")}</p>
              )}

              {upcoming.length > 1 && (
                <ul className="space-y-1.5">
                  {upcoming.slice(1).map((pass) => (
                    <li key={pass.time} className="flex items-center justify-between gap-3 rounded-lg border border-line px-2.5 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-ink">{formatWhen(new Date(pass.time).getTime())}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {kind(pass)} · {pass.imagedBefore ? t("imaged before") : t("not in the catalogue yet")}
                        </span>
                      </span>
                      <button type="button" onClick={() => addToCalendar(pass)} className="ge-link shrink-0 text-xs">
                        {t("Calendar")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <SceneList scenes={data.scenes} available={data.scenesAvailable} />

              <p className="border-t border-line pt-2 text-[11px] leading-snug text-muted">
                {t(
                  "An estimate from public orbit data ({source}, measured {days} days ago) and NASA's public catalogue of real scenes. It is not an official NASA schedule: whether a scene is taken depends on the mission's observation plan, and products appear in the catalogue some days later.",
                  { source: data.orbit.source, days: Math.max(0, Math.round(data.orbit.ageDays)) },
                )}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function SceneList({ scenes, available }: { scenes: CatalogueScene[]; available: boolean }) {
  const t = useT();
  return (
    <div>
      <p className="ge-eyebrow mb-1.5">{t("Latest real scenes here")}</p>
      {!available ? (
        <p className="text-xs text-muted">{t("The catalogue could not be reached.")}</p>
      ) : scenes.length === 0 ? (
        <p className="text-xs text-muted">{t("No NISAR scene of this place is in the public catalogue yet.")}</p>
      ) : (
        <ul className="space-y-1">
          {scenes.slice(0, 3).map((scene) => (
            <li key={scene.time} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ink">{formatWhen(new Date(scene.time).getTime())}</span>
              <span className="font-mono text-[10px] text-muted">{t("track {track}, frame {frame}", { track: scene.track, frame: scene.frame })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
