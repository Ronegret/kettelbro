import { daysBetween } from "./calendar";
import { localDateKey } from "./defaults";
import type { BodyProfile, Level, UserSettings, WeightEntry } from "./types";

/**
 * Cuerpo, pesas y pesajes. Todo puro.
 *
 * IMPORTANTE (honestidad): la recomendación de pesas es una HEURÍSTICA DE COACHING (porcentaje del peso corporal
 * ajustado por estatura y nivel), anclada en rangos de partida publicados por StrongFirst y Dan John y en el
 * reparto de tallas comerciales. NO sale de un estudio. La progresión por esfuerzo (RPE) la corrige después.
 */

/** Tallas comunes de pesa rusa (kg). */
export const STANDARD_BELLS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48] as const;

/** Cada cuánto pesarse. Una vez por semana: igual de útil que a diario (Madigan 2015) y menos obsesivo. */
export const WEIGH_EVERY_DAYS = 7;
/** Cada cuánto revisar la pesa de referencia: una vez por mesociclo (4 semanas). */
export const BELL_CHECK_EVERY_DAYS = 28;
/** Máximo de pesajes guardados (≈ 3 años de pesajes semanales). */
export const MAX_WEIGHTS = 150;

export function nearestStandardBell(kg: number): number {
  return STANDARD_BELLS.reduce((best, cur) => (Math.abs(cur - kg) < Math.abs(best - kg) ? cur : best), STANDARD_BELLS[0] as number);
}

export function nextStandardBellAbove(kg: number): number {
  return STANDARD_BELLS.find((b) => b > kg) ?? kg + 4;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function currentWeight(body?: BodyProfile): number | null {
  const last = body?.weights[body.weights.length - 1];
  return last ? last.kg : null;
}

/** Añade (o reemplaza el del mismo día) un pesaje y devuelve el perfil nuevo, ordenado y acotado. */
export function addWeight(body: BodyProfile, date: string, kg: number): BodyProfile {
  const rounded = Math.round(kg * 10) / 10;
  const rest = body.weights.filter((w) => w.date !== date);
  const weights = [...rest, { date, kg: rounded }].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_WEIGHTS);
  return { ...body, weights };
}

/** Cambio de peso frente al pesaje más cercano de hace ≥ 21 días (null si aún no hay suficientes datos). */
export function weightTrend(weights: WeightEntry[]): { deltaKg: number; days: number } | null {
  const last = weights[weights.length - 1];
  if (!last) return null;
  const older = [...weights].reverse().find((w) => daysBetween(w.date, last.date) >= 21);
  if (!older) return null;
  return { deltaKg: Math.round((last.kg - older.kg) * 10) / 10, days: daysBetween(older.date, last.date) };
}

// ───────────────────────── Recomendación de pesas ─────────────────────────

/** Fracción del peso corporal ajustado que suele manejarse en swing a dos manos, por nivel (heurística). */
const RATIO: Record<Level, number> = { novice: 0.17, intermediate: 0.25, advanced: 0.35 };
/** Tope de la pesa de referencia por nivel: un principiante no arranca con una pesa de 24 aunque pese 110 kg. */
const CAP: Record<Level, number> = { novice: 16, intermediate: 24, advanced: 32 };

export interface BellRecommendation {
  /** Pesa de referencia sugerida: la que dominas en swing a dos manos. */
  referenceKg: number;
  /** Rango razonable alrededor de la referencia. */
  rangeKg: [number, number];
  /** Pesa ligera (get-up, press, halo, acarreos). */
  lightKg: number;
  /** Siguiente pesa a la que apuntar. */
  nextKg: number;
  /** Set inicial recomendado si vas a comprar pesas. */
  starterSet: number[];
  /** Peso con el que se calculó (ajustado por estatura). */
  basisKg: number;
  /** IMC calculado (informativo; no es un diagnóstico). */
  bmi: number;
  notesEs: string[];
}

