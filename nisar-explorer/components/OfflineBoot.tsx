"use client";

import { useEffect } from "react";
import { keepEssentials, keepLoadedFiles, registerWorker, supported } from "@/lib/offline";
import { useOfflineStore } from "@/store/useOfflineStore";

/**
 * Registers the service worker, follows the connection and, once the page has settled,
 * keeps the app's own files and a coarse world map (about 0.2 MB) so the site can open offline.
 * Nothing bigger is stored unless the visitor asks for it in "Work offline".
 */
export function OfflineBoot() {
  const setOnline = useOfflineStore((s) => s.setOnline);
  const refresh = useOfflineStore((s) => s.refresh);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    refresh();

    let timers: number[] = [];
    if (supported() && process.env.NODE_ENV === "production") {
      void registerWorker().then(() => {
        // The globe and its chunks load a few seconds after the page does.
        timers = [
          window.setTimeout(() => void keepLoadedFiles(), 6000),
          window.setTimeout(() => void keepLoadedFiles().then(keepEssentials).then(refresh).catch(() => undefined), 14000),
        ];
      });
    }
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [setOnline, refresh]);

  return null;
}
