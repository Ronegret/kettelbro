import { SCHEMA_VERSION } from "@/lib/config";
import { daysBetween } from "./calendar";
import { EXERCISES } from "./exercises";
import { blockTargetReps, compileBlock } from "./steps";
import type {
  ExerciseId,
  ExerciseMemory,
  ExerciseMemoryMap,
  Feel,
  ProgramState,
  SessionLog,
  SessionPlan,
  SetLog,
  Step,
  UserSettings,
  WorkBlock,
  WorkStep,
} from "./types";

/**
 * Progresión, racha, XP y rangos. Todo puro.
 *
 * PROGRESIÓN CON PESAS DISCRETAS (las kettlebells suben de 4 en 4 kg, un salto de ~30%):
 *   etapa 0 → 4. Cada sesión completada con RPE ≤ objetivo + 0.5 suma una etapa.
 *   Etapa 1/2/3 → ¼, ½, ¾ de las series se hacen ya con la pesa siguiente (altShare).
 *   Etapa 4 → se promueve: esa pesa pasa a ser la base y la etapa vuelve a 0.
 *   Si la sesión se queda corta (no se completó, RPE ≥ objetivo + 1.5 o sensación "durísima") la etapa baja.
 * Es doble progresión adaptada: la autorregulación por RPE decide, no un calendario fijo
 * (ACSM/Currier: progresar cuando la carga se tolera; Helms 2016: RPE para regular la carga).
 */

export const MAX_STAGE = 4;
export const REENTRY_NO_PROGRESS = true;

// ───────────────────────── Registro de series ─────────────────────────

/** Crea el SetLog de un paso de trabajo completado. */
export function logFromStep(step: WorkStep, reps: number, durationSec?: number, skipped = false): SetLog {
  return {
    exerciseId: step.exerciseId,
    blockId: step.blockId,
    setIndex: step.setIndex,
    side: step.side,
    reps: skipped ? 0 : reps,
    bellKg: step.bellKg,
    ...(durationSec !== undefined ? { durationSec } : {}),
    ...(skipped ? { skipped: true } : {}),
  };
}

/** Repeticiones que cuenta un log para el tonelaje (un complejo suma las reps de cada ejercicio). */
function logTonnage(l: SetLog): number {
  if (l.skipped) return 0;
  const ex = EXERCISES[l.exerciseId];
  const bells = ex.bells; // dos pesas = doble tonelaje
  return l.reps * l.bellKg * bells;
}

// ───────────────────────── Racha ─────────────────────────

export function updateStreak(
  streak: number,
  shields: number,
  lastDate: string | null,
  today: string,
): StreakUpdate {
  if (lastDate === null) return { streak: 1, shields, usedShield: false, earnedShield: false };
  const diff = daysBetween(lastDate, today);
  if (diff <= 0) return { streak: Math.max(streak, 1), shields, usedShield: false, earnedShield: false };
  if (diff === 1) return withShieldReward(streak + 1, shields, false);
  if (diff === 2 && shields > 0) return withShieldReward(streak + 1, shields - 1, true);
  return { streak: 1, shields, usedShield: false, earnedShield: false };
}

export interface StreakUpdate {
  streak: number;
  shields: number;
  /** Un escudo cubrió el día perdido de ayer. */
  usedShield: boolean;
  /** Esta sesión completó otra semana de racha y regaló un escudo. */
  earnedShield: boolean;
}

/** Cada 7 días de racha se gana un escudo (máx. 2) que perdona un día perdido. */
function withShieldReward(streak: number, shields: number, used: boolean): StreakUpdate {
  const earned = streak > 0 && streak % 7 === 0 && shields < 2 ? 1 : 0;
  return { streak, shields: shields + earned, usedShield: used, earnedShield: earned === 1 };
}

/** Racha visible hoy: si ya pasó más de 1 día sin entrenar (y no hay escudo para cubrirlo) se muestra 0. */
export function liveStreak(state: ProgramState, today: string): number {
  if (!state.lastSessionDate) return 0;
  const diff = daysBetween(state.lastSessionDate, today);
  if (diff <= 1) return state.streak;
  if (diff === 2 && state.shields > 0) return state.streak;
  return 0;
}

export function daysSinceLast(state: ProgramState, today: string): number | null {
  if (!state.lastSessionDate) return null;
  return Math.max(0, daysBetween(state.lastSessionDate, today));
}

// ───────────────────────── XP y rangos ─────────────────────────

