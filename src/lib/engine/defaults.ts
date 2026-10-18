import { SCHEMA_VERSION } from "@/lib/config";
import type { ProgramState, SessionMinutes, UserSettings } from "./types";

/** Estado inicial de un usuario nuevo: "Día 1", sin racha, sin memoria de ejercicios. */
export function createInitialState(now: number): ProgramState {
  return {
    schemaVersion: SCHEMA_VERSION,
    dayIndex: 1,
    startedAt: now,
    lastSessionDate: null,
    streak: 0,
    bestStreak: 0,
    shields: 0,
    xp: 0,
    totals: { sessions: 0, restDays: 0, reps: 0, tonnageKg: 0, minutes: 0 },
    memory: {},
    exerciseReps: {},
    lastRpe: null,
    lastFeel: null,
  };
}

/** Ajustes por defecto antes del onboarding (el onboarding los sobrescribe). */
export function defaultSettings(): UserSettings {
  return {
    level: "novice",
    primaryGoal: "balanced",
    minutes: 20,
    bells: [8, 12, 16],
    referenceKg: 12,
    voice: true,
    sound: true,
    haptics: true,
    onboardedAt: null,
  };
}

/** Fecha local YYYY-MM-DD del dispositivo (no UTC): la racha se mide en días del usuario. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Las duraciones permitidas, de la más corta a la más larga. */
export const SESSION_MINUTES: readonly SessionMinutes[] = [10, 15, 20, 25];

/**
 * Normaliza una duración guardada: ajustes antiguos (35/45 min) o valores raros pasan a la opción permitida
 * más cercana. Las sesiones nunca pasan de 25 minutos.
 */
export function clampMinutes(m: number): SessionMinutes {
  const n = Number.isFinite(m) ? m : 20;
  return SESSION_MINUTES.reduce((best, cur) => (Math.abs(cur - n) < Math.abs(best - n) ? cur : best), 20 as SessionMinutes);
}

/** Ajustes guardados con una versión anterior (p. ej. 35 o 45 min) pasan a valores válidos hoy. */
export function normalizeSettings(s: UserSettings): UserSettings {
  const minutes = clampMinutes(s.minutes);
  return minutes === s.minutes ? s : { ...s, minutes };
}
