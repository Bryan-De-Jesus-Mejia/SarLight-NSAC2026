import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import { LangSync } from "@/components/LangSync";
import "./globals.css";

// next/font downloads these at build time and self-hosts them: no runtime CDN.
const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <LangSync />
        {children}
      </body>
    </html>
  );
}
