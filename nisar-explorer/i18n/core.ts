import { create } from "zustand";
import { es } from "./es";

/**
 * Two languages, one rule: the English sentence IS the key.
 *
 *   t("Exploration")                          → "Exploración" in Spanish
 *   t("{n} days later", { n: 12 })            → "12 días después"
 *   t("{n, plural, one {# pass} other {# passes}}", { n })
 *
 * English is what the code says, Spanish comes from `i18n/es/*`. A sentence
 * with no Spanish entry shows in English (and warns once in development), so
 * the app can never go blank. `scripts/check-i18n.mjs` lists the gaps.
 *
 * This module has no React in it on purpose: the demo script, the chat
 * simulator, stores and server pages all use it too.
 */

export type Lang = "en" | "es";
export const LANGS: readonly Lang[] = ["en", "es"];
export const LANG_STORAGE_KEY = "ge-lang";

/**
 * BCP-47 tag for `Intl` and for speech recognition. Dominican Spanish writes
 * numbers like English (1,234.5), so figures read the same in both languages.
 */
export const LOCALE_TAG: Record<Lang, string> = { en: "en-US", es: "es-DO" };

export type Params = Record<string, string | number>;

/** Marks a sentence for translation where it is declared (constants, tables); read it later with `t()`. */
export function msg<T extends string>(text: T): T {
  return text;
}

/* -------------------------------------------------------------------------- */
/* Which language to start in                                                 */
/* -------------------------------------------------------------------------- */

const isLang = (value: unknown): value is Lang => value === "en" || value === "es";

/** ?lang= in the address, then what the visitor chose before, then the browser's language. */
export function detectLang(): Lang {
  try {
    // The study guide lives at /aula/es/… or /aula/en/…: the address decides.
    const fromPath = /^\/aula\/(es|en)\//.exec(window.location.pathname)?.[1];
    if (isLang(fromPath)) return fromPath;
  } catch {
    // Nothing to read on the server.
  }
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (isLang(fromUrl)) return fromUrl;
  } catch {
    // No address to read (never on the client).
  }
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage blocked: fall through to the browser language.
  }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const primary = tag?.toLowerCase().slice(0, 2);
    if (primary === "es") return "es";
    if (primary === "en") return "en";
  }
  return "en";
}

/* -------------------------------------------------------------------------- */
/* The language store                                                         */
/* -------------------------------------------------------------------------- */

interface LangState {
  lang: Lang;
  /** Pick a language and remember it. */
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: "en",
  setLang: (lang) => {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Not saved; it still applies for this visit.
    }
    set({ lang });
  },
}));

export const getLang = (): Lang => useLangStore.getState().lang;

/* -------------------------------------------------------------------------- */
/* Translating                                                                */
/* -------------------------------------------------------------------------- */

const warned = new Set<string>();

function lookup(lang: Lang, text: string): string {
  if (lang === "en") return text;
  const found = es[text];
  if (found !== undefined) return found;
  if (process.env.NODE_ENV !== "production" && !warned.has(text)) {
    warned.add(text);
    console.warn(`[i18n] No Spanish for: ${text}`);
  }
  return text;
}

/** Index of the `}` that closes the `{` at `start`, or -1. */
function closing(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && (depth -= 1) === 0) return i;
  }
  return -1;
}

/** `one {# pass} other {# passes}` → { one: "# pass", other: "# passes" }. */
function branchesOf(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i += 1;
    const open = body.indexOf("{", i);
    if (open < 0) break;
    const key = body.slice(i, open).trim();
    const end = closing(body, open);
    if (end < 0) break;
    out[key] = body.slice(open + 1, end);
    i = end + 1;
  }
  return out;
}

const numberFormats = new Map<Lang, Intl.NumberFormat>();
const pluralRules = new Map<Lang, Intl.PluralRules>();

function expand(inner: string, params: Params | undefined, lang: Lang): string {
  const first = inner.indexOf(",");
  if (first < 0) {
    const value = params?.[inner.trim()];
    return value === undefined ? `{${inner}}` : String(value);
  }
  const name = inner.slice(0, first).trim();
  const rest = inner.slice(first + 1);
  const second = rest.indexOf(",");
  if (second < 0) return `{${inner}}`;
  const kind = rest.slice(0, second).trim();
  const branches = branchesOf(rest.slice(second + 1));
  const value = params?.[name];

  if (kind === "plural") {
    const n = Number(value);
    let rules = pluralRules.get(lang);
    if (!rules) pluralRules.set(lang, (rules = new Intl.PluralRules(LOCALE_TAG[lang])));
    let formatter = numberFormats.get(lang);
    if (!formatter) numberFormats.set(lang, (formatter = new Intl.NumberFormat(LOCALE_TAG[lang])));
    const chosen = branches[`=${n}`] ?? branches[rules.select(n)] ?? branches.other ?? "";
    return render(chosen.replace(/#/g, formatter.format(n)), params, lang);
  }
  // select
  const chosen = branches[String(value)] ?? branches.other ?? "";
  return render(chosen, params, lang);
}

/** Fills `{name}`, `{n, plural, …}` and `{x, select, …}` in a sentence. */
function render(text: string, params: Params | undefined, lang: Lang): string {
  if (!text.includes("{")) return text;
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "{") {
      out += text[i];
      i += 1;
      continue;
    }
    const end = closing(text, i);
    if (end < 0) {
      out += text[i];
      i += 1;
      continue;
    }
    out += expand(text.slice(i + 1, end), params, lang);
    i = end + 1;
  }
  return out;
}

export function translate(lang: Lang, text: string, params?: Params): string {
  return render(lookup(lang, text), params, lang);
}

export type TFunction = (text: string, params?: Params) => string;

/** For code outside React (stores, the demo script, the chat simulator, HTML strings). */
export const t: TFunction = (text, params) => translate(getLang(), text, params);

/** One translator per language, so its identity only changes when the language does. */
const translators: Record<Lang, TFunction> = {
  en: (text, params) => translate("en", text, params),
  es: (text, params) => translate("es", text, params),
};

/** A translator for the language on screen. Components using it re-render when the language changes. */
export function useT(): TFunction {
  return translators[useLangStore((s) => s.lang)];
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang);
}
