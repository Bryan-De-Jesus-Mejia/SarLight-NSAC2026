import { globeApi } from "@/lib/globeApi";
import { CARIBBEAN_VIEW, caribbeanItem, worldItem } from "@/lib/trail";
import { useAppStore } from "@/store/useAppStore";

/**
 * The guided demo: a fixed sequence of scenes. Each one moves the camera,
 * switches layers and shows a caption. Scenes only call things the app already
 * does for a visitor (fly, open a case, change a layer), so the demo can never
 * show something the app cannot do on its own.
 */

export interface DemoScene {
  kicker: string;
  title: string;
  body: string;
  /** How long the scene stays up, in ms. Infinity for the last one. */
  ms: number;
  enter: () => void;
  /** Extra actions at a moment inside the scene. */
  cues?: Array<{ at: number; run: () => void }>;
}

const store = () => useAppStore.getState();

const RADAR_DAY = "2026-10-30";
const EARLIER_DAY = "2026-06-20";
const CASE_ID = "enriquillo-lake-advance";

export const DEMO_SCENES: readonly DemoScene[] = [
  {
    kicker: "01 · The planet",
    title: "Earth never holds still",
    body: "Wetlands swell, glaciers slide, faults slip. A new radar satellite is watching all of it.",
    ms: 7000,
    enter: () => {
      store().setOverlay("none");
      globeApi.current?.flyTo({ lat: 18, lng: -70, altitude: 2.4 });
    },
  },
  {
    kicker: "02 · The instrument",
    title: "A radar that sees through clouds",
    body: "NISAR, from NASA and ISRO, sends its own microwave pulses, day and night. Each strip is one pass of the satellite, painted in false colour.",
    ms: 9500,
    enter: () => {
      store().setOverlayDate(RADAR_DAY);
      store().setOverlay("radar");
      globeApi.current?.flyTo({ lat: 12, lng: -75, altitude: 1.9 });
    },
  },
  {
    kicker: "03 · The Caribbean",
    title: "Hispaniola, under the radar",
    body: "The satellite returns to the same ground on a fixed rhythm. Dozens of passes over the island already sit in NASA's public catalogue.",
    ms: 8000,
    enter: () => globeApi.current?.flyTo(CARIBBEAN_VIEW, [worldItem, caribbeanItem]),
  },
  {
    kicker: "04 · The country",
    title: "Thirty-two provinces, one lake",
    body: "Zoom in and the map follows you: borders, provinces, and the places where the ground is changing.",
    ms: 7500,
    enter: () => globeApi.current?.openCountry("DOM"),
  },
  {
    kicker: "05 · A case",
    title: "Lake Enriquillo",
    body: "The Caribbean's largest lake lies below sea level. Calm water bounces the radar pulse away, so open water shows up dark.",
    ms: 11000,
    enter: () => {
      store().setOverlayDate(RADAR_DAY);
      store().setOverlay("radar");
      globeApi.current?.focusCase(CASE_ID);
    },
  },
  {
    kicker: "06 · Two ways of seeing",
    title: "Eye versus radar",
    body: "Same place. First as a camera would see it, then as the radar does: it reads roughness and moisture, not colour.",
    ms: 10000,
    enter: () => store().setOverlay("none"),
    cues: [{ at: 4500, run: () => store().setOverlay("radar") }],
  },
  {
    kicker: "07 · Time",
    title: "The same place, a different day",
    body: "Every pass is a new look. Compare dates to see what moved: water spreading, fields turning, ground shifting.",
    ms: 9500,
    enter: () => {
      store().setOverlayDate(EARLIER_DAY);
      store().setOverlay("radar");
    },
    cues: [{ at: 4500, run: () => store().setOverlayDate(RADAR_DAY) }],
  },
  {
    kicker: "08 · Your turn",
    title: "Now explore",
    body: "Drag, zoom, search, switch layers. The satellite imagery is open NASA data; the case figures in this prototype are simulated.",
    ms: Infinity,
    enter: () => {
      store().setOverlay("none");
      globeApi.current?.flyTo({ lat: 16, lng: -62, altitude: 2.35 });
    },
  },
];
