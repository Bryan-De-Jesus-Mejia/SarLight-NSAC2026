import type { SignificanceLevel } from "@/data/types";

const BARS: Record<SignificanceLevel, number> = { low: 1, medium: 2, high: 3 };

interface SignificanceMeterProps {
  level: SignificanceLevel;
  className?: string;
}

/** Three-step meter: the level is carried by the bar count (and a label beside it), not by colour. */
export function SignificanceMeter({ level, className = "" }: SignificanceMeterProps) {
  return (
    <span className={`inline-flex items-end gap-[3px] align-baseline ${className}`} aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={`w-[4px] rounded-[1px] bg-current ${step <= BARS[level] ? "" : "opacity-25"}`}
          style={{ height: 5 + step * 3 }}
        />
      ))}
    </span>
  );
}
