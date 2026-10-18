import { EXERCISES } from "./exercises";
import type { ComplexItem, RestStep, SessionPlan, Side, Step, WorkBlock, WorkStep } from "./types";

/**
 * Compila un SessionPlan en una lista lineal de pasos que el reproductor ejecuta uno por uno.
 * Es la ÚNICA fuente de verdad para duraciones, series y titulares: el generador la usa para
 * dimensionar bloques al tiempo disponible y el player la usa para guiar al usuario.
 */

/** Preparación al empezar un bloque nuevo (presenta el ejercicio) y tras cada descanso / cambio de lado. */
const PREP_BLOCK_SEC = 5;
const PREP_STEP_SEC = 3;

const SIDE_ES: Record<Side, string> = { left: "izquierda", right: "derecha", both: "" };

/** Pesa de la serie i-ésima, mezclando la pesa siguiente en la fracción `altShare` (reparto pareja). */
export function bellForIndex(block: WorkBlock, i: number): number {
  const { altBellKg, altShare } = block;
  if (!altBellKg || !altShare) return block.bellKg;
  return Math.floor((i + 1) * altShare) > Math.floor(i * altShare) ? altBellKg : block.bellKg;
}

interface Ctx {
  block: WorkBlock;
  steps: Step[];
  index: number;
}

function base(ctx: Ctx, bellKg: number) {
  return {
    index: ctx.index + ctx.steps.length,
    blockId: ctx.block.id,
    exerciseId: ctx.block.exerciseId,
    role: ctx.block.role,
    bellKg,
  };
}

function work(
  ctx: Ctx,
  p: {
    bellKg: number;
    side: Side;
    setIndex: number;
    setCount: number;
    mode: "reps" | "timed";
    titleEs: string;
    subtitleParts: string[];
    targetReps?: number;
    durationSec?: number;
    emom?: boolean;
    roundLabel?: string;
    sequence?: ComplexItem[];
    exerciseId?: WorkStep["exerciseId"];
  },
) {
  const ex = EXERCISES[p.exerciseId ?? ctx.block.exerciseId];
  // TODO guiado por tiempo: la duración sale de las repeticiones × la cadencia del ejercicio (o de la ventana dada).
  const repsPerSec = (it: ComplexItem) => it.reps * Math.max(2, EXERCISES[it.exerciseId].secPerRep);
  const durationSec =
    p.durationSec ??
    Math.max(10, Math.round(p.sequence ? p.sequence.reduce((a, it) => a + repsPerSec(it), 0) : (p.targetReps ?? 0) * Math.max(2, ex.secPerRep)));
  const step: WorkStep = {
    ...base(ctx, p.bellKg),
    kind: "work",
    mode: "timed",
    durationSec,
    countReps: p.mode === "reps" || Boolean(p.emom),
    ...(ex.secPerRep >= 1.5 && ex.secPerRep <= 12 ? { repEverySec: ex.secPerRep } : {}),
    side: p.side,
    setIndex: p.setIndex,
    setCount: p.setCount,
    titleEs: p.titleEs,
    subtitleEs: p.subtitleParts.filter(Boolean).join(" · "),
    ...(p.targetReps !== undefined ? { targetReps: p.targetReps } : {}),
    ...(ex.secPerRep > 0 ? { secPerRep: ex.secPerRep } : {}),
    ...(p.emom ? { emom: true } : {}),
    ...(p.roundLabel ? { roundLabel: p.roundLabel } : {}),
    ...(p.sequence ? { sequence: p.sequence } : {}),
  };
  if (p.exerciseId) step.exerciseId = p.exerciseId;
  ctx.steps.push(step);
}

function rest(ctx: Ctx, durationSec: number, nextTitleEs: string, bellKg: number) {
  const step: RestStep = {
    ...base(ctx, bellKg),
    kind: "rest",
    durationSec: Math.max(5, Math.round(durationSec)),
    titleEs: "DESCANSA",
    subtitleEs: `Siguiente: ${nextTitleEs}`,
    nextTitleEs,
  };
  ctx.steps.push(step);
}

