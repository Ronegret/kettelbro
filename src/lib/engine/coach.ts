import { bmi, currentWeight } from "./body";
import type { UserSettings } from "./types";

/**
 * EL PREPARADOR: cómo se adapta el plan a cada persona según su nivel, su peso y su estatura. Todo puro.
 *
 * HONESTIDAD: son heurísticas de coaching, no resultados de un estudio. Se apoyan en principios aceptados: progresión
 * gradual al empezar, más descanso entre series cuando se empieza o la carga relativa es alta, y menos impacto articular
 * con un IMC alto (ACSM). El IMC aquí es solo un número de cálculo para dosificar; no es un diagnóstico. La autorregulación
 * por esfuerzo (RPE) corrige después cualquier desajuste.
 */

export type BodyBand = "low" | "normal" | "over" | "high";

export interface BodyRead {
  bmi: number;
  band: BodyBand;
  weightKg: number;
  heightCm: number;
}

/** IMC de la persona a partir del último pesaje y la estatura (null si no los dio). */
export function bodyRead(settings: UserSettings): BodyRead | null {
  const body = settings.body;
  const weightKg = currentWeight(body);
  if (!body || weightKg === null) return null;
  const value = bmi(weightKg, body.heightCm);
  const band: BodyBand = value < 18.5 ? "low" : value < 25 ? "normal" : value < 30 ? "over" : "high";
  return { bmi: Math.round(value * 10) / 10, band, weightKg, heightCm: body.heightCm };
}

export type IntroStage = "learn" | "base" | "build" | "consolidate";

export interface Coaching {
  /** Semana de iniciación (1-6) si aún aplica la rampa; 0 si ya no. */
  introWeek: number;
  stage: IntroStage | null;
  /** Tope del esfuerzo objetivo (1-10) en estas semanas; null = sin tope. */
  rpeCap: number | null;
  /** Multiplica el volumen (≤ 1). */
  fill: number;
  /** Multiplica los descansos entre series (≥ 1). */
  restMult: number;
  /** Sin ejercicios balísticos (swing, cargada, arranque, tirón alto): carga relativa alta al empezar. */
  lowImpact: boolean;
  /** Primer día en que entran los swings para un principiante. */
  swingFromDay: number;
  /** Primeras semanas: lo que sobra de tiempo se llena con técnica y movilidad, no con más series. */
  gentle: boolean;
  band: BodyBand | null;
  /** Qué se hizo a tu medida, en español, para enseñárselo a la persona. */
  notesEs: string[];
}

/** Rampa de iniciación del principiante, por semana de programa (1-6): esfuerzo máximo, volumen y descanso. */
const NOVICE_RAMP: ReadonlyArray<{ stage: IntroStage; rpe: number; fill: number; rest: number }> = [
  { stage: "learn", rpe: 4.5, fill: 0.7, rest: 1.25 },
  { stage: "base", rpe: 5, fill: 0.8, rest: 1.15 },
  { stage: "build", rpe: 5.5, fill: 0.9, rest: 1.08 },
  { stage: "consolidate", rpe: 5.5, fill: 1, rest: 1 }, // la semana 4 ya es la descarga del ciclo
  { stage: "build", rpe: 5.5, fill: 0.95, rest: 1.05 },
  { stage: "build", rpe: 6, fill: 1, rest: 1 },
];

/** Quien ya entrenaba solo necesita una semana para calibrar las pesas. */
const CALIBRATION = { stage: "base" as IntroStage, rpe: 6.5, fill: 0.9, rest: 1.05 };

const BAND_RULES: Record<BodyBand, { fill: number; rest: number }> = {
  low: { fill: 0.95, rest: 1.15 },
  normal: { fill: 1, rest: 1 },
  over: { fill: 0.95, rest: 1.08 },
  high: { fill: 0.88, rest: 1.2 },
};

/** Días con bajo impacto cuando el IMC es alto (las primeras 4 semanas). */
const LOW_IMPACT_DAYS = 28;
const SWING_FROM_DAY = 15;
const SWING_FROM_DAY_LOW_IMPACT = 29;

