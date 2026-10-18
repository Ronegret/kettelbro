/**
 * Contrato de tipos de kettellbro.
 *
 * Todo el motor de rutinas (src/lib/engine) es PURO: recibe datos, devuelve datos, no toca
 * red, reloj ni disco. Eso lo hace determinista, testeable y reutilizable en cliente y servidor.
 * La capa de datos (src/lib/data) solo persiste estos mismos tipos.
 */

// ───────────────────────── Vocabulario básico ─────────────────────────

/** Nivel de experiencia declarado. Controla ejercicios disponibles, volumen y RPE objetivo. */
export type Level = "novice" | "intermediate" | "advanced";

/** Enfoque del día. Es la "tinta" con la que se pinta la carta del día en la UI. */
export type Focus = "power" | "strength" | "endurance" | "hybrid" | "skill" | "recovery";

/** Fase dentro del mesociclo de 4 semanas (3 de carga + 1 de descarga). */
export type Phase = "accumulate" | "build" | "peak" | "deload";

/** Tema del mesociclo: el "acento" de un bloque de 4 semanas. Rota para dar variedad a escala de meses. */
export type MesoTheme = "foundation" | "strength" | "power" | "conditioning";

/** Patrón de movimiento. El motor equilibra patrones a lo largo de la semana. */
export type Pattern =
  | "hinge"
  | "squat"
  | "lunge"
  | "push"
  | "pull"
  | "carry"
  | "core"
  | "full-body"
  | "mobility";

export type ExerciseCategory = "ballistic" | "grind" | "carry" | "skill" | "mobility";

/** Meta principal elegida en el onboarding; sesga la rotación de enfoques. */
export type PrimaryGoal = "balanced" | "strength" | "power" | "endurance";

/** Ids canónicos de ejercicio (kebab-case, inglés). Cualquier id nuevo debe añadirse aquí. */
export type ExerciseId =
  | "kettlebell-deadlift"
  | "two-hand-swing"
  | "one-arm-swing"
  | "single-leg-rdl"
  | "hip-bridge"
  | "goblet-squat"
  | "prying-goblet-squat"
  | "front-squat"
  | "reverse-lunge-racked"
  | "strict-press"
  | "push-press"
  | "floor-press"
  | "half-kneeling-press"
  | "one-arm-row"
  | "high-pull"
  | "clean"
  | "snatch"
  | "clean-and-press"
  | "turkish-get-up"
  | "windmill"
  | "halo"
  | "arm-bar"
  | "bottom-up-press"
  | "suitcase-carry"
  | "rack-carry"
  | "farmer-carry"
  | "bottom-up-carry"
  | "waiter-carry"
  | "figure-8";

// ───────────────────────── Biblioteca de ejercicios ─────────────────────────

export interface Exercise {
  id: ExerciseId;
  nameEs: string;
  /** Forma corta en mayúsculas para titulares de pasos: "SWINGS", "GET-UPS". */
  shortEs: string;
  /** Nombre de la carta cuando este ejercicio lidera la sesión: "EL SWING". */
  cardEs: string;
  pattern: Pattern;
  category: ExerciseCategory;
  /** Cuántas pesas se sostienen a la vez (1 o 2). */
  bells: 1 | 2;
  /** true si se trabaja un lado por vez (se alterna o se hace por lado). */
  unilateral: boolean;
  /** Nivel mínimo recomendado. */
  level: Level;
  muscles: string[];
  /** 3-4 cues cortos, pensados para decirse en voz alta. */
  cues: string[];
  /** Error común nº1 y cómo evitarlo. */
  mistake: string;
  /** Para movimientos por etapas (Turkish get-up): una frase por etapa, en orden. */
  stagesEs?: string[];
  regression?: ExerciseId;
  progression?: ExerciseId;
  /** Segundos por repetición para el metrónomo visual/sonoro (aprox.). */
  secPerRep: number;
  /** Texto de cadencia legible: "1 rep cada 2 s". */
  cadenceEs: string;
  /**
   * Peso relativo respecto a la "pesa de referencia" del usuario (la que domina en swing a dos manos).
   * Heurística de coaching (no cifra de estudio); luego la corrige la progresión por RPE.
   */
  loadFactor: number;
  /** Ids en evidence.json que respaldan el uso del ejercicio. */
  evidence: string[];
  /** Clave de animación en ExerciseFigure. */
  figure: ExerciseId;
}

// ───────────────────────── Protocolos de bloque ─────────────────────────

