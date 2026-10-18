import type { ExerciseId } from "@/lib/engine/types";

/**
 * Altura mínima (m) desde la que se encuadra cada ejercicio, para acercar la cámara a lo que se mueve:
 *  - tronco superior (0,78 m, justo bajo la cadera): halo y presses de pie, donde las piernas no hacen nada;
 *  - de las rodillas hacia arriba (0,32 m): acarreos, donde el cuerpo camina «en el sitio» y los pies no enseñan nada.
 * El resto se encuadra entero.
 */
const UPPER = 0.78;
const KNEES = 0.32;
export const FOCUS_MIN_Y: Partial<Record<ExerciseId, number>> = {
  halo: UPPER,
  "strict-press": UPPER,
  "bottom-up-press": UPPER,
  "suitcase-carry": KNEES,
  "rack-carry": KNEES,
  "farmer-carry": KNEES,
  "bottom-up-carry": KNEES,
  "waiter-carry": KNEES,
};

/**
 * Ejercicios en los que el CAMINO de la pesa es lo que se enseña (círculo del halo, arco del swing, ocho, molino, tirones).
 * En el resto (sentadillas, presses, remo, acarreos) el recorrido es una línea vertical delante del cuerpo y solo estorba.
 */
export const TRAIL_EXERCISES: ReadonlySet<ExerciseId> = new Set<ExerciseId>([
  "halo",
  "two-hand-swing",
  "one-arm-swing",
  "figure-8",
  "windmill",
  "clean",
  "snatch",
  "high-pull",
  "clean-and-press",
  "arm-bar",
]);

/**
 * Elevación extra de la cámara (grados) para los ejercicios cuyo recorrido es horizontal: visto casi a la altura de los ojos
 * el círculo del halo se aplana en una línea; desde arriba se lee como una elipse alrededor de la cabeza.
 */
export const ELEVATION_BONUS: Partial<Record<ExerciseId, number>> = {
  halo: 32,
  // Ejercicios en el suelo: desde casi a ras se ven aplastados; desde arriba se entiende la postura.
  "hip-bridge": 14,
  "floor-press": 14,
  "arm-bar": 12,
  "turkish-get-up": 12,
};

/** Tumbados: el disco de suelo (ancho como el cuerpo) empequeñece la figura y no aporta; el contorno ya la separa del fondo. */
const LYING: ReadonlySet<ExerciseId> = new Set<ExerciseId>(["hip-bridge", "floor-press", "arm-bar"]);
export const noGround = (id: ExerciseId): boolean => LYING.has(id) || cropY(id) !== undefined;

/** Altura mínima del encuadre de este ejercicio, o undefined si se encuadra entero. */
export const cropY = (id: ExerciseId): number | undefined => FOCUS_MIN_Y[id];
