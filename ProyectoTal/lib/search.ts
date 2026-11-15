import { CHANGE_TYPES } from "@/data/changeTypes";
import type { EventSummary } from "@/data/types";
import { translate } from "@/i18n/core";

/** Lower-case and strip diacritics, so "rondonia" finds "Rondônia". */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Split a query into normalised words. An empty array means "no search". */
export function queryTokens(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

const haystacks = new WeakMap<EventSummary, string>();

function haystack(event: EventSummary): string {
  let text = haystacks.get(event);
  if (text === undefined) {
    // Both languages at once: "inundación" and "flood" find the same case.
    const parts = [event.name, event.region, event.country, CHANGE_TYPES[event.type].label];
    text = normalizeText([...parts, ...parts.map((part) => translate("es", part))].join(" "));
    haystacks.set(event, text);
  }
  return text;
}

/** True when every word of the query appears in the name, place or type of the event. */
export function matchesQuery(event: EventSummary, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  const text = haystack(event);
  return tokens.every((token) => text.includes(token));
}