/**
 * Cómo se ejecuta un bloque. El reproductor de sesión compila cada protocolo en pasos
 * (ver compileSteps). Todos los tiempos en segundos.
 */
export type Protocol =
  /** Series clásicas: `sets` series de `reps`, descanso entre series. perSide = cada serie se hace por ambos lados; alternateSides = una serie por lado alternando. */
  | { kind: "sets"; sets: number; reps: number; restSec: number; perSide?: boolean; alternateSides?: boolean }
  /** EMOM: cada minuto, `repsPerMinute` repeticiones; el resto del minuto es descanso. */
  | { kind: "emom"; minutes: number; repsPerMinute: number; alternateSides?: boolean }
  /** Escaleras (Pavel): rungs = [1,2,3] por ronda, descanso al terminar cada escalera. */
  | { kind: "ladder"; rungs: number[]; rounds: number; restSec: number; perSide?: boolean }
  /** Intervalos trabajo/descanso (Tabata, 10:10, 20:40). Las reps son libres con técnica limpia. */
  | { kind: "intervals"; workSec: number; restSec: number; rounds: number; alternateSides?: boolean }
  /** Series continuas tipo Girevoy Sport: `minutes` a `targetRpm` reps/min, cambio de mano cada `switchEverySec`. */
  | { kind: "timed"; minutes: number; targetRpm: number; switchEverySec?: number; sets?: number; restSec?: number }
  /** Acarreos / sostenidos por tiempo. */
  | { kind: "carry"; sets: number; seconds: number; restSec: number; perSide?: boolean }
  /** Movilidad / fluidos por tiempo (calentamiento y vuelta a la calma). */
  | { kind: "flow"; seconds: number; reps?: number; perSide?: boolean }
  /** Complejo: varios ejercicios encadenados sin soltar la pesa; cada ronda = una pasada completa. */
  | { kind: "complex"; rounds: number; restSec: number; items: ComplexItem[]; perSide?: boolean };

export interface ComplexItem {
  exerciseId: ExerciseId;
  reps: number;
}

export type BlockRole = "warmup" | "primary" | "secondary" | "finisher" | "cooldown";

export interface WorkBlock {
  id: string;
  role: BlockRole;
  exerciseId: ExerciseId;
  /** Peso de la(s) pesa(s) en kg. */
  bellKg: number;
  /**
   * Progresión con pesas discretas (saltos de 4 kg): una fracción `altShare` (0-1) de las series/minutos
   * se hace con la pesa siguiente `altBellKg`, repartidas de forma pareja. Sube de a poco hasta saltar del todo.
   */
  altBellKg?: number;
  altShare?: number;
  /** Método de práctica que inspira la estructura (no es un estudio): "Simple & Sinister · P. Tsatsouline". */
  methodEs?: string;
  protocol: Protocol;
  /** RPE objetivo (escala 1-10) para este bloque. */
  rpeTarget: number;
  /** Texto corto de coach para este bloque (en español). */
  noteEs?: string;
  /** Ids de evidencia que respaldan ESTE bloque (formato/volumen/descanso). */
  evidence: string[];
}

// ───────────────────────── Plan de sesión ─────────────────────────

export interface SessionPlan {
  /** `d${dayIndex}`. Estable: el mismo día siempre produce el mismo id. */
  id: string;
  /** Versión del algoritmo que generó el plan (para migraciones). */
  engineVersion: number;
  dayIndex: number;
  focus: Focus;
  phase: Phase;
  /** Semana dentro del mesociclo (1-4). */
  week: number;
  /** Número de mesociclo (1, 2, 3, ...). */
  mesocycle: number;
  theme: MesoTheme;
  /** Nombre de la carta: "EL SWING", "LA SENTADILLA"... */
  title: string;
  /** Frase gancho de una línea. */
  hookEs: string;
  /** Duración total en minutos (incluye calentamiento y vuelta a la calma): coincide con lo que elegiste. */
  durationMin: number;
  /** Duración exacta en segundos: es la suma de todos los pasos (preparación, trabajo y descansos). */
  durationSec: number;
  /** RPE objetivo medio de la sesión (1-10). */
  rpeTarget: number;
  blocks: WorkBlock[];
  /** 2-4 viñetas "por qué hoy toca esto" (explicación fisiológica corta). */
  whyEs: string[];
  /** Unión de evidencias de los bloques (para el panel "Respaldo científico"). */
  evidence: string[];
  /** 'reentry' si el usuario volvió tras varios días: volumen reducido. */
  readiness: "normal" | "reentry";
  /** Día de descanso total permitido (solo en focus === 'recovery'). */
  restDayAllowed: boolean;
}

