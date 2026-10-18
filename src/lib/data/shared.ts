/**
 * Lógica de datos COMPARTIDA por las dos implementaciones de `Repository`
 * (Firestore y localStorage). Al ser funciones puras, ambas se comportan igual
 * (ids de sesión, récords personales, saneado) y se pueden probar sin red.
 */
import type { ExerciseId, GoalCompletionDoc, SessionLog } from "@/lib/engine/types";
import type { PersonalRecord } from "./repository";

// ───────────────────────── Saneado ─────────────────────────

/**
 * Devuelve una copia profunda SIN propiedades `undefined` (Firestore las rechaza con
 * "Unsupported field value: undefined"). Los `null` se conservan: son valores válidos.
 *  - En arrays, los `undefined` se descartan (Firestore tampoco los admite ahí).
 *  - Los objetos que no son planos (FieldValue, Timestamp, Date...) se dejan intactos.
 */
export function stripUndefined<T>(value: T): T {
  return strip(value) as T;
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map(strip);
  }
  if (value !== null && typeof value === "object") {
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = strip(item);
    }
    return out;
  }
  return value;
}

// ───────────────────────── Identificadores ─────────────────────────

/**
 * Id de documento de una sesión. Se DERIVA de los datos (día + inicio), no se genera al azar:
 * así reintentar `completeSession` con el mismo log escribe el MISMO documento (idempotente).
 */
export function sessionDocId(log: Pick<SessionLog, "dayIndex" | "startedAt">): string {
  return `s${log.dayIndex}-${log.startedAt}`;
}

// ───────────────────────── Récords personales ─────────────────────────

/** ¿`candidate` mejora a `current`? Primero pesa más alta; a igual pesa, más repeticiones. */
export function isBetterRecord(
  candidate: Pick<PersonalRecord, "bellKg" | "reps">,
  current: Pick<PersonalRecord, "bellKg" | "reps"> | undefined,
): boolean {
  if (!current) return true;
  if (candidate.bellKg !== current.bellKg) return candidate.bellKg > current.bellKg;
  return candidate.reps > current.reps;
}

/**
 * Mejor serie de CADA ejercicio dentro de la sesión (criterio: pesa y luego repeticiones).
 * Ignora series saltadas, sin repeticiones (acarreos por tiempo) o sin carga.
 */
export function bestSetPerExercise(log: SessionLog): Map<ExerciseId, PersonalRecord> {
  const best = new Map<ExerciseId, PersonalRecord>();
  for (const set of log.sets) {
    if (set.skipped || set.reps <= 0 || set.bellKg <= 0) continue;
    const candidate: PersonalRecord = {
      exerciseId: set.exerciseId,
      bellKg: set.bellKg,
      reps: set.reps,
      dayIndex: log.dayIndex,
      date: log.date,
    };
    if (isBetterRecord(candidate, best.get(set.exerciseId))) best.set(set.exerciseId, candidate);
  }
  return best;
}

/** De los candidatos de la sesión, solo los que SUPERAN al récord existente (o no tenían récord). */
export function improvedRecords(
  candidates: ReadonlyMap<ExerciseId, PersonalRecord>,
  existing: ReadonlyMap<ExerciseId, PersonalRecord>,
): PersonalRecord[] {
  const result: PersonalRecord[] = [];
  for (const [exerciseId, candidate] of candidates) {
    if (isBetterRecord(candidate, existing.get(exerciseId))) result.push(candidate);
  }
  return result;
}

/** Metas sin ids repetidos (la primera aparición gana). */
export function dedupeGoals(goals: readonly GoalCompletionDoc[]): GoalCompletionDoc[] {
  const seen = new Set<string>();
  const out: GoalCompletionDoc[] = [];
  for (const goal of goals) {
    if (seen.has(goal.id)) continue;
    seen.add(goal.id);
    out.push({ id: goal.id, completedAt: goal.completedAt });
  }
  return out;
}

// ───────────────────────── Errores ─────────────────────────

/** Mensaje en español para un error de datos (Firestore o local). */
export function describeDataError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code.includes("permission-denied")) {
    return "No tienes permiso para guardar o leer estos datos. Cierra sesión y vuelve a entrar.";
  }
  if (code.includes("unavailable") || code.includes("network")) {
    return "Sin conexión con el servidor. Tus cambios se sincronizarán cuando vuelva internet.";
  }
  if (code.includes("already-exists")) {
    return "Esta sesión ya estaba guardada.";
  }
  if (code.includes("resource-exhausted")) {
    return "Se alcanzó el límite de uso del servidor. Inténtalo más tarde.";
  }
  if (error instanceof Error && error.message.includes("no está configurado")) {
    return error.message;
  }
  return "No se pudieron cargar o guardar tus datos. Inténtalo de nuevo.";
}
