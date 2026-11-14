"use client";

import { globeApi } from "@/lib/globeApi";
import { useAppStore } from "@/store/useAppStore";

/**
 * Where the camera is, as a path: World › Caribbean › Dominican Republic › …
 * Each step takes the camera back there.
 */
export function Breadcrumb({ className = "" }: { className?: string }) {
  const trail = useAppStore((s) => s.trail);

  if (trail.length < 2) return null;

  return (
    <nav aria-label="Map position" className={`ge-crumbs ${className}`}>
      <ol className="ge-surface flex max-w-[min(34rem,calc(100vw-2.5rem))] items-center gap-x-2 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em]">
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={item.key} className={`flex items-center gap-2 ${last ? "min-w-0" : "shrink-0"}`}>
              {index > 0 && (
                <span className="text-muted/50" aria-hidden="true">
                  /
                </span>
              )}
              {last ? (
                <span className="truncate text-ink" aria-current="location">
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => globeApi.current?.navigate(item)}
                  className="rounded-sm text-muted transition-colors hover:text-accent"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