export const RANKS = [
  { name: "Novato", min: 0 },
  { name: "Aprendiz", min: 250 },
  { name: "Fierrero", min: 900 },
  { name: "Forjador", min: 2200 },
  { name: "Maestro", min: 4500 },
  { name: "Leyenda", min: 8000 },
] as const;

export function rankFor(xp: number) {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (xp >= r.min) idx = i;
  });
  const cur = RANKS[idx]!;
  const next = RANKS[idx + 1] ?? null;
  const pct = next ? (xp - cur.min) / (next.min - cur.min) : 1;
  return { index: idx, name: cur.name, next: next?.name ?? null, nextAt: next?.min ?? null, pct: Math.min(1, Math.max(0, pct)) };
}

export function xpFor(durationSec: number, tonnageKg: number, rpe: number, streak: number): number {
  const base = (durationSec / 60) * 6;
  const load = Math.min(tonnageKg / 60, 100);
  const effort = rpe >= 6 ? 15 : 5;
  return Math.round(base + load + effort + Math.min(streak, 30));
}

// ───────────────────────── Memoria de ejercicios ─────────────────────────

function sortedBells(settings: UserSettings): number[] {
  return [...settings.bells].sort((a, b) => a - b);
}

function updateMemory(
  prev: ExerciseMemory | undefined,
  block: WorkBlock,
  logs: SetLog[],
  ctx: { rpe: number; feel: Feel; dayIndex: number; progress: boolean; bells: number[] },
): ExerciseMemory {
  const steps = compileBlock(block).filter((s): s is WorkStep => s.kind === "work");
  const total = steps.length || 1;
  const done = logs.filter((l) => !l.skipped).length;
  const target = blockTargetReps(block);
  const achieved = logs.reduce((acc, l) => acc + l.reps, 0);
  const completed = done / total >= 0.9 && (target === 0 || achieved / target >= 0.9);

  const base: ExerciseMemory = prev ?? {
    bellKg: block.bellKg,
    stage: 0,
    lastReps: 0,
    lastRpe: ctx.rpe,
    lastDayIndex: ctx.dayIndex,
    // Los récords salen solo de series realmente hechas (no de la pesa planeada).
    bestBellKg: 0,
    bestReps: 0,
  };
  const next: ExerciseMemory = { ...base, lastRpe: ctx.rpe, lastDayIndex: ctx.dayIndex, lastReps: achieved };

  // Récords: la pesa más alta con más repeticiones en una sola serie.
  for (const l of logs) {
    if (l.skipped) continue;
    if (l.bellKg > next.bestBellKg || (l.bellKg === next.bestBellKg && l.reps > next.bestReps)) {
      next.bestBellKg = l.bellKg;
      next.bestReps = l.reps;
    }
  }

  if (!ctx.progress) return next; // descarga / reingreso: se mantiene todo

  const tooHard = !completed || ctx.rpe >= block.rpeTarget + 1.5 || ctx.feel === 3;
  const easyEnough = ctx.rpe <= block.rpeTarget + 0.5;
  if (tooHard) {
    if (next.stage > 0) next.stage -= 1;
    else if (!completed) {
      const lower = [...ctx.bells].reverse().find((b) => b < next.bellKg);
      if (lower !== undefined) next.bellKg = lower;
    }
  } else if (easyEnough) {
    next.stage += 1;
    if (next.stage >= MAX_STAGE) {
      const higher = ctx.bells.find((b) => b > next.bellKg);
      if (higher !== undefined) {
        next.bellKg = higher;
        next.stage = 0;
      } else {
        next.stage = MAX_STAGE; // ya estás en tu pesa más alta: la app te sugerirá la siguiente
      }
    }
  }
  return next;
}

// ───────────────────────── Cierre de sesión ─────────────────────────

export interface FinishInput {
  state: ProgramState;
  settings: UserSettings;
  plan: SessionPlan;
  sets: SetLog[];
  rpe: number;
  feel: Feel;
  startedAt: number;
  endedAt: number;
  /** Fecha local YYYY-MM-DD en que se termina. */
  date: string;
}

