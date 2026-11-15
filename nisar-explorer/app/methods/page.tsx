import type { Metadata } from "next";
import { MethodsContent, type MethodsRow } from "@/components/MethodsContent";
import { getDataProvider } from "@/data/providers";
import type { EventDetail } from "@/data/types";

export const metadata: Metadata = {
  title: "Methods — Dancing with the SARs",
  description:
    "How this explorer works: what SAR and NISAR measure, how two radar passes become a change map, what the numbers can and cannot tell you, and which data they come from.",
};

/** The page reads the analyses on the server; the words are drawn on the client, in the visitor's language. */
export default async function MethodsPage() {
  const provider = getDataProvider();
  const events = await provider.getEvents();
  const details = (await Promise.all(events.map((e) => provider.getEventById(e.id)))).filter(
    (d): d is EventDetail => d !== null,
  );
  const rows: MethodsRow[] = details.flatMap((detail) =>
    detail.analyses.map((a) => ({
      key: `${detail.id}-${a.key}`,
      name: detail.name,
      sensor: a.sensor,
      pol: a.pol,
      pre: a.pre.date.slice(0, 10),
      post: a.post.date.slice(0, 10),
      changedKm2: a.land.changedAreaKm2,
      seaKm2: a.land.changedOnWaterKm2,
    })),
  );

  return <MethodsContent rows={rows} />;
}
