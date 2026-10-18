import type { Focus, Level, MesoTheme, Phase, PrimaryGoal } from "./types";

/**
 * Estructura temporal del programa.
 *
 *  Día N  ──►  microciclo de 7 días (slot 0-6)
 *          ──►  semana  ──►  mesociclo de 4 semanas (acumular → construir → pico → DESCARGA)
 *          ──►  tema del mesociclo (fundación / fuerza / potencia / acondicionamiento) según la meta
 *
 * Fundamento: periodización con variación planificada de volumen/intensidad (Williams 2017, Rhea 2004),
 * semanas de descarga (consenso de expertos, Bell 2023) y ≥2 sesiones/semana por patrón (Currier 2026).
 */

export const MESO_WEEKS = 4;
export const MICRO_DAYS = 7;

export interface CyclePosition {
  /** Día dentro del microciclo (0-6). */
  slot: number;
  /** Semana global (0-based). */
  weekIndex: number;
  /** Semana dentro del mesociclo (1-4). */
  week: number;
  /** Número de mesociclo (1, 2, 3, ...). */
  mesocycle: number;
  phase: Phase;
  theme: MesoTheme;
}

const PHASES: Phase[] = ["accumulate", "build", "peak", "deload"];

/** Orden de temas por meta. El primer mesociclo SIEMPRE es "foundation" (técnica y base). */
const THEME_CYCLES: Record<PrimaryGoal, MesoTheme[]> = {
  balanced: ["foundation", "strength", "power", "conditioning"],
  strength: ["foundation", "strength", "power", "strength", "conditioning", "strength"],
  power: ["foundation", "power", "strength", "power", "conditioning", "power"],
  endurance: ["foundation", "conditioning", "strength", "conditioning", "power", "conditioning"],
};

export function cyclePosition(dayIndex: number, goal: PrimaryGoal): CyclePosition {
  const d = Math.max(1, Math.floor(dayIndex));
  const slot = (d - 1) % MICRO_DAYS;
  const weekIndex = Math.floor((d - 1) / MICRO_DAYS);
  const mesoIndex = Math.floor(weekIndex / MESO_WEEKS);
  const weekInMeso = weekIndex % MESO_WEEKS;
  const cycle = THEME_CYCLES[goal];
  return {
    slot,
    weekIndex,
    week: weekInMeso + 1,
    mesocycle: mesoIndex + 1,
    phase: PHASES[weekInMeso] as Phase,
    theme: cycle[mesoIndex % cycle.length] as MesoTheme,
  };
}

/**
 * Plantilla semanal (7 slots) por tema. Reglas de diseño:
 *  - 5 días de trabajo + 2 de recuperación activa (slots 3 y 6 casi siempre).
 *  - Los días de potencia nunca son consecutivos (el tren posterior necesita ~48 h entre balísticos de máxima calidad).
 *  - Los patrones básicos (bisagra, sentadilla, empuje, tirón, acarreo) se reparten a lo largo de la semana.
 */
const WEEK_TEMPLATES: Record<MesoTheme, Focus[]> = {
  foundation: ["skill", "strength", "endurance", "recovery", "power", "strength", "recovery"],
  strength: ["strength", "power", "recovery", "strength", "endurance", "skill", "recovery"],
  power: ["power", "strength", "recovery", "power", "hybrid", "endurance", "recovery"],
  conditioning: ["endurance", "strength", "recovery", "hybrid", "power", "endurance", "recovery"],
};

export function focusFor(pos: CyclePosition, level: Level): Focus {
  const focus = WEEK_TEMPLATES[pos.theme][pos.slot] as Focus;
  // El nivel principiante no hace complejos ni los combina con fatiga: se sustituye por técnica.
  if (level === "novice" && focus === "hybrid") return "skill";
  // Semana de descarga: el día más duro de la semana pasa a técnica (menos estrés, mismo contacto con el patrón).
  if (pos.phase === "deload" && pos.slot === 0 && focus !== "recovery") return "skill";
  return focus;
}

/**
 * Los principiantes "se gradúan" a intermedio tras 6 semanas de práctica (42 días): regla de coaching
 * para desbloquear ejercicios balísticos con una base de técnica construida.
 */
export function effectiveLevel(level: Level, dayIndex: number): Level {
  if (level === "novice" && dayIndex > 42) return "intermediate";
  return level;
}

export const PHASE_LABEL_ES: Record<Phase, string> = {
  accumulate: "Acumulación",
  build: "Construcción",
  peak: "Pico",
  deload: "Descarga",
};

export const THEME_LABEL_ES: Record<MesoTheme, string> = {
  foundation: "Fundación",
  strength: "Fuerza",
  power: "Potencia",
  conditioning: "Acondicionamiento",
};

export const FOCUS_LABEL_ES: Record<Focus, string> = {
  power: "Potencia",
  strength: "Fuerza",
  endurance: "Resistencia",
  hybrid: "Híbrido",
  skill: "Técnica",
  recovery: "Recuperación",
};

/** Días calendario entre dos claves YYYY-MM-DD (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number) as [number, number, number];
  const [by, bm, bd] = b.split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}
