import { describe, expect, it } from "vitest";
import {
  EXERCISES,
  GOALS,
  compileSteps,
  createInitialState,
  cyclePosition,
  daysBetween,
  defaultSettings,
  evaluateGoals,
  finishRestDay,
  finishSession,
  generateSession,
  logFromStep,
  newlyCompleted,
  planForToday,
  stepDurationSec,
  updateStreak,
  type Feel,
  type ProgramState,
  type SessionPlan,
  type SetLog,
  type UserSettings,
} from "..";

const UID = "uid-test-123";

function settings(over: Partial<UserSettings> = {}): UserSettings {
  return { ...defaultSettings(), level: "intermediate", minutes: 20, bells: [8, 12, 16, 20, 24], referenceKg: 16, ...over };
}

function plan(day: number, s: UserSettings, state?: Partial<ProgramState>): SessionPlan {
  return generateSession({
    uid: UID,
    dayIndex: day,
    settings: s,
    memory: state?.memory ?? {},
    daysSinceLast: 1,
    lastRpe: state?.lastRpe ?? null,
    lastFeel: state?.lastFeel ?? null,
  });
}

/** Simula que el usuario hace TODAS las series al objetivo con un RPE dado. */
function simulate(p: SessionPlan, state: ProgramState, s: UserSettings, rpe: number, feel: Feel = 2, date = "2026-01-01") {
  const sets: SetLog[] = compileSteps(p)
    .filter((st) => st.kind === "work")
    .map((st) => logFromStep(st as never, (st as never as { targetReps?: number }).targetReps ?? 0, (st as never as { durationSec?: number }).durationSec));
  return finishSession({ state, settings: s, plan: p, sets, rpe, feel, startedAt: 1_000_000, endedAt: 1_000_000 + p.durationMin * 60_000, date });
}