// ───────────────────────── Compilación a pasos (lo que reproduce el player) ─────────────────────────

export type Side = "left" | "right" | "both";

interface StepBase {
  /** Índice dentro del plan completo. */
  index: number;
  blockId: string;
  exerciseId: ExerciseId;
  role: BlockRole;
  bellKg: number;
  /** Instrucción monumental de una línea ("10 SWINGS"), la que muestra el player. */
  titleEs: string;
  /** Subtítulo ("una mano · 16 kg · cada minuto"). */
  subtitleEs: string;
}

export interface WorkStep extends StepBase {
  kind: "work";
  /**
   * Todas las series se guían POR TIEMPO: cuenta atrás y avance automático, sin preguntar "¿ya terminaste?".
   * ('reps' solo existe en borradores antiguos.)
   */
  mode: "reps" | "timed";
  side: Side;
  setIndex: number;
  setCount: number;
  targetReps?: number;
  /** Para complejos: secuencia de ejercicios de la ronda (la figura los recorre en orden). */
  sequence?: ComplexItem[];
  /** Duración del trabajo en segundos. Es exacta: si dice 20, son 20. */
  durationSec?: number;
  /** Segundos de preparación ANTES del trabajo (3-2-1 con el ejercicio presentado). Cuentan dentro del tiempo de la sesión. */
  prepSec?: number;
  /** Texto de la preparación: "Prepárate" o "Cambia de lado". */
  prepLabelEs?: string;
  /** true si las repeticiones están prescritas (se cuentan en voz y pantalla y entran a la progresión). */
  countReps?: boolean;
  /** Cada cuántos segundos cae una repetición (metrónomo y contador). */
  repEverySec?: number;
  /** Segundos por repetición para el metrónomo (si aplica). */
  secPerRep?: number;
  /** true cuando es una ventana EMOM: el paso dura el minuto y termina solo. */
  emom?: boolean;
  /** Posición dentro de un EMOM / intervalo: "3/10". */
  roundLabel?: string;
}

export interface RestStep extends StepBase {
  kind: "rest";
  durationSec: number;
  /** Qué viene después, para mostrarlo durante el descanso. */
  nextTitleEs: string;
}

export type Step = WorkStep | RestStep;

// ───────────────────────── Registro de resultados ─────────────────────────

export interface SetLog {
  exerciseId: ExerciseId;
  blockId: string;
  setIndex: number;
  side: Side;
  reps: number;
  bellKg: number;
  durationSec?: number;
  /** true si el usuario saltó la serie. */
  skipped?: boolean;
}

/** Sensación de la sesión: 1 = fácil, 2 = justa, 3 = durísima. Alimenta la progresión junto al RPE. */
export type Feel = 1 | 2 | 3;

export interface SessionLog {
  id: string;
  dayIndex: number;
  /** Fecha local YYYY-MM-DD (la del dispositivo del usuario al terminar). */
  date: string;
  focus: Focus;
  title: string;
  phase: Phase;
  mesocycle: number;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  durationSec: number;
  rpe: number; // 1-10, percibido por el usuario al terminar
  feel: Feel;
  sets: SetLog[];
  totalReps: number;
  /** Tonelaje = suma(reps × kg) ; en carries, segundos×kg/10 no se cuenta (solo reps). */
  tonnageKg: number;
  xpEarned: number;
  /** true si fue un día de descanso total registrado (mantiene racha). */
  restDay?: boolean;
}

// ───────────────────────── Estado del programa / progresión ─────────────────────────

export interface ExerciseMemory {
  /** Última pesa usada con éxito (kg). */
  bellKg: number;
  /** Etapa de progresión doble: 0 = reps base; sube hasta el techo y luego cambia de pesa. */
  stage: number;
  lastReps: number;
  lastRpe: number;
  lastDayIndex: number;
  /** Mejor registro (reps con la pesa más alta). */
  bestBellKg: number;
  bestReps: number;
}

export type ExerciseMemoryMap = Partial<Record<ExerciseId, ExerciseMemory>>;

export interface ProgramTotals {
  sessions: number;
  restDays: number;
  reps: number;
  tonnageKg: number;
  minutes: number;
}

