import { ENGINE_VERSION } from "@/lib/config";
import { cyclePosition, effectiveLevel, focusFor, MICRO_DAYS, type CyclePosition } from "./calendar";
import { coachingFor, type Coaching } from "./coach";
import { clampMinutes } from "./defaults";
import { EXERCISES } from "./exercises";
import { makeRng, rotate } from "./rng";
import { blockEstimateSec, planEstimateSec } from "./steps";
import type {
  BlockRole,
  Exercise,
  ExerciseId,
  ExerciseMemoryMap,
  Feel,
  Focus,
  Level,
  Phase,
  Protocol,
  SessionPlan,
  UserSettings,
  WorkBlock,
} from "./types";

/**
 * GENERADOR DE RUTINAS. Función pura: (usuario, día, ajustes, memoria) → SessionPlan.
 *
 * Capas de decisión, de lo macro a lo micro:
 *   1. Calendario  → qué fase/tema/enfoque toca el Día N            (calendar.ts)
 *   2. Presupuesto → minutos disponibles repartidos entre bloques     (SHARES)
 *   3. Selección   → ejercicio por rotación justa y por usuario       (rng.ts › rotate)
 *   4. Formato     → protocolo (EMOM, series, escaleras...) según fase y nivel
 *   5. Carga       → pesa elegida de las que TIENE el usuario + memoria de progresión
 *   6. Autorregulación → ajusta volumen según RPE/sensación previos y días sin entrenar
 */

export interface GenerateInput {
  uid: string;
  dayIndex: number;
  settings: UserSettings;
  memory: ExerciseMemoryMap;
  /** Días calendario desde la última sesión (null si nunca entrenó o es el mismo día). */
  daysSinceLast: number | null;
  lastRpe: number | null;
  lastFeel: Feel | null;
}

// ───────────────────────── Constantes de dosificación ─────────────────────────

/** Fracción del tiempo disponible que se usa según la fase (la descarga baja ~40% el volumen). */
const FILL: Record<Phase, number> = { accumulate: 0.9, build: 1, peak: 0.95, deload: 0.6 };
/** RPE objetivo base por fase (escala 1-10). */
const PHASE_RPE: Record<Phase, number> = { accumulate: 6.5, build: 7, peak: 8, deload: 5.5 };
const FOCUS_RPE_OFFSET: Record<Focus, number> = { power: -0.5, strength: 0, endurance: 0.5, hybrid: 0.5, skill: -1.5, recovery: 0 };

/** Reparto del tiempo principal entre bloques [primario, secundario, final]. */
const SHARES: Record<Exclude<Focus, "recovery">, [number, number, number]> = {
  power: [0.6, 0.28, 0.12],
  strength: [0.5, 0.36, 0.14],
  endurance: [0.78, 0, 0.22],
  hybrid: [0.72, 0, 0.28],
  skill: [0.5, 0.32, 0.18],
};

// Evidencia por tipo de bloque (ids de docs/research/evidence.json)
const EV = {
  swing: ["lake2012a", "lake2012b", "mcgill2012"],
  swingCardio: ["farrar2010", "thomas2014", "fortner2014"],
  intervals: ["lake2012a", "fortner2014", "wen2019"],
  snatchCardio: ["schnettler2010", "falatic2015", "chan2020"],
  strength: ["currier2026", "grgic2018"],
  periodization: ["williams2017", "rhea2004"],
  rpe: ["zourdos2016", "helms2016", "halperin2022"],
  tgu: ["stonge2019"],
  carry: ["mcgill2012"],
  warmup: ["fradkin2006", "behm2016"],
  deload: ["bell2023", "bosquet2007"],
  reentry: ["mujika2000b", "bosquet2013"],
  time: ["androulakis2020", "iversen2021"],
  complex: ["lyons2017", "currier2026"],
};

// ───────────────────────── Contexto ─────────────────────────

interface Ctx {
  input: GenerateInput;
  pos: CyclePosition;
  level: Level;
  focus: Focus;
  rpe: number;
  fill: number;
  readiness: "normal" | "reentry";
  userSeed: string;
  rng: () => number;
  bells: number[];
  ref: number;
  /** Cuántas veces ha salido este slot del microciclo (rota pools sin repetir). */
  exposure: number;
  nextId: number;
  /** Adaptación a la persona: rampa de iniciación y ajustes por peso y estatura (coach.ts). */
  coach: Coaching;
}

const rank: Record<Level, number> = { novice: 0, intermediate: 1, advanced: 2 };
const allowed = (ex: Exercise, ctx: Ctx) =>
  rank[ex.level] <= rank[ctx.level] &&
  (ex.bells === 1 || ctx.input.settings.hasPairs === true) &&
  // Cuidado de espalda baja: fuera todo lo balístico (McGill 2012: cizallamiento L4-L5 singular en el swing).
  !(ctx.input.settings.lowBackCare === true && ex.category === "ballistic") &&
  // Carga relativa alta al empezar: sin balísticos las primeras 4 semanas (coach.ts).
  !(ctx.coach.lowImpact && ex.category === "ballistic");

function pool(ctx: Ctx, ids: ExerciseId[]): ExerciseId[] {
  const ok = ids.filter((id) => allowed(EXERCISES[id], ctx));
  return ok.length ? ok : ids.filter((id) => EXERCISES[id].bells === 1).slice(0, 1);
}

function pickFrom(ctx: Ctx, slot: string, ids: ExerciseId[]): ExerciseId {
  return rotate(pool(ctx, ids), ctx.userSeed, `${slot}:s${ctx.pos.slot}`, ctx.exposure);
}

function nearestBell(bells: number[], ideal: number): number {
  let best = bells[0] ?? ideal;
  for (const b of bells) if (Math.abs(b - ideal) < Math.abs(best - ideal) || (Math.abs(b - ideal) === Math.abs(best - ideal) && b < best)) best = b;
  return best;
}
function nextBellAbove(bells: number[], kg: number): number | undefined {
  return [...bells].sort((a, b) => a - b).find((b) => b > kg);
}
function lightBell(ctx: Ctx, factor = 0.35): number {
  const sorted = [...ctx.bells].sort((a, b) => a - b);
  const ideal = ctx.ref * factor;
  return sorted.find((b) => b >= ideal) ?? (sorted[0] as number);
}

/** Pesa para un ejercicio: memoria de progresión si existe; si no, estimación por referencia. */
function chooseBell(ctx: Ctx, ex: Exercise): Pick<WorkBlock, "bellKg" | "altBellKg" | "altShare"> {
  const mem = ctx.input.memory[ex.id];
  const ideal = ctx.ref * ex.loadFactor;
  const bellKg = mem ? mem.bellKg : nearestBell(ctx.bells, ideal);
  const next = nextBellAbove(ctx.bells, bellKg);
  const stage = mem?.stage ?? 0;
  // Mezcla de pesas: en la fase de carga se va introduciendo la pesa siguiente (¼, ½, ¾ de las series).
  const canMix = ctx.pos.phase !== "deload" && ctx.readiness === "normal" && ex.category !== "mobility";
  if (canMix && next && stage >= 1 && stage <= 3) return { bellKg, altBellKg: next, altShare: stage / 4 };
  return { bellKg };
}

