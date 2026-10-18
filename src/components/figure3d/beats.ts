import type { ExerciseId } from "@/lib/engine/types";

/**
 * Las tres fases de cada repetición, en palabras cortas y en el orden en que ocurren. Se reparten a partes iguales a lo
 * largo del clip: son una guía de ritmo, no un cronómetro exacto. Dicen lo que SÍ hay que hacer (la técnica correcta),
 * incluidos los fallos más típicos de cada ejercicio dados la vuelta («codos cerca», «cabeza quieta»).
 */
export const BEATS: Readonly<Record<ExerciseId, readonly [string, string, string]>> = {
  "kettlebell-deadlift": ["Cadera atrás", "Empuja el suelo", "De pie, glúteos fuertes"],
  "two-hand-swing": ["Pesa atrás", "La cadera dispara", "La pesa flota"],
  "one-arm-swing": ["Pesa atrás", "La cadera dispara", "La pesa flota"],
  "single-leg-rdl": ["Pierna atrás", "Baja, espalda larga", "Sube apretando"],
  "hip-bridge": ["Pies firmes", "Sube la cadera", "Aprieta y baja"],
  "goblet-squat": ["Pesa al pecho", "Baja, rodillas afuera", "Empuja el suelo"],
  "prying-goblet-squat": ["Baja", "Abre con los codos", "Sube"],
  "front-squat": ["Pesa en el rack", "Baja erguido", "Sube"],
  "reverse-lunge-racked": ["Pesa en el rack", "Paso atrás y baja", "Vuelve arriba"],
  "strict-press": ["Pesa al hombro", "Empuja arriba", "Baja controlando"],
  "push-press": ["Flexiona", "Impulso de piernas", "Bloquea arriba"],
  "floor-press": ["Codo al suelo", "Empuja arriba", "Baja"],
  "half-kneeling-press": ["Rodilla abajo", "Empuja arriba", "Baja al hombro"],
  "bottom-up-press": ["Pesa al revés", "Empuja vertical", "Baja"],
  "one-arm-row": ["Espalda plana", "Codo al bolsillo", "Baja"],
  "high-pull": ["Cadera atrás", "Codo alto", "Vuelve"],
  clean: ["Cadera atrás", "Tira de la pesa", "Recíbela al pecho"],
  snatch: ["Cadera atrás", "Tira arriba", "Bloquea arriba"],
  "clean-and-press": ["Cargada al pecho", "Press arriba", "Baja"],
  "turkish-get-up": ["Del suelo al codo", "Puente y rodilla", "De pie y vuelve"],
  windmill: ["Pesa arriba", "Cadera atrás y baja", "Sube empujando"],
  halo: ["Pesa al pecho", "Rodea la cabeza", "Vuelve al pecho"],
  "arm-bar": ["Pesa vertical", "Rueda de lado", "Vuelve"],
  "figure-8": ["Bajo la pierna", "Cambia de mano", "Rodea la otra"],
  "suitcase-carry": ["Pesa firme", "Camina erguido", "Hombros nivelados"],
  "rack-carry": ["Pesa en el rack", "Camina erguido", "Costillas abajo"],
  "farmer-carry": ["Pesas firmes", "Camina erguido", "Hombros atrás"],
  "bottom-up-carry": ["Pesa al revés", "Camina erguido", "Muñeca recta"],
  "waiter-carry": ["Pesa arriba", "Camina erguido", "Brazo bloqueado"],
};
