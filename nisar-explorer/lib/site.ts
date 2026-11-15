/** What the site says about itself to browsers, search engines and AI assistants. */

export const SITE_NAME = "SarLight";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nasa-space-apps-2026-neon.vercel.app").replace(/\/$/, "");

export const SITE_TAGLINE = "See how the Earth changes, through clouds and in the dark";

export const SITE_DESCRIPTION =
  "SarLight is an interactive 3D globe of how Earth's surface changes, seen by the NASA–ISRO NISAR and Sentinel-1 radars through clouds, smoke and night. Real data, in English and Spanish.";

export const SITE_KEYWORDS = [
  "SarLight",
  "NISAR",
  "SAR",
  "synthetic aperture radar",
  "radar satellite",
  "Earth observation",
  "floods",
  "wildfire",
  "earthquake",
  "glaciers",
  "Sentinel-1",
  "NASA Space Apps Challenge 2026",
  "Dancing with the SARs",
  "Dominican Republic",
  "interactive globe",
  "radar sintético",
  "observación de la Tierra",
];
