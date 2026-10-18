import type { ExerciseId } from "@/lib/engine/types";

/**
 * Ejercicios que ya tienen clip 3D en los GLB de public/models. Sin clip, el visor reproduciría `idle` (el personaje
 * parado) mientras la pantalla dice «swing»: por eso la app usa la figura 2D hasta que el ejercicio tenga su clip.
 * Se amplía al exportar más; `__tests__/clips.test.ts` comprueba que coincide con los archivos.
 */
export const CLIPS_3D: ReadonlySet<ExerciseId> = new Set<ExerciseId>([
  "kettlebell-deadlift",
  "two-hand-swing",
  "goblet-squat",
  "one-arm-swing",
  "single-leg-rdl",
  "hip-bridge",
  "prying-goblet-squat",
  "front-squat",
  "reverse-lunge-racked",
  "strict-press",
  "push-press",
  "floor-press",
  "half-kneeling-press",
  "one-arm-row",
  "high-pull",
  "clean",
  "snatch",
  "clean-and-press",
  "bottom-up-press",
  "turkish-get-up",
  "windmill",
  "arm-bar",
  "halo",
  "figure-8",
  "suitcase-carry",
  "rack-carry",
  "farmer-carry",
  "bottom-up-carry",
  "waiter-carry",
]);

export const has3DClip = (id: ExerciseId): boolean => CLIPS_3D.has(id);