const kg = (n: number) => `${n} kg`;
const SINGULAR: Record<string, string> = {
  "GET-UPS": "GET-UP",
  SWINGS: "SWING",
  "SWINGS A UNA MANO": "SWING A UNA MANO",
  CLEANS: "CLEAN",
  SNATCHES: "SNATCH",
  SENTADILLAS: "SENTADILLA",
  "SENTADILLAS FRONTALES": "SENTADILLA FRONTAL",
  ZANCADAS: "ZANCADA",
  REMOS: "REMO",
  PUENTES: "PUENTE",
  HALOS: "HALO",
  MOLINOS: "MOLINO",
  OCHOS: "OCHO",
  "TIRONES ALTOS": "TIRÓN ALTO",
  "ARM BARS": "ARM BAR",
  "APERTURAS EN CUCLILLAS": "APERTURA EN CUCLILLAS",
  "PUSH PRESS": "PUSH PRESS",
};
const repsTitle = (reps: number, block: WorkBlock) => {
  const short = EXERCISES[block.exerciseId].shortEs;
  return `${reps} ${reps === 1 ? (SINGULAR[short] ?? short) : short}`;
};

/** Compila UN bloque. `startIndex` es el índice global del primer paso. */
export function compileBlock(block: WorkBlock, startIndex = 0): Step[] {
  const ctx: Ctx = { block, steps: [], index: startIndex };
  const ex = EXERCISES[block.exerciseId];
  const p = block.protocol;

  switch (p.kind) {
    case "sets": {
      for (let s = 0; s < p.sets; s++) {
        const bell = bellForIndex(block, s);
        const sides: Side[] = p.perSide ? ["right", "left"] : p.alternateSides ? [s % 2 === 0 ? "right" : "left"] : ["both"];
        sides.forEach((side) => {
          work(ctx, {
            bellKg: bell,
            side,
            setIndex: s,
            setCount: p.sets,
            mode: "reps",
            targetReps: p.reps,
            titleEs: repsTitle(p.reps, block),
            subtitleParts: [kg(bell), SIDE_ES[side], `serie ${s + 1}/${p.sets}`],
          });
        });
        if (s < p.sets - 1) rest(ctx, p.restSec, repsTitle(p.reps, block), bellForIndex(block, s + 1));
      }
      break;
    }

    case "emom": {
      for (let m = 0; m < p.minutes; m++) {
        const bell = bellForIndex(block, m);
        const side: Side = p.alternateSides ? (m % 2 === 0 ? "right" : "left") : "both";
        work(ctx, {
          bellKg: bell,
          side,
          setIndex: m,
          setCount: p.minutes,
          mode: "timed",
          durationSec: 60,
          emom: true,
          targetReps: p.repsPerMinute,
          roundLabel: `${m + 1}/${p.minutes}`,
          titleEs: repsTitle(p.repsPerMinute, block),
          subtitleParts: [kg(bell), SIDE_ES[side], `minuto ${m + 1}/${p.minutes}`],
        });
      }
      break;
    }

    case "ladder": {
      const longRest = Math.max(p.restSec * 2, 45);
      for (let r = 0; r < p.rounds; r++) {
        p.rungs.forEach((rung, ri) => {
          const bell = bellForIndex(block, r);
          const sides: Side[] = p.perSide ? ["right", "left"] : ["both"];
          sides.forEach((side, si) => {
            work(ctx, {
              bellKg: bell,
              side,
              setIndex: r * p.rungs.length + ri,
              setCount: p.rounds * p.rungs.length,
              mode: "reps",
              targetReps: rung,
              roundLabel: `escalera ${r + 1}/${p.rounds}`,
              titleEs: repsTitle(rung, block),
              subtitleParts: [kg(bell), SIDE_ES[side], `escalera ${r + 1}/${p.rounds}`],
            });
            const last = r === p.rounds - 1 && ri === p.rungs.length - 1 && si === sides.length - 1;
            if (!last) {
              const endOfRound = ri === p.rungs.length - 1 && si === sides.length - 1;
              const nextRung = endOfRound ? p.rungs[0] ?? rung : si < sides.length - 1 ? rung : p.rungs[ri + 1] ?? rung;
              rest(ctx, endOfRound ? longRest : p.restSec, repsTitle(nextRung, block), bell);
            }
          });
        });
      }
      break;
    }

    case "intervals": {
      for (let r = 0; r < p.rounds; r++) {
        const bell = bellForIndex(block, r);
        const side: Side = p.alternateSides ? (r % 2 === 0 ? "right" : "left") : "both";
        work(ctx, {
          bellKg: bell,
          side,
          setIndex: r,
          setCount: p.rounds,
          mode: "timed",
          durationSec: p.workSec,
          targetReps: ex.secPerRep > 0 ? Math.round(p.workSec / ex.secPerRep) : undefined,
          roundLabel: `${r + 1}/${p.rounds}`,
          titleEs: ex.shortEs,
          subtitleParts: [kg(bell), SIDE_ES[side], `${p.workSec} s · ronda ${r + 1}/${p.rounds}`],
        });
        if (r < p.rounds - 1 && p.restSec > 0) rest(ctx, p.restSec, ex.shortEs, bellForIndex(block, r + 1));
      }
      break;
    }

    case "timed": {
      const sets = p.sets ?? 1;
      const switchSec = p.switchEverySec && p.switchEverySec > 0 ? p.switchEverySec : 0;
      for (let s = 0; s < sets; s++) {
        const bell = bellForIndex(block, s);
        const total = p.minutes * 60;
        if (!switchSec) {
          work(ctx, {
            bellKg: bell,
            side: "both",
            setIndex: s,
            setCount: sets,
            mode: "timed",
            durationSec: total,
            targetReps: Math.round(p.minutes * p.targetRpm),
            titleEs: ex.shortEs,
            subtitleParts: [kg(bell), `${p.targetRpm} reps/min`, sets > 1 ? `serie ${s + 1}/${sets}` : ""],
          });
        } else {
          const segs = Math.ceil(total / switchSec);
          for (let g = 0; g < segs; g++) {
            const dur = Math.min(switchSec, total - g * switchSec);
            const side: Side = g % 2 === 0 ? "right" : "left";
            work(ctx, {
              bellKg: bell,
              side,
              setIndex: s,
              setCount: sets,
              mode: "timed",
              durationSec: dur,
              targetReps: Math.round((dur / 60) * p.targetRpm),
              roundLabel: `${g + 1}/${segs}`,
              titleEs: ex.shortEs,
              subtitleParts: [kg(bell), SIDE_ES[side], `${p.targetRpm} reps/min`, sets > 1 ? `serie ${s + 1}/${sets}` : ""],
            });
          }
        }
        if (s < sets - 1) rest(ctx, p.restSec ?? 120, ex.shortEs, bellForIndex(block, s + 1));
      }
      break;
    }

    case "carry": {
      for (let s = 0; s < p.sets; s++) {
        const bell = bellForIndex(block, s);
        const sides: Side[] = p.perSide ? ["right", "left"] : ["both"];
        sides.forEach((side) => {
          work(ctx, {
            bellKg: bell,
            side,
            setIndex: s,
            setCount: p.sets,
            mode: "timed",
            durationSec: p.seconds,
            titleEs: ex.shortEs,
            subtitleParts: [kg(bell), SIDE_ES[side], `${p.seconds} s`, `serie ${s + 1}/${p.sets}`],
          });
        });
        if (s < p.sets - 1) rest(ctx, p.restSec, ex.shortEs, bellForIndex(block, s + 1));
      }
      break;
    }

    case "flow": {
      const sides: Side[] = p.perSide ? ["right", "left"] : ["both"];
      sides.forEach((side) => {
        if (p.reps) {
          work(ctx, {
            bellKg: block.bellKg,
            side,
            setIndex: 0,
            setCount: 1,
            mode: "reps",
            targetReps: p.reps,
            titleEs: repsTitle(p.reps, block),
            subtitleParts: [kg(block.bellKg), SIDE_ES[side]],
          });
        } else {
          work(ctx, {
            bellKg: block.bellKg,
            side,
            setIndex: 0,
            setCount: 1,
            mode: "timed",
            durationSec: p.seconds,
            titleEs: ex.shortEs,
            subtitleParts: [kg(block.bellKg), SIDE_ES[side], `${p.seconds} s`],
          });
        }
      });
      break;
    }

    case "complex": {
      const seqTitle = p.items.map((i) => EXERCISES[i.exerciseId].shortEs).join(" + ");
      for (let r = 0; r < p.rounds; r++) {
        const bell = bellForIndex(block, r);
        const sides: Side[] = p.perSide ? ["right", "left"] : ["both"];
        sides.forEach((side) => {
          work(ctx, {
            bellKg: bell,
            side,
            setIndex: r,
            setCount: p.rounds,
            mode: "reps",
            sequence: p.items,
            targetReps: p.items.reduce((a, i) => a + i.reps, 0),
            roundLabel: `${r + 1}/${p.rounds}`,
            titleEs: `RONDA ${r + 1}/${p.rounds}`,
            subtitleParts: [kg(bell), SIDE_ES[side], seqTitle],
          });
        });
        if (r < p.rounds - 1) rest(ctx, p.restSec, `RONDA ${r + 2}/${p.rounds}`, bellForIndex(block, r + 1));
      }
      break;
    }
  }

  return ctx.steps;
}