export function recommendBells(input: { weightKg: number; heightCm: number; level: Level }): BellRecommendation {
  const { weightKg, heightCm, level } = input;
  const index = bmi(weightKg, heightCm);
  // Estatura como freno conservador: la carga útil no crece linealmente con el peso. Por encima de ~120 % del
  // peso correspondiente a un IMC de 24,9 se usa ese tope; por debajo de IMC 18,5 se baja 10 %.
  const ceiling = 24.9 * (heightCm / 100) ** 2 * 1.2;
  let basis = Math.min(weightKg, ceiling);
  if (index < 18.5) basis *= 0.9;
  const ratio = RATIO[level];
  const clampRef = (kg: number) => Math.min(CAP[level], Math.max(6, nearestStandardBell(kg)));
  const referenceKg = clampRef(basis * ratio);
  const lo = clampRef(basis * (ratio - 0.03));
  const hi = clampRef(basis * (ratio + 0.03));
  const lightKg = Math.max(4, nearestStandardBell(referenceKg * 0.5));
  const nextKg = nextStandardBellAbove(referenceKg);
  const starterSet = Array.from(new Set([lightKg, referenceKg, nextKg])).sort((a, b) => a - b);
  const pct = Math.round(ratio * 100);

  const notesEs = [
    `Sugerencia calculada con tu peso ajustado por estatura (${Math.round(basis)} kg) y tu nivel: alrededor del ${pct} % de ese peso para el swing a dos manos.`,
    "Es una guía de coaching, no un dato de estudio. Las pesas rusas se sienten más pesadas de lo que dicen: ante la duda, elige la más ligera.",
    "Test de la pesa correcta: 10 swings a dos manos con la última repetición igual que la primera. Si el agarre falla antes de la 10 o la espalda se redondea, baja una pesa.",
  ];
  if (index >= 30) notesEs.push("Con tu IMC la app prefiere partir conservadora: la técnica primero y la carga después.");
  if (index < 18.5) notesEs.push("Con tu IMC la app parte un poco más ligera; sube cuando la técnica y la energía lo permitan.");

  return { referenceKg, rangeKg: [Math.min(lo, referenceKg), Math.max(hi, referenceKg)], lightKg, nextKg, starterSet, basisKg: Math.round(basis), bmi: Math.round(index * 10) / 10, notesEs };
}

// ───────────────────────── Revisiones programadas en el plan ─────────────────────────

export type CheckInId = "weigh-in" | "bell-check";

export interface CheckIn {
  id: CheckInId;
  titleEs: string;
  textEs: string;
}

/**
 * Pendientes de hoy dentro del plan:
 *  - Pesaje semanal (cada 7 días), solo si el usuario dio su peso y estatura.
 *  - Revisión mensual de la pesa de referencia (cada 28 días, una vez por mesociclo).
 */
export function dueCheckIns(settings: UserSettings, today: string): CheckIn[] {
  const out: CheckIn[] = [];
  const body = settings.body;

  if (body) {
    const last = body.weights[body.weights.length - 1];
    if (!last || daysBetween(last.date, today) >= WEIGH_EVERY_DAYS) {
      out.push({
        id: "weigh-in",
        titleEs: last ? "Pesaje semanal" : "Anota tu peso de hoy",
        textEs:
          "Pésate una vez por semana, el mismo día, en ayunas y después de ir al baño. Lo que importa es la tendencia de 4 semanas, no un número aislado: el peso sube y baja 1-2 kg por día.",
      });
    }
  }

  const base = body?.bellsCheckedAt ?? (settings.onboardedAt ? localDateKey(new Date(settings.onboardedAt)) : null);
  if (base && daysBetween(base, today) >= BELL_CHECK_EVERY_DAYS) {
    out.push({
      id: "bell-check",
      titleEs: "Revisión mensual de tus pesas",
      textEs:
        "Haz 10 swings a dos manos con tu pesa de referencia. Si la última sale igual que la primera y la técnica no se rompe, prueba la siguiente pesa. Si el agarre falla o la espalda se redondea, baja una.",
    });
  }
  return out;
}