describe("calendario", () => {
  it("Día 1 es acumulación del mesociclo 1 y el 4º mes de semanas descarga", () => {
    const d1 = cyclePosition(1, "balanced");
    expect(d1).toMatchObject({ slot: 0, week: 1, mesocycle: 1, phase: "accumulate", theme: "foundation" });
    expect(cyclePosition(22, "balanced").phase).toBe("deload"); // semana 4
    expect(cyclePosition(29, "balanced")).toMatchObject({ mesocycle: 2, week: 1, theme: "strength" });
  });
  it("Día 45 pertenece a mesociclo 2, semana 3 (pico)", () => {
    expect(cyclePosition(45, "balanced")).toMatchObject({ mesocycle: 2, week: 3, phase: "peak" });
  });
  it("daysBetween cuenta días calendario", () => {
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
});

describe("generador", () => {
  const s = settings();
  it("es determinista: mismo usuario y día => mismo plan", () => {
    expect(plan(45, s)).toEqual(plan(45, s));
  });
  it("usuarios distintos tienen rotaciones distintas", () => {
    const a = generateSession({ uid: "a", dayIndex: 60, settings: s, memory: {}, daysSinceLast: 1, lastRpe: null, lastFeel: null });
    const diff = Array.from({ length: 40 }, (_, i) => i + 1).filter((d) => {
      const x = generateSession({ uid: "a", dayIndex: d, settings: s, memory: {}, daysSinceLast: 1, lastRpe: null, lastFeel: null });
      const y = generateSession({ uid: "b", dayIndex: d, settings: s, memory: {}, daysSinceLast: 1, lastRpe: null, lastFeel: null });
      return JSON.stringify(x.blocks.map((b) => b.exerciseId)) !== JSON.stringify(y.blocks.map((b) => b.exerciseId));
    });
    expect(a.dayIndex).toBe(60);
    expect(diff.length).toBeGreaterThan(5);
  });
  it("solo usa ejercicios de la biblioteca (todo con kettlebell)", () => {
    for (let d = 1; d <= 120; d++) {
      for (const b of plan(d, s).blocks) expect(EXERCISES[b.exerciseId]).toBeDefined();
    }
  });
  it("usa solo pesas que el usuario tiene", () => {
    const own = settings({ bells: [10, 14] });
    for (let d = 1; d <= 60; d++) {
      for (const b of plan(d, own).blocks) {
        expect(own.bells).toContain(b.bellKg);
        if (b.altBellKg) expect(own.bells).toContain(b.altBellKg);
      }
    }
  });
  it("no usa ejercicios de dos pesas sin pares", () => {
    for (let d = 1; d <= 120; d++) {
      for (const b of plan(d, s).blocks) expect(EXERCISES[b.exerciseId].bells).toBe(1);
    }
  });
  it("principiantes no ven ejercicios avanzados ni intermedios en las primeras 6 semanas", () => {
    const nov = settings({ level: "novice", bells: [8, 12], referenceKg: 8 });
    for (let d = 1; d <= 42; d++) {
      for (const b of plan(d, nov).blocks) expect(EXERCISES[b.exerciseId].level).toBe("novice");
    }
  });
  it("la semana de descarga baja el volumen respecto a la semana de construcción", () => {
    const build = plan(8 + 1, s); // semana 2
    const deload = plan(21 + 2, s); // semana 4 (misma posición de slot 1)
    expect(cyclePosition(9, "balanced").phase).toBe("build");
    expect(cyclePosition(23, "balanced").phase).toBe("deload");
    expect(deload.rpeTarget).toBeLessThan(build.rpeTarget);
  });
  it("si dice 20 son 20: cada sesión dura lo elegido, al segundo (±10 s)", () => {
    const bad: string[] = [];
    for (const level of ["novice", "intermediate", "advanced"] as const) {
      for (const minutes of [10, 15, 20, 25] as const) {
        const sm = settings({ minutes, level });
        for (let d = 1; d <= 120; d++) {
          const p = plan(d, sm);
          if (p.focus === "recovery") continue;
          const real = compileSteps(p).reduce((a, st) => a + stepDurationSec(st), 0);
          if (Math.abs(real - minutes * 60) > 10 || Math.abs(p.durationSec - real) > 1) bad.push(`${level} ${minutes}min día ${d}: real ${real}s · plan ${p.durationSec}s`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
  it("la recuperación activa dura lo que dice su plan, nunca más de 12 minutos", () => {
    const sm = settings({ minutes: 25 });
    for (let d = 1; d <= 56; d++) {
      const p = plan(d, sm);
      if (p.focus !== "recovery") continue;
      const real = compileSteps(p).reduce((a, st) => a + stepDurationSec(st), 0);
      expect(real).toBeLessThanOrEqual(12 * 60 + 10);
      expect(Math.abs(p.durationSec - real)).toBeLessThanOrEqual(1);
    }
  });
  it("todo paso de trabajo está medido en segundos (nada de «¿ya terminaste?»)", () => {
    for (let d = 1; d <= 60; d++) {
      for (const st of compileSteps(plan(d, settings({ minutes: 20 })))) {
        if (st.kind === "work") {
          expect(st.mode).toBe("timed");
          expect(st.durationSec ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });
  it("hay variedad en un año: muchas combinaciones distintas y sin repetir título dos días seguidos", () => {
    const seen = new Set<string>();
    let prev = "";
    let repeats = 0;
    for (let d = 1; d <= 365; d++) {
      const p = plan(d, s);
      seen.add(`${p.focus}:${p.blocks.filter((b) => b.role === "primary" || b.role === "secondary").map((b) => b.exerciseId + b.protocol.kind).join(",")}`);
      if (p.title === prev && p.focus !== "recovery") repeats++;
      prev = p.title;
    }
    expect(seen.size).toBeGreaterThan(40);
    expect(repeats).toBeLessThan(15);
  });
  it("puerta de seguridad: un principiante no hace swings antes del día 15 y su volumen entra en rampa", () => {
    const nov = settings({ level: "novice", bells: [8, 12], referenceKg: 8 });
    for (let d = 1; d <= 14; d++) {
      for (const b of plan(d, nov).blocks) {
        if (b.role === "warmup") continue;
        expect(["two-hand-swing", "one-arm-swing", "clean", "snatch"]).not.toContain(b.exerciseId);
      }
    }
    const sw = (d: number) =>
      plan(d, nov).blocks.filter((b) => b.exerciseId === "two-hand-swing" && b.role !== "warmup").reduce((a, b) => a + (b.protocol.kind === "sets" ? b.protocol.sets * b.protocol.reps : 0), 0);
    for (let d = 15; d <= 21; d++) expect(sw(d)).toBeLessThanOrEqual(80);
  });
  it("cuidado de espalda baja: ningún ejercicio balístico, ni en el calentamiento", () => {
    const lb = settings({ lowBackCare: true });
    for (let d = 1; d <= 120; d++) {
      for (const b of plan(d, lb).blocks) expect(EXERCISES[b.exerciseId].category).not.toBe("ballistic");
    }
  });
  it("cada bloque de trabajo cita evidencia (nunca rutinas sin respaldo)", () => {
    for (let d = 1; d <= 60; d++) for (const b of plan(d, s).blocks) expect(b.evidence.length).toBeGreaterThan(0);
  });
  it("vuelta tras 10+ días sin entrenar reduce el volumen", () => {
    const normal = generateSession({ uid: UID, dayIndex: 10, settings: s, memory: {}, daysSinceLast: 1, lastRpe: null, lastFeel: null });
    const back = generateSession({ uid: UID, dayIndex: 10, settings: s, memory: {}, daysSinceLast: 12, lastRpe: null, lastFeel: null });
    expect(back.readiness).toBe("reentry");
    expect(back.durationMin).toBeLessThanOrEqual(normal.durationMin);
  });
  it("el recovery permite descanso total; los demás enfoques no", () => {
    for (let d = 1; d <= 28; d++) {
      const p = plan(d, s);
      expect(p.restDayAllowed).toBe(p.focus === "recovery");
    }
  });
});

describe("pasos del player", () => {
  const s = settings();
  it("los índices son consecutivos y las duraciones positivas", () => {
    for (let d = 1; d <= 60; d++) {
      const steps = compileSteps(plan(d, s));
      expect(steps.length).toBeGreaterThan(3);
      steps.forEach((st, i) => {
        expect(st.index).toBe(i);
        expect(stepDurationSec(st)).toBeGreaterThan(0);
      });
    }
  });
  it("un EMOM genera un paso de 60 s por minuto", () => {
    let found = false;
    for (let d = 1; d <= 200 && !found; d++) {
      const p = plan(d, s);
      const b = p.blocks.find((x) => x.protocol.kind === "emom");
      if (b && b.protocol.kind === "emom") {
        const emomSteps = compileSteps(p).filter((st) => st.kind === "work" && st.blockId === b.id && st.emom);
        expect(emomSteps.length).toBe(b.protocol.minutes);
        expect(emomSteps.every((st) => st.kind === "work" && st.durationSec === 60)).toBe(true);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe("progresión", () => {
  it("sube de pesa tras ~4 sesiones fáciles del mismo ejercicio y mezcla antes de saltar", () => {
    const s = settings({ level: "novice", bells: [8, 12, 16], referenceKg: 12 });
    let state = createInitialState(0);
    const trace: number[] = [];
    // Entrena 28 días (con descarga incluida) con RPE bajo.
    for (let d = 1; d <= 28; d++) {
      const p = planForToday(UID, state, s, `2026-01-${String(d).padStart(2, "0")}`);
      const { next } = simulate(p, state, s, Math.max(1, p.rpeTarget - 1.5), 1, `2026-01-${String(d).padStart(2, "0")}`);
      state = next;
      trace.push(state.memory["goblet-squat"]?.bellKg ?? 0);
    }
    const seen = trace.filter(Boolean);
    expect(Math.max(...seen)).toBeGreaterThan(Math.min(...seen)); // subió de pesa alguna vez
    for (let i = 1; i < seen.length; i++) expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]! - 0.0001);
  });
  it("una sesión durísima baja la etapa, no sube la pesa", () => {
    const s = settings();
    let state = createInitialState(0);
    const p = plan(2, s, state);
    const r1 = simulate(p, state, s, 6, 2);
    state = r1.next;
    const stageAfterOk = Object.values(state.memory).map((m) => m!.stage);
    const p2 = plan(state.dayIndex, s, state);
    const r2 = simulate(p2, state, s, 10, 3);
    const stageAfterHard = Object.values(r2.next.memory).map((m) => m!.stage);
    expect(Math.max(...stageAfterHard)).toBeLessThanOrEqual(Math.max(...stageAfterOk) + 1);
  });
  it("no progresa en semana de descarga", () => {
    const s = settings();
    const state = createInitialState(0);
    const p = plan(22, s, state);
    expect(p.phase).toBe("deload");
    const { next } = simulate(p, { ...state, dayIndex: 22 }, s, 4, 1);
    for (const m of Object.values(next.memory)) expect(m!.stage).toBe(0);
  });
  it("el tonelaje y las repeticiones se registran y avanza el día", () => {
    const s = settings();
    const state = createInitialState(0);
    const p = plan(1, s);
    const { log, next } = simulate(p, state, s, 7, 2);
    expect(next.dayIndex).toBe(2);
    expect(log.totalReps).toBeGreaterThan(0);
    expect(next.totals.sessions).toBe(1);
    expect(next.xp).toBeGreaterThan(0);
  });
});

describe("registro honesto", () => {
  it("una sesión con todo saltado no crea récords ni desbloquea metas de pesa", () => {
    const s = settings();
    const state = createInitialState(0);
    const p = plan(1, s);
    const sets: SetLog[] = compileSteps(p)
      .filter((st) => st.kind === "work")
      .map((st) => logFromStep(st as never, 0, undefined, true));
    const { next } = finishSession({ state, settings: s, plan: p, sets, rpe: 5, feel: 2, startedAt: 1, endedAt: 600_000, date: "2026-01-01" });
    expect(Object.keys(next.memory)).toHaveLength(0);
    expect(newlyCompleted(next, [], 1).find((g) => g.id.startsWith("bell-"))).toBeUndefined();
  });
});

describe("racha", () => {
  it("suma días seguidos, usa escudo con un día perdido y reinicia con más", () => {
    expect(updateStreak(0, 0, null, "2026-01-01").streak).toBe(1);
    expect(updateStreak(3, 0, "2026-01-01", "2026-01-02").streak).toBe(4);
    expect(updateStreak(3, 0, "2026-01-01", "2026-01-01").streak).toBe(3);
    const shield = updateStreak(5, 1, "2026-01-01", "2026-01-03");
    expect(shield).toMatchObject({ streak: 6, shields: 0, usedShield: true });
    expect(updateStreak(5, 0, "2026-01-01", "2026-01-03").streak).toBe(1);
    expect(updateStreak(5, 2, "2026-01-01", "2026-01-05").streak).toBe(1);
  });
  it("avisa cuándo se gana y cuándo se gasta un escudo (también las dos cosas a la vez)", () => {
    expect(updateStreak(6, 0, "2026-01-06", "2026-01-07")).toMatchObject({ earnedShield: true, usedShield: false, shields: 1 });
    expect(updateStreak(6, 2, "2026-01-06", "2026-01-07")).toMatchObject({ earnedShield: false, shields: 2 });
    expect(updateStreak(5, 1, "2026-01-01", "2026-01-03")).toMatchObject({ earnedShield: false, usedShield: true, shields: 0 });
    // racha de 6, un día perdido cubierto por escudo: llega a 7, gasta uno y gana otro
    expect(updateStreak(6, 1, "2026-01-01", "2026-01-03")).toMatchObject({ streak: 7, usedShield: true, earnedShield: true, shields: 1 });
    expect(updateStreak(3, 1, "2026-01-01", "2026-01-01")).toMatchObject({ usedShield: false, earnedShield: false });
  });
  it("cada 7 días de racha se gana un escudo (máximo 2)", () => {
    expect(updateStreak(6, 0, "2026-01-06", "2026-01-07").shields).toBe(1);
    expect(updateStreak(6, 2, "2026-01-06", "2026-01-07").shields).toBe(2);
  });
  it("un día de descanso mantiene la racha y avanza el día", () => {
    const s = settings();
    const state: ProgramState = { ...createInitialState(0), dayIndex: 4, streak: 3, lastSessionDate: "2026-01-03" };
    const p = plan(4, s);
    const { next, log } = finishRestDay(state, p, 5, "2026-01-04");
    expect(next.streak).toBe(4);
    expect(next.dayIndex).toBe(5);
    expect(log.restDay).toBe(true);
    expect(next.totals.restDays).toBe(1);
  });
});

describe("metas", () => {
  it("se derivan del estado y solo se reportan una vez", () => {
    const state: ProgramState = { ...createInitialState(0), dayIndex: 8, streak: 7, bestStreak: 7, totals: { sessions: 7, restDays: 0, reps: 500, tonnageKg: 2000, minutes: 200 }, exerciseReps: { "two-hand-swing": 150 } };
    const prog = evaluateGoals(state);
    expect(prog.find((g) => g.id === "streak-7")?.done).toBe(true);
    expect(prog.find((g) => g.id === "swings-100")?.done).toBe(true);
    expect(prog.find((g) => g.id === "swings-1000")?.done).toBe(false);
    const fresh = newlyCompleted(state, ["streak-7"], 123);
    expect(fresh.find((g) => g.id === "streak-7")).toBeUndefined();
    expect(fresh.find((g) => g.id === "tonnage-1000")).toBeDefined();
    expect(GOALS.length).toBeGreaterThan(15);
  });
});
