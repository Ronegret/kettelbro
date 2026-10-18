import { daysSinceLast } from "./progression";
import { generateSession } from "./generator";
import type { ProgramState, SessionPlan, UserSettings } from "./types";

export * from "./types";
export * from "./calendar";
export * from "./exercises";
export * from "./steps";
export * from "./progression";
export * from "./goals";
export * from "./defaults";
export * from "./body";
export * from "./coach";
export { generateSession, focusOfDay, type GenerateInput } from "./generator";

/**
 * "Qué toca hoy": combina el estado guardado del usuario con sus ajustes y genera el plan del Día N.
 * Es determinista: llamarla dos veces el mismo día devuelve exactamente el mismo plan.
 */
export function planForToday(uid: string, state: ProgramState, settings: UserSettings, today: string): SessionPlan {
  return generateSession({
    uid,
    dayIndex: state.dayIndex,
    settings,
    memory: state.memory,
    daysSinceLast: daysSinceLast(state, today),
    lastRpe: state.lastRpe,
    lastFeel: state.lastFeel,
  });
}