export interface ProgramState {
  schemaVersion: number;
  /** Número del día que TOCA hoy (1-based). "Día 45". */
  dayIndex: number;
  startedAt: number;
  /** Fecha local YYYY-MM-DD de la última sesión completada, o null. */
  lastSessionDate: string | null;
  streak: number;
  bestStreak: number;
  /** Escudos que protegen la racha de un día perdido (máx. 2). */
  shields: number;
  xp: number;
  totals: ProgramTotals;
  memory: ExerciseMemoryMap;
  /** Repeticiones acumuladas por ejercicio (alimenta metas como "1.000 swings"). */
  exerciseReps?: Partial<Record<ExerciseId, number>>;
  /** Último RPE reportado (para autorregulación del siguiente día). */
  lastRpe: number | null;
  lastFeel: Feel | null;
}

// ───────────────────────── Perfil y ajustes ─────────────────────────

/** Duración TOTAL de la sesión (incluye calentamiento y vuelta a la calma). Máximo 25 min: sesiones cortas y bien hechas. */
export type SessionMinutes = 10 | 15 | 20 | 25;

/** Un pesaje: fecha local YYYY-MM-DD y kilos. */
export interface WeightEntry {
  date: string;
  kg: number;
}

/**
 * Cuerpo del usuario: con peso y estatura la app sugiere pesas de partida y avisa cuándo pesarse.
 * Es opcional (se puede entrenar sin darlo).
 */
export interface BodyProfile {
  heightCm: number;
  /** Historial de pesajes, el más nuevo al final (máx. 150). */
  weights: WeightEntry[];
  /** Fecha de la última revisión mensual de la pesa de referencia. */
  bellsCheckedAt?: string;
}

export interface UserSettings {
  level: Level;
  primaryGoal: PrimaryGoal;
  /** Duración total de la sesión en minutos (10 | 15 | 20 | 25). */
  minutes: SessionMinutes;
  /** Peso y estatura para sugerir pesas y programar pesajes. */
  body?: BodyProfile;
  /** Pesas que tiene el usuario (kg), ordenadas. */
  bells: number[];
  /** true si tiene DOS pesas iguales (habilita doble clean, farmer carry doble, etc.). */
  hasPairs?: boolean;
  /**
   * Cuidado de espalda baja: evita balísticos (swing, clean, snatch, tirón alto) y los sustituye por
   * peso muerto, goblet y acarreos. McGill 2012: el cizallamiento L4-L5 del swing es singular y no hay guía de riesgo.
   */
  lowBackCare?: boolean;
  /** Pesa con la que domina el swing a dos manos (kg). */
  referenceKg: number;
  voice: boolean;
  sound: boolean;
  haptics: boolean;
  onboardedAt: number | null;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string | null;
  photoURL: string | null;
}

export interface UserProfileDoc extends Omit<AppUser, "uid"> {
  createdAt: number;
  lastLoginAt: number;
  schemaVersion: number;
}

// ───────────────────────── Metas y logros ─────────────────────────

export type GoalKind = "streak" | "sessions" | "day" | "tonnage" | "swings" | "bell" | "benchmark";

export interface GoalDef {
  id: string;
  kind: GoalKind;
  titleEs: string;
  descriptionEs: string;
  target: number;
  unit: string;
  /** Si se basa en un estándar publicado, id de evidencia/protocolo. */
  source?: string;
}

export interface GoalProgress extends GoalDef {
  progress: number; // 0..target (capado)
  done: boolean;
  completedAt?: number;
}

/** Documento persistido por meta completada. */
export interface GoalCompletionDoc {
  id: string;
  completedAt: number;
}

// ───────────────────────── Borrador de sesión (recuperable) ─────────────────────────

/** Sesión en curso. Se guarda tras cada paso para poder reanudar si se cierra la app. */
export interface ActiveSessionDraft {
  plan: SessionPlan;
  startedAt: number;
  /** Índice del paso actual en compileSteps(plan). */
  stepIndex: number;
  sets: SetLog[];
  updatedAt: number;
}

// ───────────────────────── Carga inicial ("resume") ─────────────────────────

/** Todo lo que necesita la app al iniciar sesión con Google para pintar "Bienvenido de vuelta, hoy toca el Día N". */
export interface ResumeBundle {
  user: AppUser;
  isNewUser: boolean;
  settings: UserSettings | null; // null => falta onboarding
  state: ProgramState;
  lastSession: SessionLog | null;
  draft: ActiveSessionDraft | null;
  completedGoalIds: string[];
}
