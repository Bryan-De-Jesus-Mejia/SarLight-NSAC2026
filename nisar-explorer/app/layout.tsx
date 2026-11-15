import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { LangSync } from "@/components/LangSync";
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

export const metadata: Metadata = {
  title: "ONAT: Dancing With the SARs for NASA Space Apps Challenge 2026",
  description:
    "An interactive globe for following how Earth's surface changes, as seen by the NASA–ISRO NISAR radar mission and Sentinel-1. Every figure comes from real radar scenes compared pass against pass; nothing has been verified on the ground yet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${guideSerif.variable} ${guideSans.variable} ${guideMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <LangSync />
        {children}
      </body>
    </html>
  );
}
