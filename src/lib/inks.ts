import type { Focus } from "@/lib/engine/types";

/** Espejo en hex de las tintas de globals.css, para dibujar en canvas / SVG exportado (no resuelven var()). */
export const INKS: Record<Focus, { ink: string; on: string; lift: string; deep: string }> = {
  power: { ink: "#f2432d", on: "#0b0e14", lift: "#ff7a62", deep: "#8f1d10" },
  strength: { ink: "#2a4de8", on: "#f4f6fa", lift: "#7d96ff", deep: "#14257f" },
  endurance: { ink: "#00a878", on: "#0b1a26", lift: "#3fdcae", deep: "#00583f" },
  hybrid: { ink: "#ffb41f", on: "#1a1230", lift: "#ffd067", deep: "#8a5a00" },
  skill: { ink: "#ff5fa2", on: "#2a0b1d", lift: "#ff9ac4", deep: "#8f1f58" },
  recovery: { ink: "#4fc9e8", on: "#0a1f2a", lift: "#8fe0f3", deep: "#1b6d85" },
};

export const NIGHT = "#0b0e14";
export const PAPER = "#f4f6fa";
