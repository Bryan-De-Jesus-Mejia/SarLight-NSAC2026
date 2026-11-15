"use client";

import { useEffect, useMemo, useState } from "react";
import { ChangeTypeIcon } from "@/components/icons/ChangeTypeIcon";
import { ACTIONS, peopleLine } from "@/components/panel/Impact";
import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType, EventDetail, EventSummary } from "@/data/types";
import { globeApi } from "@/lib/globeApi";
import { useAppStore } from "@/store/useAppStore";

/**
 * "Is my community at risk?": pick a place (your location or a tap on the
 * globe) and see what our radar analyses found around it, who lives there, and
 * what to do. Only our own analysed places count, so an empty answer means
 * "not analysed yet", never "safe".
 */

const NEAR_KM = 40;
const HAZARDS: ChangeType[] = ["flood", "landslide", "storm", "drought", "wildfire", "earthquake"];
const PLAIN: Partial<Record<ChangeType, string>> = {
  flood: "flooding",
  landslide: "slopes on the move",
  storm: "wind damage",
  drought: "heat and drying",
  wildfire: "fire",
  earthquake: "an earthquake",
  agriculture: "changing fields",
  glacier: "moving ice",
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function inside(e: EventSummary, lat: number, lng: number): boolean {
  if (!e.footprint?.length) return false;
  const xs = e.footprint.map((p) => p[0]);
  const ys = e.footprint.map((p) => p[1]);
  return lng >= Math.min(...xs) && lng <= Math.max(...xs) && lat >= Math.min(...ys) && lat <= Math.max(...ys);
}

interface Near {
  event: EventSummary;
  km: number;
  within: boolean;
}

const cache = new Map<string, EventDetail>();
async function loadDetail(id: string): Promise<EventDetail | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  try {
    const res = await fetch(`/api/events/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as EventDetail;
    cache.set(id, body);
    return body;
  } catch {
    return null;
  }
}

export function Community() {
  const open = useAppStore((s) => s.community);
  const picking = useAppStore((s) => s.communityPicking);
  const point = useAppStore((s) => s.communityPoint);
  const events = useAppStore((s) => s.events);
  const setOpen = useAppStore((s) => s.setCommunity);
  const setPicking = useAppStore((s) => s.setCommunityPicking);
  const setPoint = useAppStore((s) => s.setCommunityPoint);
  const select = useAppStore((s) => s.select);
  const setStory = useAppStore((s) => s.setStory);
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");
  const [details, setDetails] = useState<Record<string, EventDetail>>({});

  const near = useMemo<Near[]>(() => {
    if (!point) return [];
    return events
      .map((event) => ({ event, km: distanceKm(point.lat, point.lng, event.lat, event.lon), within: inside(event, point.lat, point.lng) }))
      .sort((a, b) => Number(b.within) - Number(a.within) || a.km - b.km);
  }, [events, point]);
  const close = useMemo(() => near.filter((n) => n.within || n.km <= NEAR_KM), [near]);
  const hazards = close.filter((n) => HAZARDS.includes(n.event.type));
  const types = [...new Set(close.map((n) => n.event.type))];

  // The details of the closest few carry the people counts.
  useEffect(() => {
    let live = true;
    for (const n of close.slice(0, 4)) {
      if (details[n.event.id]) continue;
      void loadDetail(n.event.id).then((d) => {
        if (live && d) setDetails((prev) => ({ ...prev, [d.id]: d }));
      });
    }
    return () => {
      live = false;
    };
  }, [close, details]);

  useEffect(() => {
    if (point) globeApi.current?.flyTo({ lat: point.lat, lng: point.lng, altitude: 0.22 });
  }, [point]);

  if (!open) return null;

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating("idle");
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setLocating("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const openStory = (id: string) => {
    setOpen(false);
    select(id);
    setStory(true);
  };

  const home = close.some((n) => n.event.country === "Dominican Republic") || (point && point.lat > 17.4 && point.lat < 20 && point.lng > -72.1 && point.lng < -68.2);

  return (
    <section
      aria-labelledby="community-title"
      className="ge-intro glass pointer-events-auto absolute left-5 top-[8.75rem] z-30 flex max-h-[calc(100dvh-11rem)] w-[min(23rem,calc(100vw-2.5rem))] flex-col rounded-2xl sm:left-8"
    >
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Your place</p>
          <h2 id="community-title" className="mt-2 font-display text-[1.6rem] leading-[1.08] text-ink">
            Is my community at risk?
          </h2>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white/10 hover:text-ink">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="ge-scroll mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <p className="text-sm leading-relaxed text-ink/85">See what our radar analyses found around a place you care about.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={locate} className="ge-pill" disabled={locating === "busy"}>
            {locating === "busy" ? "Finding you…" : "Use my location"}
          </button>
          <button type="button" onClick={() => setPicking(!picking)} className="ge-pill" aria-pressed={picking}>
            {picking ? "Tap the globe…" : "Pick on the globe"}
          </button>
        </div>
        {locating === "denied" && <p className="mt-2 text-xs text-muted">Location is not available. Pick the place on the globe instead.</p>}
        {picking && <p className="mt-2 text-xs text-accent">Tap your community on the globe. Zoom in first for a precise spot.</p>}

        {point && !picking && (
          <div className="mt-5 space-y-4">
            <p className="font-mono text-[11px] text-muted">
              {point.lat.toFixed(3)}°, {point.lng.toFixed(3)}°
            </p>

            {close.length > 0 ? (
              <>
                <p className="text-[15px] leading-relaxed text-ink">
                  {hazards.length > 0
                    ? `Our radar found signs of ${types.map((t) => PLAIN[t] ?? t).join(", ")} within ${NEAR_KM} km of this place.`
                    : `Within ${NEAR_KM} km our radar watched ${types.map((t) => PLAIN[t] ?? t).join(", ")}.`}
                </p>
                <ul className="space-y-2">
                  {close.slice(0, 6).map(({ event, km, within }) => {
                    const d = details[event.id];
                    const people = d ? peopleLine(d) : null;
                    return (
                      <li key={event.id} className="rounded-xl border border-line p-3">
                        <p className="flex items-center gap-2 text-sm text-ink">
                          <span style={{ color: CHANGE_TYPES[event.type].color }}>
                            <ChangeTypeIcon type={event.type} size={14} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{event.name.replace(/ analysis$/i, "")}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted">{within ? "you are inside" : `${Math.round(km)} km`}</span>
                        </p>
                        {people && <p className="mt-1.5 text-xs leading-relaxed text-ink/80">{people}</p>}
                        <button type="button" onClick={() => openStory(event.id)} className="ge-link mt-1.5 text-xs">
                          Hear its story →
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink">
                We have not analysed this area yet.
                {near[0] && ` The closest place we watched is ${near[0].event.name.replace(/ analysis$/i, "")}, ${Math.round(near[0].km).toLocaleString("en-US")} km away.`}
              </p>
            )}

            {hazards.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">What you can do</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-ink/90 marker:text-muted">
                  {[...new Set(hazards.map((n) => n.event.type))].flatMap((t) => (ACTIONS[t] ?? []).slice(0, 2)).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[12px] text-ink">
              {home ? (
                <>
                  Emergency: <b>9-1-1</b>. Official alerts: <b>COE</b> and <b>Defensa Civil</b>.
                </>
              ) : (
                "In an emergency, call your local emergency number and follow your civil protection's alerts."
              )}
            </p>
            <p className="border-t border-line pt-3 text-[11px] leading-snug text-muted">
              Based only on the {events.length} places our team analysed with NISAR radar. No signal here does not mean no risk, and nothing has been checked on the ground.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
