import { CHANGE_TYPES } from "@/data/changeTypes";
import type { ChangeType } from "@/data/types";

interface ChangeTypeIconProps {
  type: ChangeType;
  size?: number;
  className?: string;
}

/** Decorative glyph for a change type. Inherits its colour from `currentColor`. */
export function ChangeTypeIcon({ type, size = 16, className }: ChangeTypeIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={CHANGE_TYPES[type].iconPath} />
    </svg>
  );
}
