import { CHANGE_TYPES } from "@/data/changeTypes";
import type { EventDetail, EventSummary } from "@/data/types";
import { escapeHtml } from "@/lib/dom";
import { formatSigned, formatValue } from "@/lib/format";

/**
 * DOM elements drawn on the globe through its single "html elements" layer:
 *  - focusable markers for the featured cases, and
 *  - one callout card for the selected case.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** The selected case, as an HTML-layer datum. */
export interface CalloutDatum extends EventSummary {
  callout: true;
  detail: EventDetail | null;
}

export type HtmlDatum = EventSummary | CalloutDatum;

export const isCallout = (d: object): d is CalloutDatum => "callout" in d;

export function toCalloutDatum(event: EventSummary, detail: EventDetail | null): CalloutDatum {
  return { ...event, callout: true, detail: detail?.id === event.id ? detail : null };
}

/**
 * Marker callbacks go through a module-level ref so the marker elements are
 * created once and never rebuilt when handlers change.
 */
export interface MarkerHandlers {
  activate: (event: EventSummary) => void;
  reveal: (event: EventSummary) => void;
}
export const markerHandlers: { current: MarkerHandlers | null } = { current: null };

/**
 * Markers are created once for every featured case and never removed: the
 * timeline and the filters only switch them off through a data attribute
 * (see .ge-marker-anchor[data-off] in globals.css).
 */
const markerElements = new Map<string, HTMLElement>();
const markersOff = new Set<string>();

export function syncMarkers(visibleIds: ReadonlySet<string>): void {
  markersOff.clear();
  for (const [id, element] of markerElements) {
    const off = !visibleIds.has(id);
    if (off) markersOff.add(id);
    element.toggleAttribute("data-off", off);
  }
}

function createMarker(e: EventSummary): HTMLElement {
  const meta = CHANGE_TYPES[e.type];

  // Known trap: the globe overwrites `transform` on the element it is given.
  // So we hand it a zero-size anchor and let the real button offset itself
  // inside (see .ge-marker in globals.css).
  const anchor = document.createElement("div");
  anchor.className = "ge-marker-anchor";
  anchor.style.setProperty("--marker-color", meta.color);
  anchor.style.setProperty("--marker-rgb", meta.rgb.join(" "));

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ge-marker";
  button.setAttribute("aria-label", `${e.name}, ${e.country}. Featured ${meta.noun} case.`);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", meta.iconPath);
  svg.appendChild(path);
  button.appendChild(svg);

  const label = document.createElement("span");
  label.className = "ge-marker-label";
  label.textContent = e.name;
  button.appendChild(label);

  button.addEventListener("click", (domEvent) => {
    domEvent.stopPropagation();
    markerHandlers.current?.activate(e);
  });
  // Keyboard focus may land on a marker that is behind the globe: bring it round.
  button.addEventListener("focus", () => {
    if (button.matches(":focus-visible")) markerHandlers.current?.reveal(e);
  });

  anchor.appendChild(button);
  anchor.toggleAttribute("data-off", markersOff.has(e.id));
  markerElements.set(e.id, anchor);
  return anchor;
}

function createCallout(d: CalloutDatum): HTMLElement {
  const meta = CHANGE_TYPES[d.type];

  const anchor = document.createElement("div");
  anchor.className = "ge-callout-anchor";
  anchor.style.setProperty("--marker-color", meta.color);
  anchor.style.setProperty("--marker-rgb", meta.rgb.join(" "));

  const sweep = document.createElement("div");
  sweep.className = "ge-sweep";
  sweep.setAttribute("aria-hidden", "true");
  anchor.appendChild(sweep);

  let stat = "";
  if (d.detail) {
    const { change, metric } = d.detail;
    const signed = change.direction === "increase" ? change.value : -change.value;
    stat =
      `<div class="ge-callout-stat">` +
      `<span class="ge-callout-value">${escapeHtml(formatSigned(signed))} ${escapeHtml(change.unit)}</span>` +
      `<span class="ge-callout-metric">${escapeHtml(metric.label)}</span>` +
      `</div>`;
  }

  const card = document.createElement("div");
  card.className = "ge-callout";
  card.innerHTML =
    `<span class="ge-callout-line" aria-hidden="true"></span>` +
    `<div class="ge-callout-type">${escapeHtml(meta.label)}</div>` +
    `<div class="ge-callout-name">${escapeHtml(d.name)}</div>` +
    `<div class="ge-callout-place">${escapeHtml(d.region)} · ${escapeHtml(d.country)}</div>` +
    stat +
    (d.detail
      ? `<div class="ge-callout-area">${escapeHtml(formatValue(d.detail.areaKm2))} km² affected</div>`
      : "");
  anchor.appendChild(card);

  return anchor;
}

export const htmlElement = (d: object): HTMLElement =>
  isCallout(d) ? createCallout(d) : createMarker(d as EventSummary);

/** Hide elements on the far hemisphere (and make them unclickable). */
export const htmlElementVisibilityModifier = (el: HTMLElement, isVisible: boolean): void => {
  el.style.opacity = isVisible ? "1" : "0";
  el.style.pointerEvents = isVisible ? "auto" : "none";
};
