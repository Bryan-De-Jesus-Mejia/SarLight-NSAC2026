"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { usePopover } from "@/hooks/usePopover";

export interface SelectOption<V extends string> {
  value: V;
  /** Full name, shown in the list. */
  label: string;
  /** What the trigger shows when this option is chosen (defaults to the label). */
  short?: string;
  /** One line under the label in the list. */
  hint?: string;
  icon?: ReactNode;
}

interface SelectProps<V extends string> {
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  /** Accessible name of the control. */
  label: string;
  /** Icon in front of the value on the trigger. Defaults to the chosen option's icon. */
  icon?: ReactNode;
  className?: string;
  /** Which edge of the trigger the list lines up with. */
  align?: "left" | "right";
  /** Width of the list, as a CSS length. */
  menuWidth?: string;
}

/**
 * A listbox that looks like the rest of the interface instead of the system's.
 * Keyboard: Enter / Space / arrows open it, arrows move, Enter chooses, Escape
 * and Tab close it, letters jump to a match. The list eases in.
 */
export function Select<V extends string>({
  value,
  options,
  onChange,
  label,
  icon,
  className = "",
  align = "right",
  menuWidth = "14rem",
}: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const [active, setActive] = useState(selectedIndex);
  const listId = useId();
  const typed = useRef({ text: "", at: 0 });
  const close = useCallback(() => setOpen(false), []);
  const ref = usePopover(close, open);
  const listRef = useRef<HTMLUListElement | null>(null);

  const chosen = options[selectedIndex];

  // Keep the highlighted row in view when the list is long.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        show();
      }
      return;
    }
    if (key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (key === "End") {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Typeahead: letters typed in quick succession build one prefix.
      const now = Date.now();
      const text = (now - typed.current.at > 700 ? "" : typed.current.text) + key.toLowerCase();
      typed.current = { text, at: now };
      const from = text.length === 1 ? active + 1 : active;
      for (let step = 0; step < options.length; step += 1) {
        const index = (from + step) % options.length;
        if (options[index].label.toLowerCase().startsWith(text)) {
          setActive(index);
          break;
        }
      }
    }
  };

  return (
    <div ref={ref} className={`pointer-events-auto relative shrink-0 ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        className="ge-ctl ge-select-trigger inline-flex"
        data-open={open}
      >
        <span className="shrink-0 text-muted">{icon ?? chosen?.icon}</span>
        <span className="truncate">{chosen?.short ?? chosen?.label}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="ge-select-chevron shrink-0 text-muted" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          // Keep focus on the trigger while the pointer works the list.
          onMouseDown={(e) => e.preventDefault()}
          style={{ width: menuWidth }}
          className={`ge-pop ge-menu-surface absolute top-[calc(100%+0.5rem)] z-40 max-h-80 overflow-y-auto p-1.5 ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"}`}
        >
          {options.map((option, i) => {
            const selected = option.value === value;
            return (
              <li
                key={option.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                data-active={i === active}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                style={{ animationDelay: `${i * 28}ms` }}
                className="ge-option"
              >
                {option.icon && <span className="mt-0.5 shrink-0 text-muted">{option.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{option.label}</span>
                  {option.hint && <span className="mt-0.5 block text-xs leading-snug text-muted">{option.hint}</span>}
                </span>
                {selected && (
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-accent" aria-hidden="true">
                    <path d="m5 12.500 4.500 4.500L19 7.500" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
