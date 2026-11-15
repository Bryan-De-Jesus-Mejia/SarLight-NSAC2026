"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * "Detective de radar": real radar images from our cases, and the class
 * guesses what happened. Every round reveals the physical reason the radar
 * saw it that way, and opens the real story of that place.
 */

export interface Round {
  id: string;
  place: string;
  answer: string;
  images: Array<{ src: string; caption: string }>;
  clue: string;
  reveal: string;
}

export const OPTIONS = ["Inundación", "Viento fuerte", "Sequía y calor", "Terremoto", "Quema o cosecha", "Glaciar"] as const;

export function RadarDetective({ rounds }: { rounds: Round[] }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showClue, setShowClue] = useState(false);
  const done = index >= rounds.length;
  const round = rounds[Math.min(index, rounds.length - 1)];
  const options = useMemo(() => OPTIONS, []);

  const choose = (option: string) => {
    if (picked) return;
    setPicked(option);
    if (option === round.answer) setScore((s) => s + 1);
  };
  const next = () => {
    setPicked(null);
    setShowClue(false);
    setIndex((i) => i + 1);
  };
  const restart = () => {
    setIndex(0);
    setScore(0);
    setPicked(null);
    setShowClue(false);
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-accent/50 bg-accent/10 p-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Resultado</p>
        <p className="mt-2 font-display text-5xl text-ink">
          {score} / {rounds.length}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/90">
          {score === rounds.length
            ? "¡Detectives de radar! Leyeron el planeta como lo hace un satélite."
            : score >= rounds.length / 2
              ? "¡Muy bien! Ya saben buscar el agua oscura, el verde que se apaga y los anillos de colores."
              : "El radar engaña al principio. Vuelvan a intentarlo fijándose en las pistas."}
        </p>
        <button type="button" onClick={restart} className="ge-pill mt-5">
          Jugar otra vez
        </button>
      </div>
    );
  }

  const right = picked === round.answer;

  return (
    <div className="rounded-2xl border border-line bg-white/[0.03] p-4 sm:p-6">
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        <span>
          Caso {index + 1} de {rounds.length}
        </span>
        <span>
          Aciertos: <span className="text-accent">{score}</span>
        </span>
      </div>
      <p className="mt-3 font-display text-2xl leading-tight text-ink">¿Qué pasó aquí?</p>
      <p className="mt-1 text-sm text-muted">{round.place}</p>

      <div className={`mt-4 grid gap-2 ${round.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {round.images.map((img) => (
          <figure key={img.src}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={`Imagen de radar: ${img.caption}`} className="w-full rounded-xl border border-line bg-black" />
            <figcaption className="mt-1 font-mono text-[11px] text-muted">{img.caption}</figcaption>
          </figure>
        ))}
      </div>

      {!picked && (
        <button type="button" onClick={() => setShowClue(!showClue)} className="ge-link mt-3 text-sm">
          {showClue ? "Ocultar pista" : "Necesito una pista"}
        </button>
      )}
      {showClue && !picked && <p className="mt-2 rounded-lg border border-line bg-white/[0.03] px-3 py-2 text-sm text-ink/90">{round.clue}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const isAnswer = option === round.answer;
          const state = !picked ? "" : isAnswer ? "border-emerald-400/80 bg-emerald-400/15 text-ink" : option === picked ? "border-rose-400/80 bg-rose-400/15 text-ink" : "opacity-50";
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={picked !== null}
              className={`rounded-xl border border-line px-3 py-3 text-left text-[15px] text-ink transition-colors hover:bg-white/[0.06] disabled:cursor-default ${state}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-4 rounded-xl border border-line bg-[#0b101b] p-4" role="status">
          <p className={`font-medium ${right ? "text-emerald-300" : "text-rose-300"}`}>
            {right ? "¡Correcto!" : `Casi. Era: ${round.answer}.`}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/90">{round.reveal}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={next} className="ge-pill">
              {index + 1 < rounds.length ? "Siguiente caso →" : "Ver resultado"}
            </button>
            <Link href={`/?story=${round.id}`} className="ge-link text-sm">
              Ver la historia completa en el globo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