export function coachingFor(settings: UserSettings, dayIndex: number): Coaching {
  const week = Math.max(1, Math.ceil(dayIndex / 7));
  const read = bodyRead(settings);
  const band = read?.band ?? null;
  const rules = band ? BAND_RULES[band] : BAND_RULES.normal;
  const novice = settings.level === "novice";

  const step = novice ? (NOVICE_RAMP[week - 1] ?? null) : settings.level === "intermediate" && week === 1 ? CALIBRATION : null;
  const lowImpact = band === "high" && dayIndex <= LOW_IMPACT_DAYS;
  const swingFromDay = novice && band === "high" ? SWING_FROM_DAY_LOW_IMPACT : SWING_FROM_DAY;
  const fill = (step?.fill ?? 1) * rules.fill;
  const restMult = (step?.rest ?? 1) * rules.rest;

  const notesEs: string[] = [];
  if (novice && step && week <= 3) {
    const name = step.stage === "learn" ? "aprende" : step.stage === "base" ? "base" : "construye";
    notesEs.push(`Semana ${week} de iniciación (${name}): esfuerzo suave, como máximo ${String(step.rpe).replace(".", ",")} de 10, y descansos más largos para aprender el movimiento sin agobio.`);
  } else if (!novice && step) {
    notesEs.push("Primera semana: esfuerzo algo más suave para calibrar tus pesas; desde la segunda semana entras a tu ritmo normal.");
  }
  if (read && band === "high" && lowImpact) {
    notesEs.push(`Con tu estatura y peso (IMC ${String(read.bmi).replace(".", ",")}) cuidamos las articulaciones: sin ejercicios balísticos las primeras 4 semanas y descansos algo más largos.`);
  } else if (read && band === "over") {
    notesEs.push(`Con tu estatura y peso (IMC ${String(read.bmi).replace(".", ",")}) damos un poco más de descanso entre series y subimos el volumen despacio.`);
  } else if (read && band === "low") {
    notesEs.push(`Con tu estatura y peso (IMC ${String(read.bmi).replace(".", ",")}) priorizamos fuerza con descansos más largos y menos volumen de resistencia.`);
  }

  return {
    introWeek: step ? week : 0,
    stage: step?.stage ?? null,
    rpeCap: step?.rpe ?? null,
    fill: Math.round(fill * 100) / 100,
    restMult: Math.round(restMult * 100) / 100,
    lowImpact,
    swingFromDay,
    gentle: novice && week <= 2,
    band,
    notesEs,
  };
}

export interface PathStep {
  week: number;
  nameEs: string;
  /** Esfuerzo objetivo en palabras: «4-5 de 10». */
  effortEs: string;
  textEs: string;
}

/**
 * El camino de las primeras 4 semanas para un principiante, para enseñárselo (null = no aplica a su nivel).
 * Las cifras salen de la misma tabla que usa el generador.
 */
export function introPath(settings: UserSettings): PathStep[] | null {
  if (settings.level !== "novice") return null;
  const swing = coachingFor(settings, 1).swingFromDay;
  const swingWeek = Math.ceil(swing / 7);
  const e = (w: number) => {
    const hi = NOVICE_RAMP[w - 1]?.rpe ?? 5;
    return `${String(hi - 0.5).replace(".", ",")}-${String(hi).replace(".", ",")} de 10`;
  };
  return [
    { week: 1, nameEs: "Aprende", effortEs: e(1), textEs: "Movimientos básicos y sencillos, con descansos largos. Si algo cuesta, se hace más ligero." },
    { week: 2, nameEs: "Base", effortEs: e(2), textEs: "Los mismos patrones con un poco más de trabajo y menos pausa." },
    {
      week: 3,
      nameEs: "Construye",
      effortEs: e(3),
      textEs: swingWeek <= 3 ? "Suben las series y entran los swings, en pocas repeticiones." : "Suben las series. Los swings llegan más adelante, sin prisa.",
    },
    { week: 4, nameEs: "Descarga", effortEs: e(4), textEs: swingWeek <= 4 ? "Semana suave para asentar lo aprendido; los swings siguen en rampa." : "Semana suave para asentar lo aprendido. Después entran los swings." },
  ];
}

/** Tope de esfuerzo de cada semana de iniciación (para pruebas). */
export const NOVICE_RPE_CAPS = NOVICE_RAMP.map((r) => r.rpe);
