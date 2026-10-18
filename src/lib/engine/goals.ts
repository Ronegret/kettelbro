import type { GoalCompletionDoc, GoalDef, GoalProgress, ProgramState } from "./types";

/**
 * Metas y logros: se DERIVAN del estado real (nada que el usuario pueda "marcar a mano").
 * Solo se persiste el momento en que se completó cada una (GoalCompletionDoc).
 */

export const GOALS: GoalDef[] = [
  { id: "first-session", kind: "sessions", titleEs: "Primera carta", descriptionEs: "Completa tu primera sesión.", target: 1, unit: "sesión" },
  { id: "sessions-10", kind: "sessions", titleEs: "Diez cartas", descriptionEs: "Completa 10 sesiones.", target: 10, unit: "sesiones" },
  { id: "sessions-25", kind: "sessions", titleEs: "Veinticinco cartas", descriptionEs: "Completa 25 sesiones.", target: 25, unit: "sesiones" },
  { id: "sessions-50", kind: "sessions", titleEs: "Media centena", descriptionEs: "Completa 50 sesiones.", target: 50, unit: "sesiones" },
  { id: "sessions-100", kind: "sessions", titleEs: "Centenario", descriptionEs: "Completa 100 sesiones.", target: 100, unit: "sesiones" },
  { id: "streak-3", kind: "streak", titleEs: "Tres seguidos", descriptionEs: "Entrena 3 días seguidos.", target: 3, unit: "días" },
  { id: "streak-7", kind: "streak", titleEs: "Semana completa", descriptionEs: "7 días seguidos. ¡Semana completa!", target: 7, unit: "días" },
  { id: "streak-14", kind: "streak", titleEs: "Dos semanas", descriptionEs: "14 días seguidos.", target: 14, unit: "días" },
  { id: "streak-30", kind: "streak", titleEs: "Mes de hierro", descriptionEs: "30 días seguidos: el reto original.", target: 30, unit: "días" },
  { id: "streak-60", kind: "streak", titleEs: "Dos meses", descriptionEs: "60 días seguidos.", target: 60, unit: "días" },
  { id: "streak-100", kind: "streak", titleEs: "Cien días", descriptionEs: "100 días seguidos.", target: 100, unit: "días" },
  { id: "day-30", kind: "day", titleEs: "Día 30", descriptionEs: "Llega al final de tu primer mes del programa.", target: 30, unit: "días" },
  { id: "day-100", kind: "day", titleEs: "Día 100", descriptionEs: "Cien días de programa.", target: 100, unit: "días" },
  { id: "day-365", kind: "day", titleEs: "Un año", descriptionEs: "365 días de programa.", target: 365, unit: "días" },
  { id: "swings-100", kind: "swings", titleEs: "Primeros 100 swings", descriptionEs: "Suma 100 swings. Es el volumen de una sesión 'Simple'.", target: 100, unit: "swings", source: "Simple & Sinister" },
  { id: "swings-1000", kind: "swings", titleEs: "Mil swings", descriptionEs: "Suma 1.000 swings.", target: 1000, unit: "swings" },
  { id: "swings-10000", kind: "swings", titleEs: "Diez mil swings", descriptionEs: "Suma 10.000 swings.", target: 10000, unit: "swings" },
  { id: "tgu-10", kind: "benchmark", titleEs: "Diez get-ups", descriptionEs: "Suma 10 Turkish get-ups completos.", target: 10, unit: "get-ups", source: "Simple & Sinister" },
  { id: "tgu-100", kind: "benchmark", titleEs: "Cien get-ups", descriptionEs: "Suma 100 Turkish get-ups completos.", target: 100, unit: "get-ups" },
  { id: "tonnage-1000", kind: "tonnage", titleEs: "Una tonelada", descriptionEs: "Mueve 1.000 kg en total.", target: 1000, unit: "kg" },
  { id: "tonnage-10000", kind: "tonnage", titleEs: "Diez toneladas", descriptionEs: "Mueve 10.000 kg en total.", target: 10000, unit: "kg" },
  { id: "tonnage-100000", kind: "tonnage", titleEs: "Cien toneladas", descriptionEs: "Mueve 100.000 kg en total.", target: 100000, unit: "kg" },
  { id: "bell-12", kind: "bell", titleEs: "Pesa de 12", descriptionEs: "Completa una serie con 12 kg o más.", target: 12, unit: "kg" },
  { id: "bell-16", kind: "bell", titleEs: "Pesa de 16", descriptionEs: "Completa una serie con 16 kg o más.", target: 16, unit: "kg" },
  { id: "bell-24", kind: "bell", titleEs: "Pesa de 24", descriptionEs: "Completa una serie con 24 kg o más.", target: 24, unit: "kg" },
];

function value(g: GoalDef, s: ProgramState): number {
  const reps = s.exerciseReps ?? {};
  switch (g.kind) {
    case "sessions":
      return s.totals.sessions;
    case "streak":
      return s.bestStreak;
    case "day":
      return Math.max(0, s.dayIndex - 1);
    case "swings":
      return (reps["two-hand-swing"] ?? 0) + (reps["one-arm-swing"] ?? 0);
    case "tonnage":
      return s.totals.tonnageKg;
    case "bell":
      return Object.values(s.memory).reduce((m, e) => Math.max(m, e?.bestBellKg ?? 0), 0);
    case "benchmark":
      return reps["turkish-get-up"] ?? 0;
  }
}

export function evaluateGoals(state: ProgramState, completed: Record<string, number> = {}): GoalProgress[] {
  return GOALS.map((g) => {
    const v = value(g, state);
    const done = v >= g.target;
    const at = completed[g.id];
    return { ...g, progress: Math.min(v, g.target), done, ...(at !== undefined ? { completedAt: at } : {}) };
  });
}

/** Metas que se cumplen con `next` y no estaban ya registradas como completas. */
export function newlyCompleted(next: ProgramState, alreadyDone: string[], now: number): GoalCompletionDoc[] {
  const have = new Set(alreadyDone);
  return GOALS.filter((g) => !have.has(g.id) && value(g, next) >= g.target).map((g) => ({ id: g.id, completedAt: now }));
}
