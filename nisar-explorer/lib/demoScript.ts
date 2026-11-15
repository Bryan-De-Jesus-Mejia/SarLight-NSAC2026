import { msg } from "@/i18n/core";
import { globeApi } from "@/lib/globeApi";
import { CARIBBEAN_VIEW, caribbeanItem, worldItem } from "@/lib/trail";
import { useAppStore } from "@/store/useAppStore";

/**
 * The guided demo: a fixed sequence of scenes. Each one moves the camera,
 * switches layers and shows a caption. Scenes only call things the app already
 * does for a visitor (fly, open a case, change a layer), so the demo can never
 * show something the app cannot do on its own.
 *
 * The captions are English sentences marked with msg(); the player translates
 * them with t() when it draws them.
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
const CASE_ID = "azua-flood";

export const DEMO_SCENES: readonly DemoScene[] = [
  {
    kicker: msg("01 · The planet"),
    title: msg("Earth never holds still"),
    body: msg("Wetlands swell, glaciers slide, faults slip. A new radar satellite is watching all of it."),
    ms: 7000,
    enter: () => {
      store().setOverlay("none");
      globeApi.current?.flyTo({ lat: 18, lng: -70, altitude: 2.4 });
    },
  },
  {
    kicker: msg("02 · The instrument"),
    title: msg("A radar that sees through clouds"),
    body: msg(
      "NISAR, from NASA and ISRO, sends its own microwave pulses, day and night. Each strip is one pass of the satellite, painted in false colour.",
    ),
    ms: 9500,
    enter: () => {
      store().setOverlayDate(RADAR_DAY);
      store().setOverlay("radar");
      globeApi.current?.flyTo({ lat: 12, lng: -75, altitude: 1.9 });
    },
  },
  {
    kicker: msg("03 · Through the clouds"),
    title: msg("Same day, two ways of seeing"),
    body: msg(
      "Outside the circle: what a camera saw that day, clouds included. Inside it: the radar, which makes its own light and passes straight through.",
    ),
    ms: 10000,
    enter: () => {
      store().setOverlayDate(RADAR_DAY);
      store().setLens(true);
      globeApi.current?.flyTo({ lat: 18.6, lng: -70.4, altitude: 0.55 }, [worldItem, caribbeanItem]);
    },
  },
  {
    kicker: msg("04 · The Caribbean"),
    title: msg("Hispaniola, under the radar"),
    body: msg(
      "The satellite returns to the same ground on a fixed rhythm. Dozens of passes over the island already sit in NASA's public catalogue.",
    ),
    ms: 8000,
    enter: () => {
      store().setOverlayDate(RADAR_DAY);
      store().setOverlay("radar");
      globeApi.current?.flyTo(CARIBBEAN_VIEW, [worldItem, caribbeanItem]);
    },
  },
  {
    kicker: msg("05 · The country"),
    title: msg("Thirty-two provinces, four analysed areas"),
    body: msg("Zoom in and the map follows you: borders, provinces, and the places where the ground is changing."),
    ms: 7500,
    enter: () => globeApi.current?.openCountry("DOM"),
  },
  {
    kicker: msg("06 · A case"),
    title: msg("A real comparison: Azua"),
    body: msg(
      "Two NISAR passes twelve days apart, subtracted pixel by pixel. Calm water bounces the radar pulse away, so flooding would show up as a patch that turns dark.",
    ),
    ms: 11000,
    enter: () => {
      store().setOverlayDate(RADAR_DAY);
      store().setOverlay("radar");
      globeApi.current?.focusCase(CASE_ID);
    },
  },
  {
    kicker: msg("07 · Two ways of seeing"),
    title: msg("Eye versus radar"),
    body: msg(
      "Same place. First as a camera would see it, then as the radar does: it reads roughness and moisture, not colour.",
    ),
    ms: 10000,
    enter: () => store().setOverlay("none"),
    cues: [{ at: 4500, run: () => store().setOverlay("radar") }],
  },
  {
    kicker: msg("08 · Time"),
    title: msg("The same place, a different day"),
    body: msg(
      "Every pass is a new look. Compare dates to see what moved: water spreading, fields turning, ground shifting.",
    ),
    ms: 9500,
    enter: () => {
      store().setOverlayDate(EARLIER_DAY);
      store().setOverlay("radar");
    },
    cues: [{ at: 4500, run: () => store().setOverlayDate(RADAR_DAY) }],
  },
  {
    kicker: msg("09 · Your turn"),
    title: msg("Now explore"),
    body: msg(
      "Drag, zoom, search, switch layers. The imagery is open NASA data and the case figures come from our own radar comparisons, not yet verified on the ground.",
    ),
    ms: Infinity,
    enter: () => {
      store().setOverlay("none");
      globeApi.current?.flyTo({ lat: 16, lng: -62, altitude: 2.35 });
    },
  },
];