export function finishSession(input: FinishInput): { log: SessionLog; next: ProgramState; streak: StreakUpdate } {
  const { state, settings, plan, sets, rpe, feel, startedAt, endedAt, date } = input;
  const durationSec = Math.max(60, Math.round((endedAt - startedAt) / 1000));
  const totalReps = sets.reduce((a, s) => a + (s.skipped ? 0 : s.reps), 0);
  const tonnageKg = Math.round(sets.reduce((a, s) => a + logTonnage(s), 0));

  const st = updateStreak(state.streak, state.shields, state.lastSessionDate, date);
  const xpEarned = xpFor(durationSec, tonnageKg, rpe, st.streak);

  const log: SessionLog = {
    id: `s${plan.dayIndex}-${startedAt}`,
    dayIndex: plan.dayIndex,
    date,
    focus: plan.focus,
    title: plan.title,
    phase: plan.phase,
    mesocycle: plan.mesocycle,
    startedAt,
    endedAt,
    durationSec,
    rpe,
    feel,
    sets,
    totalReps,
    tonnageKg,
    xpEarned,
  };

  // Memoria por ejercicio (solo bloques de trabajo, no calentamiento ni vuelta a la calma).
  const progress = plan.phase !== "deload" && plan.readiness === "normal" && plan.focus !== "recovery";
  const memory: ExerciseMemoryMap = { ...state.memory };
  const bells = sortedBells(settings);
  for (const block of plan.blocks) {
    if (block.role === "warmup" || block.role === "cooldown") continue;
    const logs = sets.filter((s) => s.blockId === block.id);
    // Si todas las series se saltaron no hay nada que aprender de este bloque.
    if (!logs.some((l) => !l.skipped)) continue;
    memory[block.exerciseId] = updateMemory(memory[block.exerciseId], block, logs, {
      rpe,
      feel,
      dayIndex: plan.dayIndex,
      progress,
      bells,
    });
  }

  const exerciseReps = { ...(state.exerciseReps ?? {}) } as Partial<Record<ExerciseId, number>>;
  for (const s of sets) {
    if (s.skipped || s.reps <= 0) continue;
    exerciseReps[s.exerciseId] = (exerciseReps[s.exerciseId] ?? 0) + s.reps;
  }

  const next: ProgramState = {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    dayIndex: plan.dayIndex + 1,
    lastSessionDate: date,
    streak: st.streak,
    bestStreak: Math.max(state.bestStreak, st.streak),
    shields: st.shields,
    xp: state.xp + xpEarned,
    totals: {
      sessions: state.totals.sessions + 1,
      restDays: state.totals.restDays,
      reps: state.totals.reps + totalReps,
      tonnageKg: state.totals.tonnageKg + tonnageKg,
      minutes: state.totals.minutes + Math.round(durationSec / 60),
    },
    memory,
    exerciseReps,
    lastRpe: rpe,
    lastFeel: feel,
  };
  return { log, next, streak: st };
}

/** Marca un día de descanso total: avanza el día y mantiene la racha, sin tocar la progresión. */
export function finishRestDay(state: ProgramState, plan: SessionPlan, now: number, date: string): { log: SessionLog; next: ProgramState; streak: StreakUpdate } {
  const st = updateStreak(state.streak, state.shields, state.lastSessionDate, date);
  const xpEarned = 10;
  const log: SessionLog = {
    id: `r${plan.dayIndex}-${now}`,
    dayIndex: plan.dayIndex,
    date,
    focus: "recovery",
    title: "DESCANSO",
    phase: plan.phase,
    mesocycle: plan.mesocycle,
    startedAt: now,
    endedAt: now,
    durationSec: 0,
    rpe: 1,
    feel: 1,
    sets: [],
    totalReps: 0,
    tonnageKg: 0,
    xpEarned,
    restDay: true,
  };
  const next: ProgramState = {
    ...state,
    dayIndex: plan.dayIndex + 1,
    lastSessionDate: date,
    streak: st.streak,
    bestStreak: Math.max(state.bestStreak, st.streak),
    shields: st.shields,
    xp: state.xp + xpEarned,
    totals: { ...state.totals, restDays: state.totals.restDays + 1 },
  };
  return { log, next, streak: st };
}

/** Pesa siguiente sugerida cuando el usuario ya domina su pesa más alta en un ejercicio. */
export function suggestedNextBell(mem: ExerciseMemory | undefined, bells: number[]): number | null {
  if (!mem || mem.stage < MAX_STAGE) return null;
  const higher = [...bells].sort((a, b) => a - b).find((b) => b > mem.bellKg);
  if (higher !== undefined) return null; // todavía hay una pesa propia más pesada: se promueve sola
  return mem.bellKg + 4;
}

export type { Step };