function makeBlock(
  ctx: Ctx,
  role: BlockRole,
  exerciseId: ExerciseId,
  protocol: Protocol,
  extra: Partial<WorkBlock> & { evidence: string[] },
): WorkBlock {
  const ex = EXERCISES[exerciseId];
  // El get-up de un principiante arranca con la pesa más ligera (StrongFirst: primero sin carga o con un zapato).
  const tguStart = ex.id === "turkish-get-up" && ctx.level === "novice" && !ctx.input.memory[ex.id];
  const bell =
    role === "warmup" || role === "cooldown" ? { bellKg: lightBell(ctx) } : tguStart ? { bellKg: lightBell(ctx, 0.2) } : chooseBell(ctx, ex);
  return {
    id: `b${ctx.nextId++}`,
    role,
    exerciseId,
    ...bell,
    protocol,
    rpeTarget: round1(ctx.rpe),
    ...extra,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Dimensiona un bloque al tiempo asignado: prueba n = lo, lo+1, ... y se queda con el mayor n
 * cuya duración estimada (compilando de verdad los pasos) cabe en `targetSec`.
 */
function sized(
  ctx: Ctx,
  role: BlockRole,
  exerciseId: ExerciseId,
  make: (n: number) => Protocol,
  range: [number, number],
  targetSec: number,
  extra: Partial<WorkBlock> & { evidence: string[] },
): WorkBlock {
  let best = makeBlock(ctx, role, exerciseId, make(range[0]), extra);
  for (let n = range[0] + 1; n <= range[1]; n++) {
    const candidate = { ...best, protocol: make(n) };
    if (blockEstimateSec(candidate) <= targetSec) best = candidate;
    else break;
  }
  return best;
}

/**
 * Topes de volumen por formato y ejercicio. El tiempo disponible NO justifica cualquier volumen: la evidencia de dosis-respuesta
 * muestra rendimientos decrecientes (Schoenfeld 2017) y una sola serie ya produce ganancias (Androulakis 2020), así que
 * rellenar 35 minutos con 10 series de un mismo ejercicio no es una buena prescripción. Lo que sobra se llena con trabajo
 * complementario (ver `accessory`).
 */
function volumeCap(b: WorkBlock): number {
  const ex = EXERCISES[b.exerciseId];
  const p = b.protocol;
  switch (p.kind) {
    case "sets": {
      if (ex.pattern === "hinge" && ex.category === "ballistic") return p.perSide ? 6 : 12; // 100-120 swings por sesión
      if (ex.category === "ballistic") return b.role === "primary" ? (p.perSide ? 5 : 6) : 3;
      if (ex.category === "skill" || ex.category === "mobility") return 4;
      // ACSM 2026: 2-3 series por ejercicio por sesión bastan para fuerza; se admite algo más como máximo.
      if (b.role === "primary") return p.perSide ? 3 : 5;
      return p.perSide ? 3 : 4;
    }
    case "emom":
      return ex.id === "turkish-get-up" ? 10 : 14; // 10 get-ups en 10 min es el estándar "Simple"
    case "ladder":
      return 5;
    case "intervals":
      return ex.id === "snatch" ? 32 : 20;
    case "timed":
      return 3;
    case "carry":
      return 5;
    case "complex":
      return 8;
    case "flow":
      return 1;
  }
}

function volumeOf(p: Protocol): number {
  switch (p.kind) {
    case "sets":
    case "carry":
      return p.sets;
    case "emom":
      return p.minutes;
    case "ladder":
    case "intervals":
    case "complex":
      return p.rounds;
    case "timed":
      return p.sets ?? 1;
    case "flow":
      return 1;
  }
}

function withVolume(p: Protocol, n: number): Protocol {
  switch (p.kind) {
    case "sets":
    case "carry":
      return { ...p, sets: n };
    case "emom":
      return { ...p, minutes: n };
    case "ladder":
    case "intervals":
    case "complex":
      return { ...p, rounds: n };
    case "timed":
      return { ...p, sets: n };
    case "flow":
      return p;
  }
}

/** Un incremento mínimo de volumen (una serie, un minuto, una ronda...), o null si ya está en su tope. */
function bump(b: WorkBlock): WorkBlock | null {
  const v = volumeOf(b.protocol);
  if (b.protocol.kind === "flow" || v >= volumeCap(b)) return null;
  return { ...b, protocol: withVolume(b.protocol, v + 1) };
}

function clampToCaps(blocks: WorkBlock[]): WorkBlock[] {
  return blocks.map((b) => {
    if (b.role === "warmup" || b.role === "cooldown") return b;
    const cap = volumeCap(b);
    return volumeOf(b.protocol) > cap ? { ...b, protocol: withVolume(b.protocol, cap) } : b;
  });
}

/**
 * Rellena el tiempo que sobra tras dimensionar cada bloque: sube de a un incremento el bloque principal
 * y el secundario (alternando 2:1) mientras la estimación no pase del presupuesto ni del tope de volumen.
 */
function fillTo(blocks: WorkBlock[], targetSec: number): WorkBlock[] {
  const out = blocks.slice();
  const total = () => out.reduce((a, b) => a + blockEstimateSec(b), 0);
  const order = out.map((b, i) => ({ b, i })).filter((x) => x.b.role === "primary" || x.b.role === "secondary");
  if (!order.length) return out;
  let guard = 0;
  let turn = 0;
  let stuck = 0;
  while (guard++ < 60 && stuck < 3) {
    const slot = order[turn % 3 === 2 && order.length > 1 ? 1 : 0] as { b: WorkBlock; i: number };
    turn++;
    const cur = out[slot.i] as WorkBlock;
    const candidate = bump(cur);
    if (!candidate) {
      stuck++;
      continue;
    }
    const delta = blockEstimateSec(candidate) - blockEstimateSec(cur);
    if (total() + delta > targetSec * 1.03) {
      stuck++;
      continue;
    }
    stuck = 0;
    out[slot.i] = candidate;
  }
  return out;
}

/**
 * Bloque complementario para el tiempo que sobra: elige un patrón que la sesión aún no trabaja
 * (tirón, empuje, sentadilla, bisagra) y lo dimensiona al tiempo restante. Así una sesión de 45 minutos
 * es más completa, no solo más larga.
 */
function accessory(ctx: Ctx, blocks: WorkBlock[], leftoverSec: number, floorSec = 200, minSets = 2): WorkBlock | null {
  if (leftoverSec < floorSec) return null;
  const used = new Set(blocks.map((b) => b.exerciseId));
  const usedPatterns = new Set(blocks.map((b) => EXERCISES[b.exerciseId].pattern));
  const pools: Array<{ pattern: string; ids: ExerciseId[] }> = [
    { pattern: "pull", ids: ["one-arm-row"] },
    { pattern: "push", ids: ["floor-press", "half-kneeling-press", "strict-press"] },
    { pattern: "squat", ids: ["goblet-squat", "front-squat", "reverse-lunge-racked"] },
    { pattern: "hinge", ids: ["kettlebell-deadlift", "single-leg-rdl", "hip-bridge"] },
    { pattern: "core", ids: ["windmill", "halo"] },
  ];
  const lacking = pools.filter((p) => !usedPatterns.has(p.pattern as never));
  const choices = (lacking.length ? lacking : pools).map((p) => ({ pattern: p.pattern, ids: pool(ctx, p.ids).filter((id) => !used.has(id)) })).filter((p) => p.ids.length);
  if (!choices.length) return null;
  const pick = rotate(choices, ctx.userSeed, "acc", ctx.exposure + ctx.pos.slot);
  const id = rotate(pick.ids, ctx.userSeed, "acc-ex", ctx.exposure + ctx.pos.slot);
  const ex = EXERCISES[id];
  return sized(
    ctx,
    "secondary",
    id,
    (n) => ({ kind: "sets", sets: n, reps: ex.category === "skill" ? 4 : 8, restSec: 45, perSide: ex.unilateral }),
    [minSets, 4],
    leftoverSec,
    { noteEs: "Trabajo complementario: cubre un patrón que hoy no tocaste para equilibrar la sesión.", evidence: EV.strength },
  );
}

/** Descansos más largos entre series para quien empieza o tiene una carga relativa alta (ver coach.ts). */
function scaleRest(blocks: WorkBlock[], mult: number): WorkBlock[] {
  if (mult <= 1.001) return blocks;
  const r5 = (s: number, cap: number) => Math.min(cap, Math.round((s * mult) / 5) * 5);
  return blocks.map((b) => {
    if (b.role === "warmup" || b.role === "cooldown") return b;
    const p = b.protocol;
    if ((p.kind === "sets" || p.kind === "complex" || p.kind === "carry") && volumeOf(p) > 1) return { ...b, protocol: { ...p, restSec: r5(p.restSec, 180) } };
    if (p.kind === "timed" && (p.sets ?? 1) > 1) return { ...b, protocol: { ...p, restSec: r5(p.restSec ?? 120, 240) } };
    if (p.kind === "ladder") return { ...b, protocol: { ...p, restSec: r5(p.restSec, 120) } };
    if (p.kind === "intervals" && p.restSec > 0) return { ...b, protocol: { ...p, restSec: r5(p.restSec, Math.round(p.restSec * 1.5)) } };
    return b;
  });
}

/**
 * Rampa de volumen de swings para principiantes: 4 series (o 6 rondas) la primera semana de swings y +2 por semana.
 * "Saltar directo a 100 aumenta el riesgo de agujetas severas y lesión" (protocolos.md §8.5).
 */
function rampSwings(blocks: WorkBlock[], ctx: Ctx): WorkBlock[] {
  if (ctx.level !== "novice") return blocks;
  const swingWeeks = Math.max(0, Math.floor((ctx.input.dayIndex - ctx.coach.swingFromDay) / 7)); // semanas desde el primer swing
  const cap = 4 + 2 * swingWeeks;
  return blocks.map((b) => {
    if (b.exerciseId !== "two-hand-swing" || b.role === "warmup" || b.role === "cooldown") return b;
    const p = b.protocol;
    if (p.kind === "sets" && p.sets > cap) return { ...b, protocol: { ...p, sets: cap } };
    if (p.kind === "intervals" && p.rounds > cap + 4) return { ...b, protocol: { ...p, rounds: cap + 4 } };
    if (p.kind === "timed" && (p.sets ?? 1) > 2 && swingWeeks < 2) return { ...b, protocol: { ...p, sets: 2 } };
    return b;
  });
}

// ───────────────────────── Bloques de calentamiento y vuelta a la calma (RAMP) ─────────────────────────

function warmup(ctx: Ctx, primary: ExerciseId): WorkBlock[] {
  const m = clampMinutes(ctx.input.settings.minutes);
  const blocks: WorkBlock[] = [];
  blocks.push(
    makeBlock(ctx, "warmup", "halo", { kind: "flow", seconds: 30, reps: 5 }, {
      noteEs: "Suelta los hombros y abre el pecho. Sin prisa.",
      evidence: EV.warmup,
    }),
  );
  blocks.push(
    makeBlock(ctx, "warmup", "prying-goblet-squat", { kind: "flow", seconds: m > 10 ? 40 : 25 }, {
      noteEs: "Abre la cadera y respira abajo. Sube cuando sientas espacio.",
      evidence: EV.warmup,
    }),
  );
  if (m >= 25) {
    blocks.push(
      makeBlock(ctx, "warmup", "hip-bridge", { kind: "flow", seconds: 30, reps: 8 }, {
        noteEs: "Activa glúteos: es el motor de casi todo lo que viene.",
        evidence: EV.warmup,
      }),
    );
  }
  const ex = EXERCISES[primary];
  if (ex.category !== "carry" && ex.category !== "mobility" && ex.id !== "turkish-get-up") {
    // La activación de bisagra no puede ser un swing si el plan promete no tenerlos (espalda baja, carga relativa alta o los primeros días).
    const noSwings = ctx.input.settings.lowBackCare === true || ctx.coach.lowImpact || (ctx.level === "novice" && ctx.input.dayIndex < ctx.coach.swingFromDay);
    const hingeWarm: ExerciseId = noSwings ? "kettlebell-deadlift" : "two-hand-swing";
    const potent = ex.pattern === "hinge" || ex.id === "clean" || ex.id === "snatch" ? hingeWarm : primary;
    blocks.push(
      makeBlock(ctx, "warmup", potent, { kind: "flow", seconds: 30, reps: 5 }, {
        bellKg: lightBell(ctx, 0.55),
        noteEs: "Potenciación: 5 repeticiones ligeras del patrón que vas a trabajar.",
        evidence: EV.warmup,
      }),
    );
  }
  return blocks;
}

function cooldown(ctx: Ctx): WorkBlock[] {
  // La vuelta a la calma activa tiene poca evidencia (Van Hooren 2018): en sesiones de 10 min se omite.
  if (clampMinutes(ctx.input.settings.minutes) <= 10) return [];
  return [
    makeBlock(ctx, "cooldown", "prying-goblet-squat", { kind: "flow", seconds: 45 }, {
      noteEs: "Baja las pulsaciones: respira lento por la nariz.",
      evidence: EV.warmup,
    }),
  ];
}

// ───────────────────────── Constructores por enfoque ─────────────────────────

interface Built {
  blocks: WorkBlock[];
  why: string[];
}

function finisherCarry(ctx: Ctx, targetSec: number, minSets = 2): WorkBlock | null {
  if (targetSec < 70) return null;
  const id = pickFrom(ctx, "carry", ["suitcase-carry", "rack-carry", "waiter-carry", "farmer-carry"]);
  const perSide = EXERCISES[id].unilateral;
  const secs = ctx.level === "novice" ? 30 : 40;
  return sized(ctx, "finisher", id, (n) => ({ kind: "carry", sets: n, seconds: secs, restSec: 30, perSide }), [minSets, 5], targetSec, {
    noteEs: "Acarreo: camina alto y respira. El core trabaja sin que lo notes.",
    evidence: EV.carry,
  });
}

/**
 * Puerta de seguridad para principiantes: las primeras 2 semanas el "día de potencia" enseña la bisagra con peso muerto
 * y sentadilla goblet (sin lanzar la pesa). Los swings llegan cuando la bisagra ya es limpia.
 */
function buildHingeLesson(ctx: Ctx, main: number): Built {
  const [s1, s2, s3] = SHARES.power;
  const primary = sized(ctx, "primary", "kettlebell-deadlift", (n) => ({ kind: "sets", sets: n, reps: 8, restSec: 60 }), [3, 8], main * s1, {
    noteEs: "Aprende la bisagra: cadera atrás, espalda larga. Esto es la base del swing.",
    evidence: [...EV.swing, "mcgill2012"],
  });
  const secondary = sized(ctx, "secondary", "goblet-squat", (n) => ({ kind: "sets", sets: n, reps: 8, restSec: 60 }), [2, 5], main * s2, {
    noteEs: "Sentadilla con la pesa al pecho: postura erguida y rodillas afuera.",
    evidence: EV.strength,
  });
  const fin = finisherCarry(ctx, main * s3);
  return {
    blocks: [primary, secondary, ...(fin ? [fin] : [])],
    why: [
      "Antes de lanzar la pesa (swing) se aprende la bisagra: el swing exige una bisagra limpia y el cizallamiento lumbar es particular de este ejercicio (McGill 2012).",
      `Los swings entran desde el día ${ctx.coach.swingFromDay} y con volumen en rampa, no con 100 de golpe.`,
    ],
  };
}

function buildPower(ctx: Ctx, main: number): Built {
  const [s1, s2, s3] = SHARES.power;
  const novice = ctx.level === "novice";
  if (novice && ctx.input.dayIndex < ctx.coach.swingFromDay) return buildHingeLesson(ctx, main);
  const adv = ctx.level === "advanced";
  const swing: ExerciseId = novice ? "two-hand-swing" : "one-arm-swing";

  type Fmt = { id: string; make: () => WorkBlock; why: string };
  const prim = main * s1;
  const formats: Fmt[] = [];

  // Simple & Sinister: 10 repeticiones por serie, 100 swings es el estándar de referencia.
  formats.push({
    id: "ss-sets",
    why: "Series de 10 swings con pausas cortas: estructura del 'Simple' de Simple & Sinister (P. Tsatsouline). Calidad antes que fatiga.",
    make: () =>
      sized(
        ctx,
        "primary",
        swing,
        (n) => ({ kind: "sets", sets: n, reps: 10, restSec: novice ? 45 : 30, alternateSides: !novice }),
        [4, 10],
        prim,
        { methodEs: "Simple & Sinister · P. Tsatsouline", noteEs: "10 repeticiones limpias por serie. Si la técnica se rompe, descansa más.", evidence: [...EV.swing, ...EV.time] },
      ),
  });

  if (!novice) {
    // EMOM: 10 reps al inicio de cada minuto, alternando manos. El ejemplo canónico de la app.
    formats.push({
      id: "emom",
      why: "EMOM (cada minuto al minuto): 10 swings a una mano al inicio de cada minuto y el resto del minuto es descanso. Densidad controlada y mano alterna.",
      make: () =>
        sized(ctx, "primary", "one-arm-swing", (n) => ({ kind: "emom", minutes: n, repsPerMinute: 10, alternateSides: true }), [6, adv ? 14 : 12], prim, {
          methodEs: "Adaptado de Simple & Sinister · P. Tsatsouline",
          noteEs: "Empieza cada minuto con 10 swings. Lo que sobre del minuto es tu descanso.",
          evidence: [...EV.swing, ...EV.time],
        }),
    });
  }

  // Intervalos 30:30 (protocolo del RCT de Lake & Lauder 2012: 12 series de 30 s de swings por 30 s de pausa).
  formats.push({
    id: "int-30-30",
    why: "Intervalos de 30 s de swings por 30 s de pausa: el formato con el que se estudió la mejora de fuerza y potencia con swings (Lake & Lauder 2012).",
    make: () =>
      sized(
        ctx,
        "primary",
        swing,
        (n) => ({ kind: "intervals", workSec: novice ? 20 : 30, restSec: novice ? 40 : 30, rounds: n, alternateSides: !novice }),
        [6, 16],
        prim,
        { methodEs: "30:30 · Lake & Lauder 2012", noteEs: "Trabajo explosivo, pausa completa: cada intervalo debe verse igual al primero.", evidence: EV.intervals },
      ),
  });

  if (!novice) {
    formats.push({
      id: "clean-sets",
      why: "Cleans con descanso completo: el clean entrena potencia de cadera y control del rack con menos fatiga cardiovascular que los swings seguidos.",
      make: () =>
        sized(ctx, "primary", "clean", (n) => ({ kind: "sets", sets: n, reps: 5, restSec: 60, perSide: true }), [3, 14], prim, {
          noteEs: "5 por lado. Pesa cerca del cuerpo, aterriza suave en el rack.",
          evidence: ["lyons2017", ...EV.time],
        }),
    });
  }
  if (adv) {
    formats.push({
      id: "snatch-sets",
      why: "Snatch en series cortas: máxima coordinación balística con descanso suficiente para mantener la técnica.",
      make: () =>
        sized(ctx, "primary", "snatch", (n) => ({ kind: "sets", sets: n, reps: 5, restSec: 75, perSide: true }), [3, 14], prim, {
          noteEs: "5 por lado. La mano pasa rápido por encima: golpea hacia arriba y bloquea.",
          evidence: ["lake2014", "mcgill2012"],
        }),
    });
  }

  const fmt = rotate(formats, ctx.userSeed, "power-fmt", ctx.exposure + ctx.pos.mesocycle);
  const primary = fmt.make();

  const secondaryId = pickFrom(
    ctx,
    "power-sec",
    novice ? ["one-arm-row", "goblet-squat"] : ["one-arm-row", "goblet-squat", "high-pull", "front-squat"],
  );
  const sec = EXERCISES[secondaryId];
  const secondary = sized(
    ctx,
    "secondary",
    secondaryId,
    (n) => ({ kind: "sets", sets: n, reps: sec.category === "ballistic" ? 6 : 8, restSec: 45, perSide: sec.unilateral }),
    [2, 4],
    main * s2,
    { noteEs: "Equilibrio: tirón o sentadilla para compensar tanta bisagra.", evidence: EV.strength },
  );

  const fin = finisherCarry(ctx, main * s3);
  return {
    blocks: [primary, secondary, ...(fin ? [fin] : [])],
    why: [fmt.why, "El segundo bloque trabaja un patrón distinto al de la bisagra para repartir el estrés y mantener el equilibrio muscular."],
  };
}

function buildStrength(ctx: Ctx, main: number): Built {
  const [s1, s2, s3] = SHARES.strength;
  const phase = ctx.pos.phase;
  const novice = ctx.level === "novice";
  const adv = ctx.level === "advanced";

  // Énfasis alterno: si la semana tiene dos días de fuerza, uno es de tren superior y el otro de inferior.
  const upper = (ctx.pos.slot + ctx.pos.weekIndex) % 2 === 0;
  const rest = adv ? 120 : novice ? 75 : 90;

  let primaryId: ExerciseId;
  let secondaryId: ExerciseId;
  if (upper) {
    primaryId = pickFrom(ctx, "str-up", novice ? (ctx.input.dayIndex <= 14 ? ["floor-press", "half-kneeling-press"] : ["strict-press", "half-kneeling-press", "floor-press"]) : ["strict-press", "clean-and-press", "floor-press", "push-press"]);
    secondaryId = "one-arm-row";
  } else {
    primaryId = pickFrom(ctx, "str-lo", novice ? ["goblet-squat", "kettlebell-deadlift"] : ["goblet-squat", "front-squat", "kettlebell-deadlift", "reverse-lunge-racked", "single-leg-rdl"]);
    const isHinge = EXERCISES[primaryId].pattern === "hinge";
    secondaryId = pickFrom(ctx, "str-lo2", isHinge ? ["goblet-squat", "front-squat", "reverse-lunge-racked"] : ["kettlebell-deadlift", "single-leg-rdl", "hip-bridge"]);
  }
  const p = EXERCISES[primaryId];
  const perSide = p.unilateral;

  // Formato según fase (periodización ondulante: más reps al inicio del ciclo, menos y más pesado al final).
  let make: (n: number) => Protocol;
  let range: [number, number];
  let fmtEs: string;
  const usePush = p.pattern === "push" || p.id === "clean-and-press";
  if (phase === "peak" && usePush && p.id !== "floor-press") {
    // Escaleras de Pavel 1-2-3 por lado.
    make = (n) => ({ kind: "ladder", rungs: [1, 2, 3], rounds: n, restSec: 20, perSide });
    range = [2, 6];
    fmtEs = "Escaleras 1-2-3 por lado (Rite of Passage, P. Tsatsouline): volumen total moderado con repeticiones de alta calidad.";
  } else if (phase === "accumulate") {
    make = (n) => ({ kind: "sets", sets: n, reps: usePush ? 6 : 8, restSec: rest, perSide });
    range = [3, 5];
    fmtEs = "Series de volumen moderado al inicio del mesociclo: se acumula trabajo con una carga que deja 3-4 repeticiones en reserva.";
  } else if (phase === "deload") {
    make = (n) => ({ kind: "sets", sets: n, reps: usePush ? 4 : 6, restSec: rest, perSide });
    range = [2, 3];
    fmtEs = "Semana de descarga: mismo patrón con ~40% menos de volumen para recuperar sin perder el hábito.";
  } else {
    make = (n) => ({ kind: "sets", sets: n, reps: usePush ? 5 : 6, restSec: rest, perSide });
    range = [3, 6];
    fmtEs = "Series de 5-8 repeticiones con descanso de 1,5-2 min: rango de fuerza con margen de seguridad (sin llegar al fallo).";
  }

  const primary = sized(ctx, "primary", primaryId, make, range, main * s1, {
    methodEs: phase === "peak" && usePush ? "Escaleras · P. Tsatsouline" : "Easy Strength · P. Tsatsouline",
    noteEs: "Nunca al fallo: termina cada serie sabiendo que podrías hacer 2-3 más.",
    evidence: [...EV.strength, ...EV.periodization],
  });
  const sec = EXERCISES[secondaryId];
  const secondary = sized(
    ctx,
    "secondary",
    secondaryId,
    (n) => ({ kind: "sets", sets: n, reps: 8, restSec: 60, perSide: sec.unilateral }),
    [2, 4],
    main * s2,
    { noteEs: "Trabajo complementario: el patrón opuesto equilibra la sesión.", evidence: EV.strength },
  );
  const fin = finisherCarry(ctx, main * s3);
  return {
    blocks: [primary, secondary, ...(fin ? [fin] : [])],
    why: [
      fmtEs,
      upper
        ? "Día con énfasis de empuje y tirón: se alterna con un día de tren inferior para que cada patrón se entrene al menos 2 veces por semana."
        : "Día con énfasis de tren inferior: sentadilla y bisagra se alternan para repartir la carga sobre cadera y rodilla.",
    ],
  };
}

function buildEndurance(ctx: Ctx, main: number): Built {
  const [s1, , s3] = SHARES.endurance;
  const novice = ctx.level === "novice";
  const adv = ctx.level === "advanced";
  const prim = main * s1;

  type Fmt = { id: string; why: string; make: () => WorkBlock };
  const formats: Fmt[] = [];
  const early = novice && ctx.input.dayIndex < ctx.coach.swingFromDay;
  const spare = ctx.input.settings.lowBackCare === true || early || ctx.coach.lowImpact;

  if (spare) {
    formats.push({
      id: "goblet-intervals",
      why: early
        ? "Primeras semanas: el trabajo cardiovascular se hace con sentadillas goblet por intervalos mientras aprendes la bisagra."
        : "Cuidado de espalda baja activo: el trabajo cardiovascular se hace con sentadillas goblet por intervalos, sin ejercicios balísticos.",
      make: () =>
        sized(ctx, "primary", "goblet-squat", (n) => ({ kind: "intervals", workSec: 40, restSec: 20, rounds: n }), [6, 18], prim, {
          noteEs: "40 s de sentadillas con ritmo cómodo, 20 s para respirar.",
          evidence: [...EV.intervals],
        }),
    });
  }

  if (!spare) formats.push({
    id: "timed-swings",
    why: "Series largas de swings a ritmo constante: trabajo aeróbico-resistivo continuo con cadencia fija. La intensidad es alta pero sostenible.",
    make: () =>
      sized(
        ctx,
        "primary",
        novice ? "two-hand-swing" : "one-arm-swing",
        (n) => ({ kind: "timed", minutes: Math.min(5, 2 + Math.floor(n / 2)), targetRpm: novice ? 20 : 22, switchEverySec: novice ? undefined : 60, sets: Math.max(1, Math.ceil(n / 2)), restSec: 90 }),
        [2, 8],
        prim,
        { noteEs: "Ritmo parejo, sin sprints. Si no puedes hablar una frase corta, baja un poco la cadencia.", evidence: [...EV.swingCardio, ...EV.rpe] },
      ),
  });

  if (!spare) formats.push({
    id: "int-40-20",
    why: "Intervalos de 40 s de trabajo y 20 s de pausa: la intensidad de la serie sube porque la pausa es corta.",
    make: () =>
      sized(
        ctx,
        "primary",
        novice ? "two-hand-swing" : "one-arm-swing",
        (n) => ({ kind: "intervals", workSec: 40, restSec: 20, rounds: n, alternateSides: !novice }),
        [6, 18],
        prim,
        { noteEs: "40 s a ritmo fuerte, 20 s para recuperar. Mantén la técnica hasta la última ronda.", evidence: [...EV.intervals, ...EV.swingCardio] },
      ),
  });

  if (!novice && !spare) {
    formats.push({
      id: "gs-clean",
      why: "Series largas de clean con cambio de mano cada minuto, inspiradas en el entrenamiento de Girevoy Sport (kettlebell sport) a cadencia recreativa.",
      make: () =>
        sized(
          ctx,
          "primary",
          "clean",
          (n) => ({ kind: "timed", minutes: Math.min(5, 2 + Math.floor(n / 2)), targetRpm: 8, switchEverySec: 60, sets: Math.max(1, Math.ceil(n / 2)), restSec: 120 }),
          [2, 8],
          prim,
          { methodEs: "Girevoy Sport (recreativo)", noteEs: "8 repeticiones por minuto, cambio de mano cada 60 s. Relaja los antebrazos.", evidence: EV.snatchCardio },
        ),
    });
  }
  if (adv && !spare) {
    formats.push({
      id: "snatch-15-15",
      why: "Snatch a una mano con 15 s de trabajo y 15 s de pausa: el protocolo con el que se midió la respuesta cardiovascular al snatch (ACE 2010) y se entrenó VO2máx (Falatic 2015).",
      make: () =>
        sized(ctx, "primary", "snatch", (n) => ({ kind: "intervals", workSec: 15, restSec: 15, rounds: n, alternateSides: true }), [8, 40], prim, {
          methodEs: "15:15 snatch · Falatic 2015",
          noteEs: "15 s de trabajo, 15 s de pausa. Cambia de mano cada intervalo.",
          evidence: EV.snatchCardio,
        }),
    });
  }

  const fmt = rotate(formats, ctx.userSeed, "end-fmt", ctx.exposure + ctx.pos.mesocycle);
  const primary = fmt.make();
  const fin = finisherCarry(ctx, main * s3, 2);
  return {
    blocks: [primary, ...(fin ? [fin] : [])],
    why: [
      fmt.why,
      "La intensidad cardiovascular de estos formatos es real pero no superior a otras formas de cardio a igual esfuerzo: se usan por su versatilidad y su carga de fuerza-resistencia.",
    ],
  };
}

function buildHybrid(ctx: Ctx, main: number): Built {
  const [s1, , s3] = SHARES.hybrid;
  type Cx = { id: string; items: { exerciseId: ExerciseId; reps: number }[]; perSide: boolean; why: string };
  const opts: Cx[] = [
    {
      id: "cpf",
      items: [
        { exerciseId: "clean", reps: 3 },
        { exerciseId: "strict-press", reps: 3 },
        { exerciseId: "front-squat", reps: 3 },
      ],
      perSide: true,
      why: "Complejo clean → press → sentadilla frontal sin soltar la pesa (estructura del Armor Building Formula adaptada a una pesa).",
    },
    {
      id: "swing-squat",
      items: [
        { exerciseId: "two-hand-swing", reps: 10 },
        { exerciseId: "goblet-squat", reps: 6 },
      ],
      perSide: false,
      why: "Complejo swing → sentadilla goblet: combina la bisagra balística con una sentadilla lenta para variar el estímulo sin cambiar de pesa.",
    },
    {
      id: "clean-squat-press",
      items: [
        { exerciseId: "clean", reps: 2 },
        { exerciseId: "front-squat", reps: 2 },
        { exerciseId: "strict-press", reps: 2 },
      ],
      perSide: true,
      why: "Complejo corto de calidad (2 repeticiones por movimiento): máxima técnica con una carga que se puede subir.",
    },
  ];
  const c = rotate(opts, ctx.userSeed, "hyb-fmt", ctx.exposure + ctx.pos.mesocycle);
  // La pesa se elige para el eslabón más débil del complejo (el de menor factor de carga).
  const lead = c.items.reduce((a, b) => (EXERCISES[b.exerciseId].loadFactor < EXERCISES[a.exerciseId].loadFactor ? b : a)).exerciseId;
  const primary = sized(
    ctx,
    "primary",
    lead,
    (n) => ({ kind: "complex", rounds: n, restSec: 75, items: c.items, perSide: c.perSide }),
    [3, 14],
    main * s1,
    { methodEs: c.id === "swing-squat" ? "Complejo con una pesa" : "Armor Building Formula · P. Tsatsouline", noteEs: "Sin soltar la pesa entre movimientos. Descansa completo entre rondas.", evidence: EV.complex },
  );
  const finisher = sized(
    ctx,
    "finisher",
    "two-hand-swing",
    (n) => ({ kind: "intervals", workSec: 30, restSec: 30, rounds: n }),
    [2, 8],
    main * s3,
    { noteEs: "Remate de swings: 30 s fuertes, 30 s de pausa.", evidence: EV.intervals },
  );
  return { blocks: [primary, finisher], why: [c.why, "El remate de intervalos cierra con trabajo cardiovascular cuando la fuerza ya está hecha."] };
}

function buildSkill(ctx: Ctx, main: number): Built {
  const [s1, s2, s3] = SHARES.skill;
  const novice = ctx.level === "novice";
  const prim = main * s1;

  // Iniciación (primeras 4 semanas): un patrón básico y sencillo en vez del get-up turco, que llega después.
  const intro = novice && ctx.input.dayIndex <= 28;
  const introId = pickFrom(ctx, "skill-intro", ["goblet-squat", "hip-bridge", "half-kneeling-press"]);
  const ix = EXERCISES[introId];
  const primary = intro
    ? sized(ctx, "primary", introId, (n) => ({ kind: "sets", sets: n, reps: introId === "hip-bridge" ? 10 : 6, restSec: 45, perSide: ix.unilateral }), [2, 5], prim, {
        noteEs: "Hoy aprendes el movimiento con calma: cada repetición lenta y controlada. Si algo cuesta, hazlo más ligero o con menos rango.",
        evidence: EV.strength,
      })
    : novice
    ? sized(ctx, "primary", "turkish-get-up", (n) => ({ kind: "sets", sets: n, reps: 1, restSec: 30, perSide: true }), [2, 5], prim, {
        noteEs: "Despacio: cada etapa con pausa. Si la pesa te parece mucha, practica primero con el puño cerrado o con un zapato sobre el puño.",
        evidence: EV.tgu,
      })
    : sized(ctx, "primary", "turkish-get-up", (n) => ({ kind: "emom", minutes: n, repsPerMinute: 1, alternateSides: true }), [4, 10], prim, {
        methodEs: "Simple & Sinister · P. Tsatsouline",
        noteEs: "Un get-up por minuto, alternando lados: 10 en 10 minutos es el estándar 'Simple'.",
        evidence: EV.tgu,
      });

  const secId = pickFrom(ctx, "skill-sec", novice ? ["halo", "prying-goblet-squat", "half-kneeling-press"] : ["windmill", "bottom-up-press", "arm-bar", "halo"]);
  const sx = EXERCISES[secId];
  const secondary =
    sx.category === "mobility"
      ? sized(ctx, "secondary", secId, (n) => ({ kind: "sets", sets: n, reps: sx.id === "prying-goblet-squat" ? 5 : 6, restSec: 15, perSide: sx.unilateral }), [2, 4], main * s2, {
          noteEs: "Movilidad con control: rango completo, sin forzar.",
          evidence: EV.warmup,
        })
      : sized(ctx, "secondary", secId, (n) => ({ kind: "sets", sets: n, reps: 4, restSec: 30, perSide: true }), [2, 4], main * s2, {
          noteEs: "Pocas repeticiones, muy bien hechas: control antes que carga.",
          evidence: EV.tgu,
        });

  // Práctica sub-máxima de bisagra ("greasing the groove"): pocas reps, frecuencia alta, sin fatiga.
  const practiceId: ExerciseId =
    ctx.input.settings.lowBackCare || ctx.coach.lowImpact || (novice && ctx.input.dayIndex < ctx.coach.swingFromDay) ? "kettlebell-deadlift" : "two-hand-swing";
  const practice = sized(ctx, "finisher", practiceId, (n) => ({ kind: "sets", sets: n, reps: 5, restSec: 30 }), [3, 6], main * s3, {
    methodEs: "Greasing the Groove · P. Tsatsouline",
    noteEs: "Series cortas y frescas: practica el patrón sin acumular fatiga.",
    evidence: EV.swing,
    bellKg: lightBell(ctx, 0.8),
  });
  return {
    blocks: [primary, secondary, practice],
    why: [
      intro
        ? "Día de técnica de iniciación: aprendes un patrón básico con calma antes de sumar carga; el get-up turco llega más adelante."
        : "Día de técnica: el Turkish get-up reparte la demanda entre hombro, core y cadera; la mayor exigencia del hombro aparece en la etapa del codo y en el barrido de pierna (St-Onge 2019).",
      "La práctica ligera de bisagra al final consolida el patrón sin sumar fatiga.",
    ],
  };
}

function buildRecovery(ctx: Ctx, totalMin: number): Built {
  const mins = Math.min(totalMin, 12);
  const targetSec = mins * 60;
  const novice = ctx.level === "novice";
  const options: Array<[ExerciseId, Protocol, string]> = [
    ["halo", { kind: "flow", seconds: 40, reps: 6 }, "Hombros sueltos. Cada vuelta, un poco más amplia."],
    ["prying-goblet-squat", { kind: "flow", seconds: 60 }, "Cuclillas profundas, respira abajo y suelta la cadera."],
    ["hip-bridge", { kind: "flow", seconds: 40, reps: 10 }, "Aprieta glúteos arriba, 1 segundo."],
    ["goblet-squat", { kind: "flow", seconds: 50, reps: 8 }, "Sentadilla lenta: 4 segundos bajando, 2 subiendo."],
    ["suitcase-carry", { kind: "carry", sets: 2, seconds: 40, restSec: 20, perSide: true }, "Camina erguido, hombros nivelados."],
    ["figure-8", { kind: "flow", seconds: 40 }, "Pasos suaves, ritmo constante, respiración libre."],
    ["arm-bar", { kind: "flow", seconds: 40, reps: 3, perSide: true }, "Rueda despacio. Respira y suelta las costillas."],
  ];
  const usable = options.filter(([id]) => allowed(EXERCISES[id], ctx));
  const picks = [...usable]
    .map((o, i) => ({ o, k: makeRng(ctx.userSeed, "rec", ctx.pos.weekIndex, i)() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.o);
  const blocks: WorkBlock[] = [];
  let acc = 0;
  for (const [id, protocol, note] of picks) {
    const block: WorkBlock = {
      id: `b${ctx.nextId++}`,
      role: blocks.length === 0 ? "primary" : "secondary",
      exerciseId: id,
      bellKg: lightBell(ctx, novice ? 0.4 : 0.5),
      protocol,
      rpeTarget: 3.5,
      noteEs: note,
      evidence: EV.warmup,
    };
    const est = blockEstimateSec(block);
    if (acc + est > targetSec * 1.05 && blocks.length >= 3) break;
    blocks.push(block);
    acc += est;
  }
  return {
    blocks,
    why: [
      "Recuperación activa: movimiento suave que mantiene el hábito y la movilidad sin sumar fatiga.",
      "Si hoy prefieres no hacer nada, marcar el descanso mantiene tu racha: el descanso también es parte del plan.",
    ],
  };
}

// ───────────────────────── Textos de la carta ─────────────────────────

const HOOKS: Record<Focus, string[]> = {
  power: [
    "La cadera dispara, la pesa obedece.",
    "Explosión controlada: rápido arriba, firme abajo.",
    "Hoy la potencia se construye con repeticiones perfectas.",
  ],
  strength: [
    "Fuerza sin fallo: deja siempre margen en la barra.",
    "Menos ego, más series buenas.",
    "Hoy se construye fuerza que se queda.",
  ],
  endurance: [
    "Ritmo parejo, respiración dueña del tempo.",
    "El motor aeróbico se entrena con constancia, no con heroicidades.",
    "Aguantar bien es una habilidad: se practica.",
  ],
  hybrid: [
    "Varios movimientos, una sola pesa, cero pausas innecesarias.",
    "Complejo de cuerpo completo: técnica bajo fatiga controlada.",
  ],
  skill: [
    "Hoy gana la técnica: lento, preciso y presente.",
    "Un buen movimiento hoy es peso extra mañana.",
    "Calidad de movimiento: la ventaja que nadie ve.",
  ],
  recovery: ["Recuperar también es entrenar.", "Movimiento suave para volver más fuerte.", "Hoy la meta es sentirte mejor al terminar."],
};

function cardTitle(focus: Focus, primary: WorkBlock): string {
  if (focus === "recovery") return "EL RESPIRO";
  if (focus === "hybrid") return "EL COMPLEJO";
  if (focus === "endurance") return primary.protocol.kind === "timed" ? "EL RELOJ" : "EL LATIDO";
  return EXERCISES[primary.exerciseId].cardEs;
}

// ───────────────────────── Función principal ─────────────────────────

function readinessOf(daysSinceLast: number | null): { readiness: "normal" | "reentry"; factor: number } {
  if (daysSinceLast !== null && daysSinceLast >= 10) return { readiness: "reentry", factor: 0.5 };
  if (daysSinceLast !== null && daysSinceLast >= 4) return { readiness: "reentry", factor: 0.7 };
  return { readiness: "normal", factor: 1 };
}

/** Enfoque que toca el Día N (barato: sin generar el plan). Lo usa la tabla del mes. */
export function focusOfDay(dayIndex: number, settings: UserSettings): Focus {
  const pos = cyclePosition(dayIndex, settings.primaryGoal);
  let focus = focusFor(pos, effectiveLevel(settings.level, dayIndex));
  // Cuidado de espalda baja: nada de potencia/híbrido balístico (se sustituyen por fuerza y técnica).
  if (settings.lowBackCare || coachingFor(settings, dayIndex).lowImpact) {
    if (focus === "power") focus = "strength";
    else if (focus === "hybrid") focus = "skill";
  }
  return focus;
}

// ───────────────────────── Ajuste EXACTO al tiempo elegido ─────────────────────────

const TOL_SEC = 8;

const totalSec = (blocks: WorkBlock[]) => planEstimateSec({ blocks });

/** Una unidad menos de volumen (para recortar), o null si ya está en el mínimo. */
function shrink(b: WorkBlock): WorkBlock | null {
  const v = volumeOf(b.protocol);
  const min = b.protocol.kind === "emom" ? 3 : 1;
  if (b.protocol.kind === "flow" || v <= min) return null;
  return { ...b, protocol: withVolume(b.protocol, v - 1) };
}

/** Descansos más largos entre series: legítimo en fuerza (recuperación entre series, Grgic 2018) y rellena el tiempo sin añadir carga. */
function moreRest(b: WorkBlock): WorkBlock | null {
  const p = b.protocol;
  if (volumeOf(p) < 2) return null; // con una sola serie no hay descanso entre series que alargar
  if (p.kind === "sets" && p.restSec < (b.role === "primary" ? 150 : 90)) return { ...b, protocol: { ...p, restSec: p.restSec + 10 } };
  if (p.kind === "complex" && p.restSec < 120) return { ...b, protocol: { ...p, restSec: p.restSec + 10 } };
  if (p.kind === "carry" && p.restSec < 60) return { ...b, protocol: { ...p, restSec: p.restSec + 10 } };
  if (p.kind === "timed" && (p.sets ?? 1) > 1 && (p.restSec ?? 120) < 180) return { ...b, protocol: { ...p, restSec: (p.restSec ?? 120) + 15 } };
  return null;
}

/** Descanso entre series de un bloque, si lo tiene (para el ajuste fino). */
function restOf(b: WorkBlock): number | null {
  const p = b.protocol;
  if (volumeOf(p) < 2) return null;
  if (p.kind === "sets" || p.kind === "complex" || p.kind === "carry") return p.restSec;
  if (p.kind === "timed" && (p.sets ?? 1) > 1) return p.restSec ?? 120;
  return null;
}
function withRest(b: WorkBlock, restSec: number): WorkBlock {
  const p = b.protocol;
  if (p.kind === "sets" || p.kind === "complex" || p.kind === "carry" || p.kind === "timed") return { ...b, protocol: { ...p, restSec } };
  return b;
}

const MOBILITY_FLOWS: ExerciseId[] = ["prying-goblet-squat", "hip-bridge", "halo"];

/**
 * Ajusta la sesión para que dure EXACTAMENTE lo elegido (si dice 20, son 20), y lo hace con trabajo útil, no con aire:
 *  1. si se pasa: recorta volumen del final hacia el principio y, al final, quita bloques de remate;
 *  2. si le falta: añade trabajo complementario real (un patrón que hoy no se tocó), alarga los descansos entre series
 *     (la recuperación entre series es legítima, Grgic 2018) y solo el resto corto lo absorbe la vuelta a la calma;
 *  3. un ajuste fino de descansos clava los últimos segundos.
 */
function fitExact(ctx: Ctx, input: WorkBlock[], targetSec: number): WorkBlock[] {
  let blocks = input.slice();
  const left = () => targetSec - totalSec(blocks);
  const isWork = (b: WorkBlock) => b.role !== "warmup" && b.role !== "cooldown";
  const order = () => [...blocks.keys()].filter((i) => isWork(blocks[i]!)).reverse(); // remate → secundario → principal

  // 1) recortar
  let guard = 0;
  while (left() < -TOL_SEC && guard++ < 80) {
    let did = false;
    for (const i of order()) {
      const s = shrink(blocks[i]!);
      if (s) {
        blocks[i] = s;
        did = true;
        break;
      }
    }
    if (!did) {
      const drop = blocks.findIndex((b) => b.role === "finisher" || b.role === "secondary");
      if (drop < 0) break;
      blocks = blocks.filter((_, k) => k !== drop);
    }
  }

  // 2a) trabajo complementario real (hasta 3 bloques; en las primeras semanas de iniciación ninguno o uno), antes del remate / la vuelta a la calma
  let added = 0;
  const maxAcc = ctx.coach.gentle ? (ctx.coach.introWeek <= 1 ? 0 : 1) : 3;
  while (left() >= 90 && added < maxAcc && ctx.focus !== "recovery") {
    const extra = accessory(ctx, blocks, Math.min(left(), 420), 90, 1);
    if (!extra) break;
    let at = blocks.findIndex((b) => b.role === "finisher");
    if (at < 0) at = blocks.findIndex((b) => b.role === "cooldown");
    const next = at < 0 ? [...blocks, extra] : [...blocks.slice(0, at), extra, ...blocks.slice(at)];
    if (totalSec(next) > targetSec + TOL_SEC) break;
    blocks = next;
    added++;
  }

  // 2b) descansos más largos entre series, bloque a bloque
  guard = 0;
  while (left() > TOL_SEC && guard++ < 120) {
    let did = false;
    for (let i = 0; i < blocks.length; i++) {
      if (!isWork(blocks[i]!)) continue;
      const m = moreRest(blocks[i]!);
      if (!m) continue;
      const next = blocks.slice();
      next[i] = m;
      if (totalSec(next) <= targetSec + TOL_SEC) {
        blocks = next;
        did = true;
      }
    }
    if (!did) break;
  }

  // 3) el resto corto lo absorbe la vuelta a la calma (respiración + movilidad), en tandas razonables
  const pureFlowAt = (role: WorkBlock["role"]) => blocks.findIndex((b) => b.role === role && b.protocol.kind === "flow" && b.protocol.reps === undefined);
  const nudge = (i: number, delta: number, cap: number) => {
    const p = blocks[i]!.protocol as Extract<Protocol, { kind: "flow" }>;
    blocks[i] = { ...blocks[i]!, protocol: { ...p, seconds: Math.max(15, Math.min(p.seconds + delta, cap)) } };
  };
  const coolCap = ctx.coach.gentle ? 300 : ctx.pos.phase === "deload" || ctx.readiness === "reentry" ? 240 : 150;

  if (left() > 1) {
    const ci = pureFlowAt("cooldown");
    if (ci >= 0) nudge(ci, left(), coolCap);
    else if (left() >= 15) {
      blocks.push(
        makeBlock(ctx, "cooldown", "prying-goblet-squat", { kind: "flow", seconds: Math.min(left() - PREP_FOR_BLOCK, coolCap) }, {
          noteEs: "Respira lento por la nariz: 4 segundos inhalando, 6 exhalando. Baja las pulsaciones.",
          evidence: EV.warmup,
        }),
      );
    }
  }
  // lo que exceda el tope: más movilidad, en tandas de hasta 90 s con otro ejercicio de flujo
  let k = 0;
  while (left() >= 25 && k < 6) {
    const id = MOBILITY_FLOWS[k % MOBILITY_FLOWS.length] as ExerciseId;
    const reps = id === "prying-goblet-squat" ? undefined : 6;
    blocks.push(
      makeBlock(ctx, "cooldown", id, reps ? { kind: "flow", seconds: 40, reps } : { kind: "flow", seconds: Math.min(left() - PREP_FOR_BLOCK, 90) }, {
        noteEs: "Movilidad suave para soltar lo trabajado. Sin forzar el rango.",
        evidence: EV.warmup,
      }),
    );
    k++;
  }

  if (Math.abs(left()) > 1) {
    const wi = pureFlowAt("warmup");
    if (wi >= 0) nudge(wi, left(), 90);
  }

  // 4) ajuste fino: ±segundos en los descansos hasta clavar el total
  guard = 0;
  while (Math.abs(left()) > 2 && guard++ < 8) {
    const want = left();
    let best: { i: number; b: WorkBlock; err: number } | null = null;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      const r = restOf(b);
      if (r === null || !isWork(b)) continue;
      for (let d = -12; d <= 24; d++) {
        if (d === 0 || r + d < 20) continue;
        const cand = withRest(b, r + d);
        const next = blocks.slice();
        next[i] = cand;
        const err = Math.abs(targetSec - totalSec(next));
        if (err < Math.abs(want) && (!best || err < best.err)) best = { i, b: cand, err };
      }
    }
    if (!best) break;
    blocks[best.i] = best.b;
  }
  // último recurso: si aún queda mucho, la vuelta a la calma admite un poco más
  if (Math.abs(left()) > TOL_SEC) {
    const ci = pureFlowAt("cooldown");
    if (ci >= 0) nudge(ci, left(), 420);
  }
  return blocks;
}

/** Segundos de preparación que se suman al abrir un bloque nuevo (ver steps.ts). */
const PREP_FOR_BLOCK = 5;

export function generateSession(input: GenerateInput): SessionPlan {
  const { settings, dayIndex } = input;
  const pos = cyclePosition(dayIndex, settings.primaryGoal);
  const level = effectiveLevel(settings.level, dayIndex);
  const focus = focusOfDay(dayIndex, settings);

  // Autorregulación: la sesión anterior ajusta el volumen de hoy (RPE/sensación, Zourdos 2016 · Helms 2016).
  const { readiness, factor: reentryFactor } = readinessOf(input.daysSinceLast);
  let fatigue = 1;
  if (input.lastFeel === 3 || (input.lastRpe ?? 0) >= 9) fatigue = 0.85;
  else if (input.lastFeel === 1 && (input.lastRpe ?? 10) <= 5) fatigue = 1.05;
  const coach = coachingFor(settings, dayIndex);
  const fill = Math.min(1.05, FILL[pos.phase] * reentryFactor * fatigue * coach.fill);

  const rpe = Math.max(
    3,
    Math.min(coach.rpeCap ?? 9, PHASE_RPE[pos.phase] + FOCUS_RPE_OFFSET[focus] + (level === "novice" ? -0.5 : 0) - (readiness === "reentry" ? 0.5 : 0)),
  );

  const bells = [...settings.bells].sort((a, b) => a - b);
  const ctx: Ctx = {
    input,
    pos,
    level,
    focus,
    rpe: focus === "recovery" ? 3.5 : rpe,
    fill,
    readiness,
    userSeed: input.uid,
    rng: makeRng(input.uid, dayIndex),
    bells: bells.length ? bells : [settings.referenceKg],
    ref: settings.referenceKg,
    exposure: pos.weekIndex,
    nextId: 1,
    coach,
  };

  const total = clampMinutes(settings.minutes);
  let blocks: WorkBlock[];
  let why: string[];

  if (focus === "recovery") {
    const b = buildRecovery(ctx, Math.max(6, Math.round(total * (readiness === "reentry" ? 0.7 : 1))));
    blocks = b.blocks;
    why = b.why;
  } else {
    const warmMin = total <= 10 ? 2 : total <= 15 ? 3 : 4;
    const coolMin = total <= 10 ? 0 : 1;
    const mainSec = Math.max(5 * 60, (total - warmMin - coolMin) * 60) * fill;
    const builders: Record<Exclude<Focus, "recovery">, (c: Ctx, m: number) => Built> = {
      power: buildPower,
      strength: buildStrength,
      endurance: buildEndurance,
      hybrid: buildHybrid,
      skill: buildSkill,
    };
    const built = builders[focus](ctx, mainSec);
    const lead = built.blocks[0] as WorkBlock;
    let mainBlocks = scaleRest(rampSwings(fillTo(clampToCaps(built.blocks), mainSec), ctx), coach.restMult);
    const usedSec = mainBlocks.reduce((a, b) => a + blockEstimateSec(b), 0);
    if (focus === "strength" || focus === "power" || focus === "skill") {
      let left = mainSec - usedSec;
      for (let k = 0; k < 2; k++) {
        const extra = accessory(ctx, mainBlocks, left / (2 - k));
        if (!extra) break;
        // El complemento va antes del remate (acarreo / práctica), que cierra la sesión.
        const at = mainBlocks.findIndex((b) => b.role === "finisher");
        mainBlocks = at < 0 ? [...mainBlocks, extra] : [...mainBlocks.slice(0, at), extra, ...mainBlocks.slice(at)];
        left -= blockEstimateSec(extra);
      }
    }
    blocks = [...warmup(ctx, lead.exerciseId), ...mainBlocks, ...cooldown(ctx)];
    why = built.why;
  }

  // La sesión dura EXACTAMENTE lo elegido (recuperación: su duración propia, máximo 12 min).
  const targetSec = (focus === "recovery" ? Math.min(total, 12) : total) * 60;
  blocks = fitExact(ctx, blocks, targetSec);

  // Textos de contexto (fase, readiness)
  const phaseWhy: Record<Phase, string> = {
    accumulate: "Semana 1 del ciclo (acumulación): se construye base de trabajo con esfuerzo moderado.",
    build: "Semana 2 del ciclo (construcción): sube la densidad o la carga manteniendo la técnica.",
    peak: "Semana 3 del ciclo (pico): la carga es la más alta del mes; el volumen se cuida.",
    deload: "Semana 4 del ciclo (descarga): menos volumen para absorber el trabajo de las 3 semanas anteriores.",
  };
  const extra = [phaseWhy[pos.phase]];
  if (readiness === "reentry") extra.push("Vuelta tras varios días sin entrenar: volumen reducido para retomar sin riesgo.");
  const evidence = Array.from(
    new Set([
      ...blocks.flatMap((b) => b.evidence),
      ...(pos.phase === "deload" ? EV.deload : []),
      ...(readiness === "reentry" ? EV.reentry : []),
      ...EV.rpe.slice(0, 1),
    ]),
  );

  const primaryBlock = (blocks.find((b) => b.role === "primary") ?? blocks[0]) as WorkBlock;
  const hooks = HOOKS[focus];
  const hookEs = hooks[Math.floor(ctx.rng() * hooks.length)] as string;

  const plan: SessionPlan = {
    id: `d${dayIndex}`,
    engineVersion: ENGINE_VERSION,
    dayIndex,
    focus,
    phase: pos.phase,
    week: pos.week,
    mesocycle: pos.mesocycle,
    theme: pos.theme,
    title: cardTitle(focus, primaryBlock),
    hookEs,
    durationMin: 0,
    durationSec: 0,
    rpeTarget: round1(ctx.rpe),
    blocks,
    whyEs: [...why, ...coach.notesEs, ...extra].slice(0, 5),
    evidence,
    readiness,
    restDayAllowed: focus === "recovery",
  };
  plan.durationSec = planEstimateSec(plan);
  plan.durationMin = Math.max(5, Math.round(plan.durationSec / 60));
  return plan;
}

/** Conveniencia: días calendario desde la última sesión (para `daysSinceLast`). */
export { MICRO_DAYS };
