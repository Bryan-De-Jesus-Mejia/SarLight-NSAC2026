import type { Metadata } from "next";
import { ImpactsContent } from "@/components/ImpactsContent";

export const metadata: Metadata = {
  title: "Consequences",
  description:
    "What floods, landslides, wind, heat and drought mean for people, and the stories behind our Dominican Republic cases, told from news reports and official bulletins.",
};

export default function ImpactsPage() {
  return <ImpactsContent />;
}
