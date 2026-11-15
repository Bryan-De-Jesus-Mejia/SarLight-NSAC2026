import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/site";

/** Lets the site be installed on a phone or desktop, with the right icon for each. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SarLight",
    short_name: "SarLight",
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#040406",
    theme_color: "#040406",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
