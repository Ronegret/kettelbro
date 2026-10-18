"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Interruptor estándar (role="switch") con etiqueta y descripción. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  tone = "default",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  tone?: "default" | "warn";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="press flex w-full items-center gap-4 rounded-[16px] bg-night-2 px-4 py-3.5 text-left"
    >
      <span className="flex-1">
        <span className="block text-[16px] font-medium leading-snug">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-paper-dim">{description}</span>}
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? (tone === "warn" ? "bg-[#ff5f6d]" : "bg-ink") : "bg-night-3"
        }`}
        aria-hidden="true"
      >
        <span
          className="absolute top-1 h-6 w-6 rounded-full bg-paper shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-[var(--ease-snap)]"
          style={{ transform: `translateX(${checked ? 28 : 4}px)` }}
        />
      </span>
    </button>
  );
}

/** Tarjeta-opción de selección única (role="radio"). */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`press flex w-full items-start gap-3 rounded-[16px] border-2 px-4 py-3.5 text-left transition-colors duration-150 ${
        selected ? "border-ink bg-ink/15" : "border-transparent bg-night-2"
      }`}
    >
      <span
        className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
          selected ? "border-ink bg-ink text-on-ink" : "border-paper-mute"
        }`}
        aria-hidden="true"
      >
        {selected && <Icon name="check" size={14} strokeWidth={3.2} />}
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="font-slab text-[19px] leading-tight">{title}</span>
          {badge && <span className="rounded-full bg-ink px-2 py-0.5 font-num text-[14px] font-bold caps text-on-ink">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-[14.5px] leading-snug text-paper-dim">{description}</span>
      </span>
    </button>
  );
}

/** Chip alternable (selección múltiple). */
export function ToggleChip({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={`press h-12 min-w-[64px] rounded-[14px] border-2 px-3 font-num text-[17px] font-bold ${
        on ? "border-ink bg-ink text-on-ink" : "border-seam bg-night-2 text-paper-dim"
      }`}
    >
      {children}
    </button>
  );
}
