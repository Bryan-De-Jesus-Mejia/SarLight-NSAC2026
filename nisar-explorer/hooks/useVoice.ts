"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/i18n/core";

/**
 * Voice for the assistant, with what the browser already has (Web Speech API):
 * dictation through speech recognition (Chrome, Edge, Safari; not Firefox) and
 * answers read aloud through speech synthesis. No keys, no extra cost.
 */

/* The recognition API is not in TypeScript's DOM types yet: the little we use. */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const VOICE_TAG: Record<Lang, string> = { es: "es-DO", en: "en-US" };
const READ_KEY = "ge-voice-read";

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};
/** Whether the browser can listen and speak. False on the server, so the first render matches. */
export function useVoiceSupport(): { listen: boolean; speak: boolean } {
  const listen = useSyncExternalStore(noSubscribe, () => recognitionCtor() !== null, () => false);
  const speak = useSyncExternalStore(noSubscribe, () => typeof window !== "undefined" && "speechSynthesis" in window, () => false);
  return { listen, speak };
}

export type ListenError = "denied" | "no-speech" | "failed" | null;

/**
 * Dictation. While listening, `onText` gets the words so far; when the visitor
 * stops talking, `onDone` gets the final sentence.
 */
export function useDictation(lang: Lang, onText: (text: string) => void, onDone: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<ListenError>(null);
  const recognition = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const handlers = useRef({ onText, onDone });
  useEffect(() => {
    handlers.current = { onText, onDone };
  }, [onText, onDone]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;
    window.speechSynthesis?.cancel();
    const rec = new Ctor();
    rec.lang = VOICE_TAG[lang];
    rec.interimResults = true;
    rec.continuous = false;
    finalText.current = "";
    setError(null);
    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      handlers.current.onText((finalText.current + interim).trim());
    };
    rec.onerror = (event) => {
      setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "denied" : event.error === "no-speech" ? "no-speech" : event.error === "aborted" ? null : "failed");
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      const text = finalText.current.trim();
      if (text) handlers.current.onDone(text);
    };
    recognition.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setError("failed");
    }
  }, [lang]);

  // Stop listening when the panel goes away.
  useEffect(() => () => recognition.current?.abort(), []);

  return { listening, error, start, stop };
}

/** Text as it should be heard: no markdown marks, no bare links. */
function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Reading answers aloud: an on/off choice remembered on this device, and a speak function. */
export function useReadAloud(lang: Lang) {
  const [on, setOnState] = useState(false);
  useEffect(() => {
    try {
      // Read once after mount, so the server render and the first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnState(window.localStorage.getItem(READ_KEY) === "1");
    } catch {
      // Private mode: starts off.
    }
  }, []);

  const setOn = useCallback((value: boolean) => {
    setOnState(value);
    if (!value) window.speechSynthesis?.cancel();
    try {
      window.localStorage.setItem(READ_KEY, value ? "1" : "0");
    } catch {
      // Private mode: the choice lasts this visit only.
    }
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth) return;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(speakable(text));
      utterance.lang = VOICE_TAG[lang];
      const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
    },
    [lang],
  );

  const silence = useCallback(() => window.speechSynthesis?.cancel(), []);
  return { on, setOn, speak, silence };
}