/** Duración de un paso: preparación + trabajo (o el descanso). Es exacta, no una estimación. */
export function stepDurationSec(step: Step): number {
  if (step.kind === "rest") return step.durationSec;
  return (step.prepSec ?? 0) + (step.durationSec ?? 0);
}

/** Asigna la preparación de cada paso de trabajo dentro de un bloque (o de la sesión completa). */
function assignPreps(steps: Step[]): Step[] {
  return steps.map((st, i) => {
    if (st.kind !== "work") return st;
    const prev = steps[i - 1];
    if (!prev || prev.blockId !== st.blockId) return { ...st, prepSec: PREP_BLOCK_SEC, prepLabelEs: "Prepárate" };
    if (prev.kind === "rest") return { ...st, prepSec: PREP_STEP_SEC, prepLabelEs: "Prepárate" };
    if (prev.kind === "work" && prev.side !== st.side) return { ...st, prepSec: PREP_STEP_SEC, prepLabelEs: "Cambia de lado" };
    return { ...st, prepSec: 0 }; // minutos consecutivos de un EMOM, tramos seguidos del mismo lado
  });
}

export function blockEstimateSec(block: WorkBlock): number {
  return assignPreps(compileBlock(block)).reduce((acc, s) => acc + stepDurationSec(s), 0);
}

