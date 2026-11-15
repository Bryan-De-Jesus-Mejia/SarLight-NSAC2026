"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/i18n/core";
import { buildLesson, buildStudyPrompt, type LessonSource } from "@/lib/lesson";

/**
 * The study guide as a page made to be printed on A4 ("Save as PDF"). Student
 * version: questions and quiz. Teacher version: the same, with answers and timings.
 */

const LETTERS = ["A", "B", "C", "D"];

function Block({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`guide-block mt-6 ${className}`}>
      <h2 className="border-b border-neutral-300 pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function LessonDocument({ source, qr, link, lang }: { source: LessonSource; qr: string; link: string; lang: "es" | "en" }) {
  const t = useT();
  // The words depend on the language the browser settles on, so draw them on the client only.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [teacher, setTeacher] = useState(false);
  const [copied, setCopied] = useState(false);
  // `t` is a dependency on purpose: it changes with the language, and the lesson is built in that language.
  /* eslint-disable react-hooks/exhaustive-deps */
  const lesson = useMemo(() => buildLesson(source), [source, t]);
  const prompt = useMemo(() => buildStudyPrompt(source), [source, t]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("Copy this link"), prompt);
    }
  };

  if (!mounted) return <div className="guide" aria-busy="true" />;

  return (
    <div className="guide">
      <div className="no-print sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[52rem] flex-wrap items-center gap-2 px-5 py-3 text-sm">
          <Link href={`/?case=${source.id}&lang=${lang}`} className="mr-auto text-neutral-600 underline-offset-4 hover:underline">
            ← {t("Back to the globe")}
          </Link>
          <div className="flex overflow-hidden rounded-full border border-neutral-300" role="group" aria-label={t("Version")}>
            {[false, true].map((isTeacher) => (
              <button
                key={String(isTeacher)}
                type="button"
                aria-pressed={teacher === isTeacher}
                onClick={() => setTeacher(isTeacher)}
                className={`px-3 py-1 text-xs ${teacher === isTeacher ? "bg-neutral-900 text-white" : "text-neutral-700"}`}
              >
                {isTeacher ? t("Teacher version") : t("Student version")}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-full border border-neutral-300" role="group" aria-label={t("Language")}>
            {(["es", "en"] as const).map((code) => (
              <Link
                key={code}
                href={`/aula/${code}/${source.id}`}
                aria-current={lang === code}
                className={`px-3 py-1 text-xs uppercase ${lang === code ? "bg-neutral-900 text-white" : "text-neutral-700"}`}
              >
                {code}
              </Link>
            ))}
          </div>
          <button type="button" onClick={() => void copy()} className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-800">
            {copied ? t("Prompt copied") : t("Copy AI study prompt")}
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white">
            {t("Download PDF")}
          </button>
        </div>
        <p className="mx-auto max-w-[52rem] px-5 pb-2 text-[11px] text-neutral-500">{t("In the print window, choose “Save as PDF” as the destination.")}</p>
      </div>

      <article className="mx-auto max-w-[52rem] px-5 pb-16 pt-6 text-[13.5px] leading-relaxed text-neutral-800 print:px-0 print:pt-0">
        <header className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              {t("Study guide")} · {teacher ? t("Teacher version") : t("Student version")}
            </p>
            <h1 className="mt-1 font-display text-4xl leading-[1.05] text-neutral-900">{lesson.title}</h1>
            <p className="mt-1 text-neutral-600">
              {lesson.place} · {lesson.typeLabel}
            </p>
            <p className="mt-3 text-sm text-neutral-700">{lesson.whatHappened}</p>
          </div>
          <figure className="shrink-0 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t("QR code to open this case")} width={96} height={96} className="h-24 w-24" />
            <figcaption className="mt-1 max-w-24 text-[9px] leading-tight text-neutral-500">{t("Scan to open the case on the globe")}</figcaption>
          </figure>
        </header>

        <dl className="guide-block mt-5 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-neutral-300 p-3 text-[12.5px] sm:grid-cols-[auto_1fr_auto_1fr]">
          {lesson.facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-neutral-500">{label}</dt>
              <dd className="font-medium text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>

        {source.figures.length > 0 && (
          <div className="guide-block mt-4 grid grid-cols-2 gap-3">
            {source.figures.map((figure) => (
              <figure key={figure.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={figure.src} alt={t(figure.caption)} className="w-full rounded border border-neutral-300 bg-black" />
                <figcaption className="mt-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{t(figure.caption)}</figcaption>
              </figure>
            ))}
          </div>
        )}

        <Block title={t("How a satellite sees this")}>
          <ul className="grid gap-3 sm:grid-cols-3">
            {lesson.howSeen.map((item) => (
              <li key={item.title} className="rounded-lg border border-neutral-300 p-2.5">
                <p className="font-semibold text-neutral-900">{item.title}</p>
                <p className="mt-0.5 text-[12.5px] text-neutral-700">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[12.5px] text-amber-900">{lesson.caution}</p>
        </Block>

        <Block title={t("What you will learn")}>
          <ul className="list-disc space-y-1 pl-5">
            {lesson.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Block>

        <Block title={t("Key words")}>
          <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            {lesson.terms.map((item) => (
              <div key={item.term} className="contents">
                <dt className="font-semibold text-neutral-900">{item.term}</dt>
                <dd>{item.meaning}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block title={t("Study plan · 45 minutes")}>
          <ol className="space-y-2">
            {lesson.steps.map((step, i) => (
              <li key={step.title} className="guide-block flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">{i + 1}</span>
                <span>
                  <span className="font-semibold text-neutral-900">{step.title}</span>
                  <span className="ml-2 font-mono text-[11px] text-neutral-500">{t("{n} min", { n: step.minutes })}</span>
                  <span className="block text-neutral-700">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </Block>

        <Block title={t("Questions")}>
          <ol className="space-y-3">
            {lesson.questions.map((q, i) => (
              <li key={q.question} className="guide-block">
                <p>
                  <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{q.kind}</span>
                  <span className="font-medium text-neutral-900">
                    {i + 1}. {q.question}
                  </span>
                </p>
                {teacher ? (
                  <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-[12.5px] text-emerald-900">
                    <b>{t("Answer")}:</b> {q.answer}
                  </p>
                ) : (
                  <div className="mt-1.5 space-y-2" aria-hidden="true">
                    <div className="border-b border-dotted border-neutral-400" />
                    <div className="border-b border-dotted border-neutral-400" />
                  </div>
                )}
              </li>
            ))}
          </ol>
        </Block>

        <Block title={t("Hands-on activity")}>
          <p className="font-semibold text-neutral-900">{lesson.activity.title}</p>
          <p className="text-neutral-700">{lesson.activity.body}</p>
        </Block>

        <Block title={t("Quick quiz")}>
          <ol className="space-y-3">
            {lesson.quiz.map((item, i) => (
              <li key={item.question} className="guide-block">
                <p className="font-medium text-neutral-900">
                  {i + 1}. {item.question}
                </p>
                <ul className="mt-1 grid gap-x-4 sm:grid-cols-2">
                  {item.options.map((option, j) => (
                    <li key={option} className={teacher && j === item.answer ? "font-semibold text-emerald-800" : ""}>
                      {LETTERS[j]}) {option}
                      {teacher && j === item.answer ? " ✓" : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Block>

        <Block title={t("Study with an AI assistant")}>
          <p className="text-neutral-700">{t("Paste this prompt into ChatGPT, Claude, Gemini or any assistant you use. It already includes the facts of this case.")}</p>
          <pre className="guide-block mt-2 whitespace-pre-wrap rounded-lg border border-neutral-300 bg-neutral-50 p-3 font-mono text-[10.5px] leading-snug text-neutral-800">{prompt}</pre>
        </Block>

        <Block title={t("Learn more")}>
          <ul className="space-y-1">
            {lesson.resources.map((r) => (
              <li key={r.url}>
                <a href={r.url} className="font-medium text-blue-700 underline-offset-2 hover:underline">
                  {r.name}
                </a>{" "}
                <span className="text-neutral-600">— {r.note}</span>
                <span className="hidden font-mono text-[10px] text-neutral-500 print:inline"> ({r.url})</span>
              </li>
            ))}
          </ul>
        </Block>

        <footer className="mt-8 border-t border-neutral-300 pt-3 text-[11px] leading-snug text-neutral-500">
          <p>{t("Radar data: NASA–ISRO NISAR and ESA Copernicus Sentinel-1 (through NASA ASF and OPERA). Land cover: ESA WorldCover 2021.")}</p>
          <p className="mt-1">
            {t("Made for the NASA Space Apps Challenge 2026, “Dancing with the SARs”.")} {link}
          </p>
        </footer>
      </article>
    </div>
  );
}
