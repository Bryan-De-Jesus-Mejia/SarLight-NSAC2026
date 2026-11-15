import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import { LessonDocument } from "@/components/LessonDocument";
import { getDataProvider } from "@/data/providers";
import type { EventDetail } from "@/data/types";
import type { LessonSource } from "@/lib/lesson";

/**
 * The printable study guide of one case: /aula/es/azua-flood, /aula/en/azua-flood.
 * Static pages, one per case and language. The words are drawn on the client
 * (so they follow the same translations as the app) and the page is laid out
 * for A4: "Save as PDF" in the print dialog gives the file.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nasa-space-apps-2026-neon.vercel.app";
const LANGS = ["es", "en"] as const;

export async function generateStaticParams() {
  const events = await getDataProvider().getEvents();
  return LANGS.flatMap((lang) => events.map((event) => ({ lang, id: event.id })));
}

export const metadata: Metadata = {
  title: "Study guide — Dancing with the SARs",
  robots: { index: false },
};

function figuresOf(detail: EventDetail): LessonSource["figures"] {
  const a = detail.analyses[0];
  if (a) {
    return [
      { src: a.images.pre, caption: "Before" },
      { src: a.images.post, caption: "After" },
    ];
  }
  const x = detail.extra;
  if (!x) return [];
  if (x.kind === "glacier") return [{ src: x.groups[0].map, caption: "Map from our analysis" }];
  if (x.kind === "displacement") return [{ src: x.pairs[0].images.displacement, caption: "Ground movement from our analysis" }];
  return [{ src: x.orbits[0].map, caption: "Map from our analysis" }];
}

async function Guide({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (lang !== "es" && lang !== "en") notFound();
  const detail = await getDataProvider().getEventById(id);
  if (!detail) notFound();

  const source: LessonSource = {
    id: detail.id,
    type: detail.type,
    name: detail.name,
    region: detail.region,
    country: detail.country,
    sensors: detail.sensors,
    startDate: detail.startDate,
    endDate: detail.endDate,
    changedAreaKm2: detail.changedAreaKm2,
    analyses: detail.analyses.slice(0, 1).map((a) => ({
      pre: { date: a.pre.date },
      post: { date: a.post.date },
      land: { changedAreaKm2: a.land.changedAreaKm2 },
    })),
    figures: figuresOf(detail),
  };
  const link = `${SITE}/?case=${encodeURIComponent(id)}&lang=${lang}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 240, errorCorrectionLevel: "M" });

  return <LessonDocument source={source} qr={qr} link={link} lang={lang} />;
}

export default function GuidePage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  return (
    <Suspense fallback={<div className="guide" aria-busy="true" />}>
      <Guide params={params} />
    </Suspense>
  );
}