/** Repeticiones totales que el bloque prescribe (0 si el volumen es por tiempo). */
export function blockTargetReps(block: WorkBlock): number {
  return compileBlock(block).reduce((acc, s) => acc + (s.kind === "work" && s.countReps ? (s.targetReps ?? 0) : 0), 0);
}

/** Pausa de transición entre bloques (cambiar de pesa). La preparación del siguiente bloque se suma aparte. */
function transitionSec(prev: WorkBlock, next: WorkBlock): number {
  if (prev.protocol.kind === "flow" && next.protocol.kind === "flow") return 0;
  return prev.bellKg === next.bellKg ? 6 : 15;
}

export function compileSteps(plan: SessionPlan): Step[] {
  const out: Step[] = [];
  plan.blocks.forEach((block, bi) => {
    const blockSteps = compileBlock(block, out.length);
    if (bi > 0) {
      const prev = plan.blocks[bi - 1] as WorkBlock;
      const secs = transitionSec(prev, block);
      if (secs > 0) {
        const first = blockSteps[0];
        const nextTitle = first?.titleEs ?? EXERCISES[block.exerciseId].shortEs;
        const rctx: Ctx = { block: prev, steps: [], index: out.length };
        rest(rctx, secs, `${EXERCISES[block.exerciseId].nameEs} · ${nextTitle}`, block.bellKg);
        const r = rctx.steps[0] as RestStep;
        r.blockId = block.id;
        r.exerciseId = block.exerciseId;
        r.role = block.role;
        out.push(r);
      }
    }
    for (const st of blockSteps) out.push(st);
  });
  // Preparaciones (cuentan dentro del tiempo) y reindexado: el índice coincide con la posición.
  return assignPreps(out).map((st, i) => ({ ...st, index: i }));
}

export function planEstimateSec(plan: Pick<SessionPlan, "blocks">): number {
  const tmp = { blocks: plan.blocks } as SessionPlan;
  return compileSteps(tmp).reduce((acc, s) => acc + stepDurationSec(s), 0);
}
