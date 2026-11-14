"use client";

import { useRef } from "react";
import { formatDate } from "@/lib/format";
import { useAppStore } from "@/store/useAppStore";

const MIN = 0.04;
const MAX = 0.96;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

/**
 * The draggable line of the before/after curtain. The split itself happens in
 * the map shader; this only moves the number the shader reads.
 */
export function Curtain() {
  const on = useAppStore((s) => s.compare && s.overlay !== "none");
  const position = useAppStore((s) => s.curtain);
  const before = useAppStore((s) => s.compareBefore);
  const after = useAppStore((s) => s.overlayDate);
  const setPosition = useAppStore((s) => s.setCurtain);
  const root = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  if (!on) return null;

  const moveTo = (clientX: number) => {
    const rect = root.current?.getBoundingClientRect();
    if (rect && rect.width > 0) setPosition(clamp((clientX - rect.left) / rect.width));
  };

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-[8]">
      <div className="absolute inset-y-0 w-px bg-white/80 shadow-[0_0_12px_rgb(255_255_255/0.6)]" style={{ left: `${position * 100}%` }}>
        <span className="ge-curtain-tag right-3">{before ? formatDate(before) : "Satellite"}</span>
        <span className="ge-curtain-tag left-3">{formatDate(after)}</span>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Before and after curtain"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position * 100)}
          className="ge-curtain-handle pointer-events-auto"
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.stopPropagation();
          }}
          onPointerMove={(event) => dragging.current && moveTo(event.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setPosition(clamp(position - 0.03));
            else if (event.key === "ArrowRight") setPosition(clamp(position + 0.03));
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
