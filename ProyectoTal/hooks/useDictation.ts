"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LOCALE_TAG, type Lang } from "@/i18n/core";

/**
 * Speech to text with the browser's own recognition (Web Speech API). No key,
 * no server of ours: Chrome and Edge send the audio to their speech service,
 * Safari uses Apple's. Firefox does not offer it, so `supported` is false there
 * and the caller hides the button.
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly length: number;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

export type DictationError = "denied" | "network" | "no-mic" | "failed";

const ctorOf = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Spanish falls back to Latin-American Spanish when the browser does not know es-DO. */
const FALLBACK: Partial<Record<Lang, string>> = { es: "es-419" };

export function useDictation(lang: Lang, onText: (text: string) => void) {
  // Only the browser knows; the server always says no, so both sides agree on the first paint.
  const supported = useSyncExternalStore(
    () => () => {},
    () => ctorOf() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<DictationError | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(
    (base: string) => {
      const Ctor = ctorOf();
      if (!Ctor || recognition.current) return;
      setError(null);

      let triedFallback = false;
      const begin = (tag: string) => {
        const rec = new Ctor();
        rec.lang = tag;
        // One phrase at a time: continuous mode repeats words on Android.
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onresult = (event) => {
          let said = "";
          for (let i = 0; i < event.results.length; i += 1) said += event.results[i][0].transcript;
          said = said.trim();
          const joined = base && said ? `${base.replace(/\s+$/, "")} ${said}` : `${base}${said}`;
          onTextRef.current(joined);
        };
        rec.onerror = (event) => {
          const code = event.error;
          if (code === "language-not-supported" && !triedFallback && FALLBACK[lang]) {
            triedFallback = true;
            recognition.current = null;
            begin(FALLBACK[lang] as string);
            return;
          }
          if (code === "no-speech" || code === "aborted") return;
          setError(
            code === "not-allowed" || code === "service-not-allowed"
              ? "denied"
              : code === "network"
                ? "network"
                : code === "audio-capture"
                  ? "no-mic"
                  : "failed",
          );
        };
        rec.onend = () => {
          if (recognition.current === rec) {
            recognition.current = null;
            setListening(false);
          }
        };

        recognition.current = rec;
        try {
          rec.start();
          setListening(true);
        } catch {
          recognition.current = null;
          setListening(false);
          setError("failed");
        }
      };
      begin(LOCALE_TAG[lang]);
    },
    [lang],
  );

  // Escape stops the dictation first, before it closes the panel.
  useEffect(() => {
    if (!listening) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      recognition.current?.stop();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening]);

  // Leaving the panel, or changing language, drops the microphone.
  useEffect(
    () => () => {
      recognition.current?.abort();
      recognition.current = null;
      setListening(false);
    },
    [lang],
  );

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, error, start, stop, clearError };
}
