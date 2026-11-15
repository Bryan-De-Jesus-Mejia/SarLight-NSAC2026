import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/methods`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/llms.txt`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
