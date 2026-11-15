import { msg } from "@/i18n/core";
import { globeApi } from "@/lib/globeApi";
import { CARIBBEAN_VIEW, caribbeanItem, worldItem } from "@/lib/trail";
import { useAppStore } from "@/store/useAppStore";
import { useChatStore } from "@/store/useChatStore";

/**
 * The tutorial: how to use SarLight, one control at a time. Each step can set
 * the scene (open a case, open a dock panel, move the camera) and points at a
 * control marked in the interface with data-tour="…". The visitor moves on at
 * their own pace; nothing advances by itself.
 *
 * The texts are English sentences marked with msg(); the tutorial card
 * translates them with t() when it draws them.
 */

export interface TutorialStep {
  kicker: string;
  title: string;
  body: string;
  /** data-tour value of the control to point at; none for steps about the globe itself. */
  target?: string;
  enter?: () => void;
}

const store = () => useAppStore.getState();
const CASE_ID = "capotillo-flood";

/** Close what a previous step opened, so every step starts from a clean screen. */
function clear(keepCase = false) {
  const s = store();
  s.closeDock();
  s.setCommunity(false);
  s.setLens(false);
  useChatStore.getState().closeChat();
  if (!keepCase && s.selectedId) s.select(null);
}

function openCase() {
  clear(true);
  if (store().selectedId !== CASE_ID) globeApi.current?.focusCase(CASE_ID);
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    kicker: msg("How to use SarLight"),
    title: msg("A quick tour of the controls"),
    body: msg("In a minute you will know what every button does. Go at your own pace with Next and Back, or the arrow keys; Esc closes the tour."),
    enter: () => {
      clear();
      globeApi.current?.flyTo({ lat: 18, lng: -70, altitude: 2.4 });
    },
  },
  {
    kicker: msg("The globe"),
    title: msg("Drag, zoom, click"),
    body: msg("Drag to turn the planet and scroll (or pinch) to zoom. Click a country or a province to fly to it."),
    enter: () => {
      clear();
      globeApi.current?.flyTo(CARIBBEAN_VIEW, [worldItem, caribbeanItem]);
    },
  },
  {
    kicker: msg("The markers"),
    title: msg("Each marker is a place we analysed"),
    body: msg("Its icon and colour say what changed: water, fire, ice, crops, ground. Click one to open what the radar saw there."),
    enter: () => {
      clear();
      globeApi.current?.openCountry("DOM");
    },
  },
  {
    kicker: msg("A case"),
    title: msg("What happened, in plain words"),
    body: msg("The panel shows the figures, why it happened, who lives there and what to do. Scroll down to read it all; the cross closes it."),
    target: "case",
    enter: openCase,
  },
  {
    kicker: msg("Stories"),
    title: msg("Let the case tell itself"),
    body: msg("Tell me the story walks you through the case on the globe, step by step, with a Why? button that explains the science at each step."),
    target: "story",
    enter: openCase,
  },
  {
    kicker: msg("Simple or technical"),
    title: msg("The same data for every reader"),
    body: msg("The simple view uses everyday words. The technical view adds every number and method: thresholds, polarisations, baselines."),
    target: "view",
    enter: () => clear(),
  },
  {
    kicker: msg("Search"),
    title: msg("Find a place or a kind of change"),
    body: msg("Type a town, a country or a word like flood or glacier, and the globe keeps only what matches."),
    target: "search",
    enter: () => clear(),
  },
  {
    kicker: msg("Your community"),
    title: msg("Is my community at risk?"),
    body: msg("Use your location or tap your place on the globe to see what our radar found nearby, how many people live there and what to do."),
    target: "community",
    enter: () => clear(),
  },
  {
    kicker: msg("Signals and ranking"),
    title: msg("Filter, then compare"),
    body: msg("Pick one or more kinds of change to filter the globe. Below, every place is ranked by how much land changed."),
    target: "legend",
    enter: () => {
      clear();
      store().setDock("legend", true);
    },
  },
  {
    kicker: msg("Cloud lens"),
    title: msg("See under the clouds"),
    body: msg("Turn on the lens and move the pointer over the globe: inside the circle the clouds lift and the ground shows, the way NISAR’s radar sees it."),
    target: "lens",
    enter: () => clear(),
  },
  {
    kicker: msg("Timeline"),
    title: msg("Choose a period"),
    body: msg("Drag the two handles to mark where the period starts and ends: the globe keeps only what happened inside it. Play runs through it day by day; Show all goes back to the start."),
    target: "timeline",
    enter: () => {
      clear();
      store().setDock("timeline", true);
    },
  },
  {
    kicker: msg("The assistant"),
    title: msg("Ask in your own words"),
    body: msg("This button opens the AI assistant. Ask about a place, a kind of change or how the radar works, in Spanish or English: its answers come from our analyses. Press it again, or Esc, to close it."),
    target: "assistant",
    enter: () => clear(),
  },
  {
    kicker: msg("The menu"),
    title: msg("Everything else lives here"),
    body: msg("The next NISAR pass over a place, the satellite’s 12-day dance, cases for offline use, study mode, the methods, the language and this tour."),
    target: "menu",
    enter: () => clear(),
  },
  {
    kicker: msg("Your turn"),
    title: msg("Now explore"),
    body: msg("Start with a place you know. The figures come from real radar images processed by our team, not yet verified on the ground."),
    enter: () => {
      clear();
      globeApi.current?.flyTo({ lat: 16, lng: -62, altitude: 2.35 });
    },
  },
];
