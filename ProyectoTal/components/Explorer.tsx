"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { Curtain } from "@/components/Curtain";
import { DemoPlayer } from "@/components/DemoPlayer";
import { Hud } from "@/components/Hud";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PassDance } from "@/components/PassDance";
import { Story } from "@/components/Story";
import { Welcome } from "@/components/Welcome";
import { Community } from "@/components/Community";
import { CasePanel } from "@/components/panel/CasePanel";
import { useAppStore } from "@/store/useAppStore";

// The globe needs WebGL and `window`: client only.
const GlobeScene = dynamic(() => import("@/components/globe/GlobeScene"), { ssr: false });

export function Explorer() {
  const status = useAppStore((s) => s.status);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const globeReady = useAppStore((s) => s.globeReady);
  const loadEvents = useAppStore((s) => s.loadEvents);
  const focused = useAppStore((s) => s.selectedId !== null);

  useEffect(() => {
    if (useAppStore.getState().status === "idle") void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("ge-audience") === "technical") {
        useAppStore.setState({ audience: "technical" });
      }
    } catch {
      // No storage available: stay on the general view.
    }
  }, []);

  // ?demo starts the guided demo as soon as the globe is up (handy for recording).
  useEffect(() => {
    if (status !== "ready" || !globeReady) return;
    if (!new URLSearchParams(window.location.search).has("demo")) return;
    const timer = setTimeout(() => useAppStore.getState().startDemo(), 1200);
    return () => clearTimeout(timer);
  }, [status, globeReady]);

  // ?case=<id> opens that case; the address follows the open case so it can be shared.
  const selectedId = useAppStore((s) => s.selectedId);
  const storyOn = useAppStore((s) => s.story);
  const linkedRef = useRef(false);
  useEffect(() => {
    if (status !== "ready" || !globeReady || linkedRef.current) return;
    linkedRef.current = true;
    // ?story=<id> opens the case straight in story mode.
    const params = new URLSearchParams(window.location.search);
    const storyId = params.get("story");
    const id = storyId ?? params.get("case");
    if (id && useAppStore.getState().events.some((e) => e.id === id)) {
      const timer = setTimeout(() => {
        useAppStore.getState().select(id);
        if (storyId) useAppStore.getState().setStory(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [status, globeReady]);
  useEffect(() => {
    if (!linkedRef.current) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("case");
    url.searchParams.delete("story");
    if (selectedId) url.searchParams.set(storyOn ? "story" : "case", selectedId);
    window.history.replaceState(null, "", url);
  }, [selectedId, storyOn]);

  const failed = status === "error";
  const loaded = (status === "ready" && globeReady) || failed;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-void">
      <div className="absolute inset-0">
        <GlobeScene />
      </div>
      <div className="ge-vignette" data-focus={focused ? "" : undefined} aria-hidden="true" />

      <Curtain />
      <Hud />
      <DemoPlayer />
      <PassDance />
      <Story />
      <Welcome />
      <Community />
      <CasePanel />
      <ChatPanel />

      {failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
          <div className="glass w-full max-w-sm rounded-2xl p-6" role="alert">
            <h2 className="font-display text-2xl text-ink">Change signals did not load</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadEvents()}
              className="mt-5 rounded-full border border-accent/70 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <LoadingScreen done={loaded} />
    </main>
  );
}
