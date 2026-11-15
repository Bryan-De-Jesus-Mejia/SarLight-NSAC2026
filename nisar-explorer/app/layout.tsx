import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { LangSync } from "@/components/LangSync";
import { OfflineBoot } from "@/components/OfflineBoot";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

// next/font downloads these at build time and self-hosts them: no runtime CDN.
// One sans for the text, and a grotesk for titles and big numbers.
const display = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// The printable study guide keeps its own faces. They are not preloaded: a
// page only downloads them if it draws a glyph with them.
const guideSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const guideSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

const guideMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#040406",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: { default: `${SITE_NAME}: ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: "Team ONAT" }],
  creator: "Team ONAT",
  category: "science",
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    alternateLocale: ["es_DO"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

/** Structured data: tells search engines and AI assistants what this site is. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: "Dancing with the SARs",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "EducationalApplication",
  applicationSubCategory: "Earth observation",
  operatingSystem: "Any (web browser)",
  inLanguage: ["en", "es"],
  isAccessibleForFree: true,
  creator: { "@type": "Organization", name: "Team ONAT" },
  about: ["Synthetic aperture radar", "NISAR", "Sentinel-1", "Floods", "Wildfires", "Earthquakes", "Glaciers", "Agriculture"],
  isBasedOn: "https://nisar.jpl.nasa.gov/",
};


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${guideSerif.variable} ${guideSans.variable} ${guideMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
        <LangSync />
        <OfflineBoot />
        {children}
      </body>
    </html>
  );
}
