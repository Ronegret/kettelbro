/**
 * Animaciones de las figuras de ejercicios (una por ExerciseId).
 *
 * Cada animación es una lista de keyframes {t, pose} + `loop`. La interpolación es angular (ver
 * skeleton.ts), así que aquí solo se describen poses clave. Para escribirlas con comodidad se usa el
 * constructor `P()`: las piernas y los brazos se pueden dar como OBJETIVOS (posición del tobillo, de
 * la cadera, de la mano; coordenadas absolutas del lienzo 200x200, con la altura `h` medida sobre la
 * línea del tobillo con el pie plano) y `P()` resuelve los ángulos con IK. Lo que sale de `P()` son
 * ángulos: la animación nunca interpola posiciones.
 *
 * Vista 3D: cada pose admite además parámetros LATERALES (ancho de postura, apertura de rodillas,
 * posición lateral de las manos, giro del tronco...) que rig.ts usa para dibujarla de frente o de
 * tres cuartos. Son opcionales: sin ellos la figura queda en una postura natural.
 */
import type { ExerciseId } from "@/lib/engine/types";
import {
  ANKLE_H,
  BONE,
  GROUND_Y,
  armIK,
  legIK,
  type Animation,
  type AnchorJoint,
  type BellSpec,
  type Ease,
  type Keyframe,
  type Lateral,
  type Pose,
  type V2,
} from "./skeleton";

// ───────────────────────── Constructor de poses ─────────────────────────

const RAD = Math.PI / 180;
/** y del tobillo con el pie plano apoyado (h = 0). */
const FLAT_Y = GROUND_Y - ANKLE_H;
const LEG = BONE.shin + BONE.thigh;

type Arm = readonly [upperArm: number, foreArm: number];

interface LatSpec {
  /** Ancho de postura: distancia lateral de cada tobillo a la línea media (por defecto 8). */
  stance?: number;
  stance2?: number;
  /** Apertura de rodillas (grados). */
  kneeOut?: number;
  /** Apertura de punteras (grados, por defecto 10). */
  toeOut?: number;
  /** Posición lateral de la mano principal / lejana, hacia fuera desde la línea media. */
  hz?: number;
  hz2?: number;
  /** Codo hacia fuera (+) o hacia dentro (−), grados. */
  elOut?: number;
  elOut2?: number;
  /** Giro del tronco alrededor de la columna (+ = el pecho gira hacia la derecha). */
  roll?: number;
  /** Giro de pecho/brazos/cabeza alrededor de la vertical por la pelvis. */
  twist?: number;
  headYaw?: number;
}

interface Spec extends LatSpec {
  /** Tobillo principal [x, h]. Por defecto [86, 0]. */
  ankle?: V2;
  /** Cadera [x, h]. Por defecto: pierna recta sobre el tobillo. */
  hip?: V2;
  /** +1 rodilla hacia delante (normal), -1 hacia atrás. */
  knee?: 1 | -1;
  /** Segundo tobillo [x, h] (pierna libre). Por defecto coincide con el principal. */
  ankle2?: V2;
  knee2?: 1 | -1;
  foot?: number;
  foot2?: number;
  torso: number;
  neck?: number;
  gaze?: number;
  /** Mano cercana: objetivo [x, h] (IK) o ángulos crudos en `arm`. */
  hand?: V2;
  elbow?: 1 | -1;
  arm?: Arm;
  /** Mano lejana: objetivo [x, h], 'thigh' (apoyada en el muslo) o ángulos crudos en `arm2`. */
  hand2?: V2 | "thigh";
  elbow2?: 1 | -1;
  arm2?: Arm;
  front2?: boolean;
  bell?: BellSpec;
  /** Qué articulación queda fija entre keyframes. Por defecto el tobillo. */
  pin?: Extract<AnchorJoint, "ankle" | "hip" | "ankle2" | "hand" | "hand2">;
}

function lateralOf(s: Spec): Lateral | undefined {
  const l: Lateral = {};
  if (s.stance !== undefined) l.stance = s.stance;
  if (s.stance2 !== undefined) l.stance2 = s.stance2;
  if (s.kneeOut !== undefined) l.kneeOut = s.kneeOut;
  if (s.toeOut !== undefined) l.toeOut = s.toeOut;
  if (s.hz !== undefined) l.handZ = s.hz;
  if (s.hz2 !== undefined) l.handZ2 = s.hz2;
  if (s.elOut !== undefined) l.elbowOut = s.elOut;
  if (s.elOut2 !== undefined) l.elbowOut2 = s.elOut2;
  if (s.roll !== undefined) l.roll = s.roll;
  if (s.twist !== undefined) l.twist = s.twist;
  if (s.headYaw !== undefined) l.headYaw = s.headYaw;
  // Manos dadas como objetivo: quedan en su sitio aunque el tronco ruede (mano apoyada).
  if (!s.arm && s.hand) l.handFix = 1;
  if (!s.arm2 && s.hand2) l.handFix2 = 1;
  return Object.keys(l).length ? l : undefined;
}

const sinD = (a: number): number => Math.sin(a * RAD);
const cosD = (a: number): number => Math.cos(a * RAD);

export function P(s: Spec): Pose {
  const ankle: V2 = s.ankle ?? [86, 0];
  const hip: V2 = s.hip ?? [ankle[0], ankle[1] + LEG];
  const leg1 = legIK([hip[0] - ankle[0], hip[1] - ankle[1]], s.knee ?? 1);
  const ankle2: V2 = s.ankle2 ?? ankle;
  const leg2 = legIK([hip[0] - ankle2[0], hip[1] - ankle2[1]], s.knee2 ?? s.knee ?? 1);

  const shoulder: V2 = [hip[0] + BONE.torso * sinD(s.torso), hip[1] + BONE.torso * cosD(s.torso)];
  const knee: V2 = [ankle[0] + BONE.shin * sinD(leg1.shin), ankle[1] + BONE.shin * cosD(leg1.shin)];
  const thighPt: V2 = [hip[0] + 0.72 * (knee[0] - hip[0]), hip[1] + 0.72 * (knee[1] - hip[1])];

  let upperArm = 180;
  let foreArm = 180;
  if (s.arm) {
    upperArm = s.arm[0];
    foreArm = s.arm[1];
  } else if (s.hand) {
    const a = armIK([s.hand[0] - shoulder[0], s.hand[1] - shoulder[1]], s.elbow ?? 1);
    upperArm = a.upperArm;
    foreArm = a.foreArm;
  }
  let upperArm2: number | undefined;
  let foreArm2: number | undefined;
  if (s.arm2) {
    upperArm2 = s.arm2[0];
    foreArm2 = s.arm2[1];
  } else if (s.hand2) {
    const t = s.hand2 === "thigh" ? thighPt : s.hand2;
    const a = armIK([t[0] - shoulder[0], t[1] - shoulder[1]], s.elbow2 ?? s.elbow ?? 1);
    upperArm2 = a.upperArm;
    foreArm2 = a.foreArm;
  }

  // Cuello y mirada por defecto: columna neutra, mirando al frente.
  const neck = s.neck ?? (s.torso >= 0 ? s.torso * 0.9 : s.torso); // cuello casi alineado con el tronco: con 0,65 la cabeza quedaba ~35° extendida en la bisagra
  const gaze = s.gaze ?? (s.torso >= 0 ? 90 + s.torso * 0.7 : neck + 90); // la cabeza acompaña al tronco: ~20° de extensión como máximo en la bisagra (con 0,2 miraba al horizonte: ~50°)

  const pin = s.pin ?? "ankle";
  let root: Pose["root"];
  if (pin === "hip") root = { at: "hip", x: hip[0], y: FLAT_Y - hip[1] };
  else if (pin === "ankle2") root = { at: "ankle2", x: ankle2[0], y: FLAT_Y - ankle2[1] };
  else if (pin === "hand" && s.hand) root = { at: "hand", x: s.hand[0], y: FLAT_Y - s.hand[1] };
  else root = { at: "ankle", x: ankle[0], y: FLAT_Y - ankle[1] };

  const pose: Pose = {
    shin: leg1.shin,
    thigh: leg1.thigh,
    shin2: leg2.shin,
    thigh2: leg2.thigh,
    torso: s.torso,
    neck,
    gaze,
    upperArm,
    foreArm,
    bell: s.bell ?? { at: "none" },
    root,
  };
  if (s.foot !== undefined) pose.foot = s.foot;
  if (s.foot2 !== undefined) pose.foot2 = s.foot2;
  if (upperArm2 !== undefined && foreArm2 !== undefined) {
    pose.upperArm2 = upperArm2;
    pose.foreArm2 = foreArm2;
  }
  if (s.front2) pose.front2 = true;
  const lat = lateralOf(s);
  if (lat) pose.lat = lat;
  return pose;
}

const K = (t: number, pose: Pose, ease?: Ease): Keyframe => (ease ? { t, pose, ease } : { t, pose });

// ───────────────────────── Poses compartidas ─────────────────────────

/** Pesa a dos manos colgando de brazos rectos (swing, peso muerto...). */
const bell2 = (ang: number, extra: Partial<BellSpec> = {}): BellSpec => ({ at: "both", ang, ...extra });
const bell1 = (ang: number, extra: Partial<BellSpec> = {}): BellSpec => ({ at: "hand", ang, ...extra });

const SX = 84; // x del tobillo para los ejercicios de bisagra/press de pie

/** Posturas laterales típicas. */
const HINGE: LatSpec = { stance: 12, toeOut: 14, kneeOut: 10 };
const SWING: LatSpec = { stance: 13.5, toeOut: 16, kneeOut: 12 };
const SQUAT: LatSpec = { stance: 15, toeOut: 24, kneeOut: 24 };

/** Pose de swing: cadera [x, h], tronco, ángulo de los brazos rectos y de la pesa. */
function swingPose(hipX: number, hipH: number, torso: number, arms: number, bellAng: number): Pose {
  return P({
    ankle: [SX, 0],
    hip: [hipX, hipH],
    torso,
    arm: [arms, arms],
    bell: bell2(bellAng),
    ...SWING,
  });
}

// ───────────────────────── Caminata (acarreos) ─────────────────────────

const WALK_HALF_STRIDE = 22;

function footAngle(phi: number): number {
  // phi 0..1 del ciclo de ESTA pierna: 0 = contacto de talón.
  const pts: Array<[number, number]> = [
    [0, 68],
    [0.12, 90],
    [0.35, 92],
    [0.5, 128],
    [0.62, 118],
    [0.82, 92],
    [1, 68],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as [number, number];
    const b = pts[i + 1] as [number, number];
    if (phi <= b[0]) return a[1] + ((b[1] - a[1]) * (phi - a[0])) / (b[0] - a[0]);
  }
  return 68;
}

/** Posición [x, h] del tobillo de una pierna en la fase phi (relativo a la cadera en x). */
function ankleAt(hipX: number, phi: number): { pos: V2; foot: number } {
  const p = ((phi % 1) + 1) % 1;
  const foot = footAngle(p);
  let x: number;
  let lift = 0;
  if (p < 0.5) {
    x = hipX + WALK_HALF_STRIDE - (2 * WALK_HALF_STRIDE * p) / 0.5;
  } else {
    const u = (p - 0.5) / 0.5;
    const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
    x = hipX - WALK_HALF_STRIDE + 2 * WALK_HALF_STRIDE * e;
    lift = 9 * Math.sin(Math.PI * Math.pow(u, 0.8)); // paso natural: ~60° de flexión de rodilla en el balanceo (con 15 era una marcha de rodillas altas)
  }
  // El punto más bajo del pie (talón o puntera) toca el suelo cuando está en apoyo.
  const heelRel = -BONE.heel * cosD(foot);
  const toeRel = BONE.toe * cosD(foot);
  const floor = Math.max(0, -heelRel, -toeRel);
  return { pos: [x, floor + lift], foot };
}

interface WalkOpts {
  hipX: number;
  torso?: number;
  /** Brazo cercano: fijo [ua, fa] o función de la fase. */
  arm: (phi: number) => Arm;
  /** Brazo lejano: fijo o función de la fase. */
  arm2?: (phi: number) => Arm;
  bell: (phi: number) => BellSpec;
  neck?: number;
  front2?: boolean;
  lat?: LatSpec;
}

function walkKeys(o: WalkOpts, steps = 8): Keyframe[] {
  const keys: Keyframe[] = [];
  for (let i = 0; i < steps; i++) {
    const phi = i / steps;
    const a1 = ankleAt(o.hipX, phi);
    const a2 = ankleAt(o.hipX, phi + 0.5);
    const hipH = 61 + 4.2 * (0.5 - 0.5 * Math.cos(4 * Math.PI * phi));
    const arm2 = o.arm2 ? o.arm2(phi) : ([180 - 24 * cosD(360 * phi), 160 - 24 * cosD(360 * phi)] as const);
    keys.push(
      K(
        phi,
        P({
          ankle: a1.pos,
          hip: [o.hipX, hipH],
          ankle2: a2.pos,
          foot: a1.foot,
          foot2: a2.foot,
          torso: o.torso ?? 2,
          ...(o.neck !== undefined ? { neck: o.neck } : {}),
          arm: o.arm(phi),
          arm2,
          ...(o.front2 ? { front2: true } : {}),
          bell: o.bell(phi),
          pin: "hip",
          stance: 7.5,
          toeOut: 6,
          ...o.lat,
        }),
        "linear",
      ),
    );
  }
  return keys;
}

// ───────────────────────── Animaciones ─────────────────────────

const RACK_ARM: Arm = [165, 15];
const LOCK_ARM: Arm = [4, 1];

/** Rack con una pesa: antebrazo casi vertical, la pesa descansa por fuera del antebrazo. */
const RACK_BELL = bell1(160, { tilt: 32, bar: 35 });
const LOCK_BELL = bell1(208, { tilt: 14, bar: 35 });
/** Laterales del rack (mano delante del hombro, codo pegado) y del bloqueo arriba. */
const RACK_LAT: LatSpec = { hz: 8, elOut: -10 };
const LOCK_LAT: LatSpec = { hz: 12 };
/** Mitad del press: mano a la altura de la frente, codo abierto hacia fuera. */
const PRESS_MID_HAND: V2 = [91, 122];
const PRESS_MID_LAT: LatSpec = { hz: 11, elOut: 50 };

// Posiciones de pie con el tobillo en SX.
const standRack = (extra: Partial<Spec> = {}): Pose =>
  P({ ankle: [SX, 0], torso: 0, arm: RACK_ARM, bell: RACK_BELL, ...RACK_LAT, ...extra });
const standLock = (extra: Partial<Spec> = {}): Pose =>
  P({ ankle: [SX, 0], torso: -2, neck: 6, arm: LOCK_ARM, bell: LOCK_BELL, ...LOCK_LAT, ...extra });
const standMid = (extra: Partial<Spec> = {}): Pose =>
  P({ ankle: [SX, 0], torso: -1, hand: PRESS_MID_HAND, bell: bell1(184, { tilt: 26, bar: 35 }), ...PRESS_MID_LAT, ...extra });

// Piso: tobillo plantado a la derecha, cabeza a la izquierda, cadera apoyada.
const FLOOR_ANKLE: V2 = [132, 0];
const FLOOR_HIP: V2 = [96, 2.5];

/** Swing a una mano: posiciones laterales de la mano según el momento (atrás entre las piernas, arriba al frente). */
function oneArm(hip: V2, torso: number, arms: number, free: Arm, bellAng: number, hz: number): Pose {
  return P({ ankle: [SX, 0], hip, torso, arm: [arms, arms], arm2: free, bell: bell1(bellAng, { bar: 70 }), ...SWING, hz });
}

const ANIMATIONS_DATA: Record<ExerciseId, Animation> = {
  // ───────── Bisagras y swings ─────────
  "kettlebell-deadlift": {
    cycleSec: 3.2,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [76, 0], hip: [76, 66], torso: 0, hand: [88, 60], bell: bell2(180), ...HINGE })),
      K(1, P({ ankle: [76, 0], hip: [57, 41.5], torso: 46, hand: [84, 23], bell: bell2(180), ...HINGE })),
    ],
  },

  "two-hand-swing": {
    cycleSec: 1.9,
    loop: "cycle",
    still: 0.5,
    ease: "sine",
    keys: [
      K(0, swingPose(62, 55, 65, 224, 215)),
      K(0.2, swingPose(68, 59, 42, 182, 182)),
      K(0.32, swingPose(78, 64, 14, 140, 152)),
      K(0.42, swingPose(83, 66, -2, 106, 128)),
      K(0.5, swingPose(85, 66, -4, 88, 122)),
      K(0.6, swingPose(84, 66, -2, 118, 148)),
      K(0.72, swingPose(77, 63, 12, 160, 168)),
      K(0.84, swingPose(67, 57, 44, 190, 190)),
      K(0.93, swingPose(62, 55, 62, 216, 210)),
    ],
  },

  "one-arm-swing": {
    cycleSec: 1.9,
    loop: "cycle",
    still: 0.5,
    ease: "sine",
    keys: [
      K(0, oneArm([62, 55], 65, 224, [165, 160], 215, 3.5)),
      K(0.2, oneArm([68, 59], 42, 182, [172, 168], 182, 6)),
      K(0.32, oneArm([78, 64], 14, 140, [180, 176], 152, 7.5)),
      K(0.42, oneArm([83, 66], -2, 106, [196, 190], 128, 8)),
      K(0.5, oneArm([85, 66], -4, 88, [204, 198], 122, 8)),
      K(0.6, oneArm([84, 66], -2, 118, [196, 190], 148, 8)),
      K(0.72, oneArm([77, 63], 12, 160, [182, 178], 168, 7)),
      K(0.84, oneArm([67, 57], 44, 190, [172, 168], 190, 5)),
      K(0.93, oneArm([62, 55], 62, 216, [164, 160], 210, 3.8)),
    ],
  },

  "single-leg-rdl": {
    cycleSec: 3.6,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [80, 0], hip: [80, 66], torso: 0, hand: [90, 62], bell: bell1(180, { bar: 0 }), stance: 6, stance2: 7, hz: 11 })),
      K(
        1,
        P({
          ankle: [84, 0],
          hip: [74, 64],
          knee: 1,
          ankle2: [9, 53],
          foot2: 160,
          torso: 82,
          neck: 70,
          gaze: 100,
          arm: [180, 180],
          arm2: [176, 170],
          bell: bell1(180, { bar: 0 }),
          stance: 6,
          stance2: 7,
          hz: 11,
          hz2: 16,
        }),
      ),
    ],
  },

  "hip-bridge": {
    cycleSec: 2.8,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: FLOOR_ANKLE, hip: [94, 2.5], torso: -90, neck: -90, gaze: 0, hand: [86, 26], bell: bell2(180), stance: 10, kneeOut: 6, elOut: 30, elOut2: 30 })),
      K(1, P({ ankle: FLOOR_ANKLE, hip: [82, 28], torso: -132, neck: -90, gaze: 0, hand: [70, 50], bell: bell2(180), stance: 10, kneeOut: 6, elOut: 30, elOut2: 30 })),
    ],
  },

  // ───────── Sentadillas y zancadas ─────────
  "goblet-squat": {
    cycleSec: 3.2,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [80, 0], hip: [80, 66], torso: 2, hand: [96, 86], elbow: 1, bell: bell2(180), ...SQUAT, kneeOut: 8, hz: 5, hz2: 5, elOut: -12, elOut2: -12 })),
      K(1, P({ ankle: [80, 0], hip: [63, 30], torso: 14, hand: [90, 56], elbow: 1, bell: bell2(180), ...SQUAT, hz: 5, hz2: 5, elOut: -6, elOut2: -6 })),
    ],
  },

  "prying-goblet-squat": {
    cycleSec: 6,
    loop: "cycle",
    still: 0.55,
    ease: "sine",
    keys: [
      K(0, P({ ankle: [80, 0], hip: [80, 66], torso: 2, hand: [96, 86], elbow: 1, bell: bell2(180), ...SQUAT, kneeOut: 8, hz: 5, hz2: 5, elOut: -12, elOut2: -12 })),
      K(0.28, P({ ankle: [80, 0], hip: [66, 24], torso: 20, hand: [90, 50], elbow: 1, bell: bell2(180), ...SQUAT, hz: 5, hz2: 5, elOut: 4, elOut2: 4 })),
      K(0.42, P({ ankle: [80, 0], hip: [63, 20], torso: 6, hand: [84, 54], elbow: 1, bell: bell2(180), ...SQUAT, kneeOut: 32, hz: 5, hz2: 5, elOut: 14, elOut2: 14, twist: 9 })),
      K(0.56, P({ ankle: [80, 0], hip: [67, 26], torso: 26, hand: [94, 48], elbow: 1, bell: bell2(180), ...SQUAT, hz: 5, hz2: 5, elOut: 6, elOut2: 6 })),
      K(0.7, P({ ankle: [80, 0], hip: [63, 20], torso: 6, hand: [84, 54], elbow: 1, bell: bell2(180), ...SQUAT, kneeOut: 32, hz: 5, hz2: 5, elOut: 14, elOut2: 14, twist: -9 })),
      K(1, P({ ankle: [80, 0], hip: [80, 66], torso: 2, hand: [96, 86], elbow: 1, bell: bell2(180), ...SQUAT, kneeOut: 8, hz: 5, hz2: 5, elOut: -12, elOut2: -12 })),
    ],
  },

  "front-squat": {
    cycleSec: 3.4,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [80, 0], hip: [80, 66], torso: 0, arm: [100, -55], arm2: [96, -52], bell: { at: "pair", ang: 150, tilt: 34, bar: 40 }, stance: 14, toeOut: 20, kneeOut: 6, hz: 6.5, hz2: 6.5, elOut: -16, elOut2: -16 })),
      K(1, P({ ankle: [80, 0], hip: [62, 28], torso: 8, arm: [100, -55], arm2: [96, -52], bell: { at: "pair", ang: 150, tilt: 34, bar: 40 }, stance: 14, toeOut: 20, kneeOut: 22, hz: 6.5, hz2: 6.5, elOut: -16, elOut2: -16 })),
    ],
  },

  "reverse-lunge-racked": {
    cycleSec: 3.4,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [96, 0], hip: [96, 66], torso: 0, arm: RACK_ARM, arm2: [172, 168], bell: RACK_BELL, ...RACK_LAT, stance: 7.5, stance2: 7.5 })),
      K(
        1,
        P({
          ankle: [96, 0],
          hip: [66, 31.5],
          ankle2: [28, 14],
          foot2: 158,
          torso: 4,
          arm: RACK_ARM,
          arm2: [150, 150],
          bell: RACK_BELL,
          ...RACK_LAT,
          stance: 7.5,
          stance2: 7.5,
          toeOut: 4,
        }),
      ),
    ],
  },

  // ───────── Press ─────────
  "strict-press": {
    cycleSec: 3.2,
    loop: "pingpong",
    still: 1,
    keys: [K(0, standRack()), K(0.15, standRack(), "linear"), K(0.52, standMid()), K(0.9, standLock(), "inOut"), K(1, standLock())],
  },

  "push-press": {
    cycleSec: 2.6,
    loop: "cycle",
    still: 0.55,
    ease: "sine",
    keys: [
      K(0, standRack()),
      K(0.12, standRack({ hip: [83, 57], torso: 4, kneeOut: 8 })),
      K(0.22, standRack({ hip: [86, 66], torso: -1 }), "out"),
      K(0.36, standMid()),
      K(0.5, standLock()),
      K(0.62, standLock()),
      K(0.78, standMid({ torso: 0 })),
      K(0.9, standRack({ hip: [84, 62], torso: 2, kneeOut: 6 })),
    ],
  },

  "floor-press": {
    cycleSec: 3,
    loop: "pingpong",
    still: 0,
    keys: [
      K(0, P({ ankle: FLOOR_ANKLE, hip: FLOOR_HIP, ankle2: [162, 5.6], foot2: 20, torso: -90, neck: -90, gaze: 0, arm: [0, 0], arm2: [92, 92], front2: true, bell: bell1(238, { bar: 30 }), stance: 9, stance2: 10, hz: 12.5, hz2: 21 })),
      K(1, P({ ankle: FLOOR_ANKLE, hip: FLOOR_HIP, ankle2: [162, 5.6], foot2: 20, torso: -90, neck: -90, gaze: 0, arm: [96, 4], arm2: [92, 92], front2: true, bell: bell1(210, { bar: 30, tilt: 18 }), stance: 9, stance2: 10, hz: 15, hz2: 21, elOut: 58 })),
    ],
  },

  "half-kneeling-press": {
    cycleSec: 3.2,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, hk({ arm: RACK_ARM, bell: RACK_BELL, lat: RACK_LAT })),
      K(0.15, hk({ arm: RACK_ARM, bell: RACK_BELL, lat: RACK_LAT }), "linear"),
      K(0.52, hk({ hand: [89, 89], bell: bell1(184, { tilt: 26, bar: 35 }), lat: PRESS_MID_LAT, torso: -1 })),
      K(0.9, hk({ arm: LOCK_ARM, bell: LOCK_BELL, lat: LOCK_LAT, torso: -2, neck: 6 })),
      K(1, hk({ arm: LOCK_ARM, bell: LOCK_BELL, lat: LOCK_LAT, torso: -2, neck: 6 })),
    ],
  },

  // ───────── Tirones ─────────
  "one-arm-row": {
    cycleSec: 2.6,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, rowPose([180, 180], 180, 12, 0)),
      K(0.12, rowPose([180, 180], 180, 12, 0), "linear"),
      K(0.88, rowPose([238, 196], 190, 11, -8)),
      K(1, rowPose([238, 196], 190, 11, -8)),
    ],
  },

  "high-pull": {
    cycleSec: 2.2,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, oneArm([62, 55], 65, 224, [165, 160], 215, 3.5)),
      K(0.45, oneArm([82, 66], -2, 160, [184, 178], 172, 8), "inOut"),
      K(1, P({ ankle: [SX, 0], hip: [86, 66], torso: -4, neck: 0, arm: [60, 212], arm2: [192, 186], bell: bell1(168, { bar: 70 }), ...SWING, hz: 9, elOut: 62 })),
    ],
  },

  // ───────── Balísticos: clean y snatch ─────────
  clean: {
    cycleSec: 2.6,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [SX, 0], hip: [62, 55], torso: 65, arm: [224, 224], bell: bell1(215, { bar: 70 }), ...SWING, hz: 3.5 })),
      K(0.34, P({ ankle: [SX, 0], hip: [84, 66], torso: -3, arm: [176, 176], bell: bell1(184, { bar: 60 }), ...SWING, hz: 9 })),
      K(0.62, P({ ankle: [SX, 0], hip: [85, 66], torso: -4, arm: [190, 30], bell: bell1(150, { tilt: 20, bar: 45 }), ...SWING, hz: 9, elOut: -6 })),
      K(1, standRack({ ...SWING, kneeOut: 0 })),
    ],
  },

  snatch: {
    cycleSec: 2.6,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [SX, 0], hip: [62, 55], torso: 65, arm: [224, 224], bell: bell1(215, { bar: 70 }), ...SWING, hz: 3.5 })),
      K(0.3, P({ ankle: [SX, 0], hip: [84, 66], torso: -3, arm: [174, 174], bell: bell1(184, { bar: 60 }), ...SWING, hz: 9 })),
      K(0.55, P({ ankle: [SX, 0], hip: [86, 66], torso: -5, arm: [72, 208], bell: bell1(160, { bar: 50 }), ...SWING, hz: 10.5, elOut: 48 })),
      K(0.8, P({ ankle: [SX, 0], hip: [86, 66], torso: -3, arm: [30, 8], bell: bell1(190, { tilt: 10, bar: 40 }), ...SWING, hz: 12 })),
      K(1, standLock({ ...SWING, kneeOut: 0 })),
    ],
  },

  "clean-and-press": {
    cycleSec: 5.2,
    loop: "cycle",
    still: 0.55,
    ease: "sine",
    keys: [
      K(0, P({ ankle: [SX, 0], hip: [62, 55], torso: 65, arm: [224, 224], bell: bell1(215, { bar: 70 }), ...SWING, hz: 3.5 })),
      K(0.14, P({ ankle: [SX, 0], hip: [84, 66], torso: -3, arm: [176, 176], bell: bell1(184, { bar: 60 }), ...SWING, hz: 9 })),
      K(0.24, P({ ankle: [SX, 0], hip: [85, 66], torso: -4, arm: [190, 30], bell: bell1(150, { tilt: 20, bar: 45 }), ...SWING, hz: 9, elOut: -6 })),
      K(0.32, standRack({ ...SWING, kneeOut: 0 })),
      K(0.4, standRack({ ...SWING, kneeOut: 0 })),
      K(0.52, standMid({ ...SWING, kneeOut: 0 })),
      K(0.6, standLock({ ...SWING, kneeOut: 0 })),
      K(0.68, standLock({ ...SWING, kneeOut: 0 })),
      K(0.78, standMid({ ...SWING, kneeOut: 0, torso: 0 })),
      K(0.84, standRack({ ...SWING, kneeOut: 0 })),
      K(0.9, P({ ankle: [SX, 0], hip: [78, 64], torso: 22, arm: [190, 190], bell: bell1(188, { bar: 60 }), ...SWING, hz: 7 })),
      K(0.96, P({ ankle: [SX, 0], hip: [64, 56], torso: 58, arm: [218, 218], bell: bell1(212, { bar: 70 }), ...SWING, hz: 4 })),
    ],
  },

  // ───────── Habilidad ─────────
  "turkish-get-up": {
    cycleSec: 15,
    loop: "pingpong",
    still: 0.62,
    keys: tgu(),
  },

  windmill: {
    cycleSec: 4.2,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: [84, 0], torso: -1, neck: 4, arm: [0, 0], arm2: [180, 180], front2: true, bell: bell1(212, { bar: 30 }), stance: 8, stance2: 12, toeOut: 28, hz: 13, hz2: 15 })),
      K(
        1,
        P({
          ankle: [84, 0],
          hip: [63, 57],
          torso: 84,
          neck: 52,
          gaze: 30,
          arm: [0, 0],
          hand2: [96, 12],
          elbow2: 1,
          front2: true,
          bell: bell1(212, { bar: 30 }),
          stance: 8,
          stance2: 12,
          toeOut: 28,
          kneeOut: 6,
          hz: 13,
          hz2: 9,
          twist: -38,
          headYaw: 30,
        }),
      ),
    ],
  },

  halo: {
    cycleSec: 4,
    loop: "cycle",
    still: 0,
    ease: "linear",
    keys: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => K(a / 360, haloPose(a))),
  },

  "arm-bar": {
    cycleSec: 5,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, P({ ankle: FLOOR_ANKLE, hip: FLOOR_HIP, ankle2: [162, 5.6], foot2: 20, torso: -90, neck: -90, gaze: 0, arm: [0, 0], arm2: [100, 94], front2: true, bell: bell1(238, { bar: 30 }), stance: 9, stance2: 10, hz: 13.4, hz2: 22 })),
      K(
        1,
        P({
          // Rodado hacia el lado libre: pierna derecha cruzada por encima, brazo libre estirado por encima de la cabeza.
          hip: [100, 8],
          ankle: [104, 3],
          foot: 95,
          ankle2: [98, 16],
          foot2: -90,
          torso: -90,
          neck: -93,
          gaze: 6,
          arm: [0, 0],
          hand2: [44, 4],
          elbow2: 1,
          front2: true,
          bell: bell1(238, { bar: 30 }),
          pin: "hip",
          stance: -4,
          stance2: 6,
          kneeOut: -20,
          hz: 13.4,
          hz2: 8,
          roll: -72,
        }),
      ),
    ],
  },

  "bottom-up-press": {
    cycleSec: 3.6,
    loop: "pingpong",
    still: 1,
    keys: [
      K(0, standRack({ arm: [165, 6], bell: bell1(0, { bar: 20 }), hz: 9.5, elOut: -6 })),
      K(0.15, standRack({ arm: [165, 6], bell: bell1(0, { bar: 20 }), hz: 9.5, elOut: -6 }), "linear"),
      K(0.52, standMid({ bell: bell1(0, { bar: 20 }), hz: 11.5, elOut: 40 })),
      K(0.9, standLock({ arm: [4, 0], bell: bell1(0, { bar: 20 }) })),
      K(1, standLock({ arm: [4, 0], bell: bell1(0, { bar: 20 }) })),
    ],
  },

  // ───────── Acarreos ─────────
  "suitcase-carry": {
    cycleSec: 1.8,
    loop: "cycle",
    still: 0,
    travel: 88,
    keys: walkKeys({
      hipX: 94,
      arm: (phi) => [180 + 1.5 * sinD(720 * phi), 181],
      bell: (phi) => ({ at: "hand", ang: 180 + 5 * sinD(360 * phi + 60), bar: 0 }),
      lat: { hz: 17.5 },
    }),
  },

  "rack-carry": {
    cycleSec: 1.8,
    loop: "cycle",
    still: 0,
    travel: 88,
    keys: walkKeys({
      hipX: 94,
      arm: () => RACK_ARM,
      bell: () => RACK_BELL,
      lat: RACK_LAT,
    }),
  },

  "farmer-carry": {
    cycleSec: 1.8,
    loop: "cycle",
    still: 0,
    travel: 88,
    keys: walkKeys({
      hipX: 94,
      arm: (phi) => [180 + 1.5 * sinD(720 * phi), 181],
      arm2: (phi) => [172 + 1.5 * sinD(720 * phi + 90), 173],
      bell: (phi) => ({ at: "pair", ang: 180 + 4 * sinD(360 * phi + 60), bar: 0 }),
      lat: { hz: 17.5, hz2: 17.5 },
    }),
  },

  "bottom-up-carry": {
    cycleSec: 1.8,
    loop: "cycle",
    still: 0,
    travel: 88,
    keys: walkKeys({
      hipX: 94,
      arm: () => [165, 4],
      bell: (phi) => ({ at: "hand", ang: 3 * sinD(360 * phi), bar: 20 }),
      lat: { hz: 10.5, elOut: -6 },
    }),
  },

  "waiter-carry": {
    cycleSec: 1.8,
    loop: "cycle",
    still: 0,
    travel: 88,
    keys: walkKeys({
      hipX: 94,
      torso: -1,
      neck: 4,
      arm: () => LOCK_ARM,
      bell: () => LOCK_BELL,
      lat: LOCK_LAT,
    }),
  },

  "figure-8": {
    cycleSec: 3.4,
    loop: "cycle",
    still: 0.375,
    ease: "linear",
    keys: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => K(a / 360, fig8(a))),
  },
};

// ───────────────────────── Constructores de poses por ejercicio ─────────────────────────

/**
 * Media rodilla: rodilla DERECHA en el suelo (mismo lado que el brazo que empuja), pie izquierdo
 * delante, tronco erguido.
 */
function hk(o: { arm?: Arm; hand?: V2; bell: BellSpec; lat: LatSpec; torso?: number; neck?: number }): Pose {
  return P({
    ankle: [46, 9],
    foot: 125,
    hip: [78, 33.5],
    ankle2: [112, 0],
    torso: o.torso ?? 0,
    ...(o.neck !== undefined ? { neck: o.neck } : {}),
    ...(o.arm ? { arm: o.arm } : {}),
    ...(o.hand ? { hand: o.hand } : {}),
    arm2: [188, 186],
    bell: o.bell,
    stance: 6.5,
    stance2: 9,
    toeOut: 6,
    hz2: 16,
    ...o.lat,
  });
}

/** Remo a una mano: bisagra con la mano libre apoyada en el muslo izquierdo. */
function rowPose(arm: Arm, bellAng: number, hz: number, elOut: number): Pose {
  return P({
    ankle: [86, 0],
    hip: [64, 52],
    torso: 62,
    neck: 52,
    gaze: 128,
    arm,
    hand2: "thigh",
    elbow2: -1,
    bell: bell1(bellAng, { bar: 0 }),
    stance: 11,
    kneeOut: 10,
    toeOut: 12,
    hz,
    hz2: 9,
    elOut,
    elOut2: 30,
  });
}

/** Halo: pesa invertida (cuerpo hacia arriba) rodeando la cabeza; `a` = ángulo alrededor (0 = delante, 90 = derecha). */
function haloPose(a: number): Pose {
  const R = 15;
  const gx = 97 + R * cosD(a);
  const gz = R * sinD(a);
  const h = 101 + 2 * cosD(a);
  return P({
    ankle: [96, 0],
    torso: 0,
    hand: [gx, h],
    elbow: 1,
    hand2: [gx, h],
    elbow2: 1,
    bell: { at: "both", ang: 0, bar: 90 + a * 0.0 },
    stance: 9,
    hz: gz + 3.2,
    hz2: 3.2 - gz,
    elOut: 55 + 25 * sinD(a),
    elOut2: 55 - 25 * sinD(a),
  });
}

/**
 * Ochos: tronco inclinado y rodillas flexionadas; la pesa dibuja un 8 horizontal alrededor de las
 * piernas (lemniscata) y pasa ENTRE las piernas de delante hacia atrás, cambiando de mano.
 * a = 0..360: 0..180 en la mano derecha (vuelta a la pierna derecha), 180..360 en la izquierda.
 */
function fig8(a: number): Pose {
  const x = 88 - 15 * sinD(2 * a);
  const z = 20 * sinD(a);
  const h = 33;
  const handoff = a % 180 === 0;
  const rightActive = a < 180;
  const act: V2 = [x, h];
  const wait: V2 = handoff ? [x, h] : [79, 32];
  const right = rightActive ? act : wait;
  const left = rightActive ? wait : act;
  const hz = rightActive ? z : handoff ? 3 : 3;
  const hz2 = rightActive ? (handoff ? 3 : 3) : -z;
  return P({
    ankle: [90, 0],
    hip: [66, 47],
    torso: 55,
    neck: 47,
    gaze: 125,
    hand: right,
    elbow: 1,
    hand2: left,
    elbow2: 1,
    bell: { at: rightActive ? "hand" : "hand2", ang: 180, bar: 0 },
    stance: 14,
    toeOut: 16,
    kneeOut: 16,
    hz: handoff ? 3 : hz,
    hz2: handoff ? 3 : hz2,
  });
}

/**
 * Levantamiento turco: pie derecho plantado (ancla), pesa en la mano derecha, apoyo en el brazo
 * izquierdo. Etapas: tumbado -> codo -> mano -> puente -> barrido de pierna -> rodilla -> media
 * rodilla -> zancada -> de pie. (pingpong: la vuelta es la secuencia al revés.) El tronco rueda hacia
 * el lado del apoyo en las fases de codo y mano.
 */
function tgu(): Keyframe[] {
  const A: V2 = [136, 0];
  const bellUp = (ang: number): BellSpec => ({ at: "hand", ang, bar: 30 });
  const base = { ankle: A, front2: true, hz: 13.4, stance: 9 } as const;
  const lyingLeg = { ankle2: [166, 5.6] as V2, foot2: 20, stance2: 17 };
  return [
    // 0 tumbado: brazo con la pesa vertical, pierna derecha flexionada, la otra estirada y abierta
    K(0, P({ ...base, hip: [100, 2.5], ...lyingLeg, torso: -90, neck: -90, gaze: 0, arm: [0, 0], arm2: [96, 96], hz2: 24, bell: bellUp(236) })),
    K(0.08, P({ ...base, hip: [100, 2.5], ...lyingLeg, torso: -90, neck: -90, gaze: 0, arm: [0, 0], arm2: [96, 96], hz2: 24, bell: bellUp(236) }), "linear"),
    // 1 sobre el codo
    K(0.2, P({ ...base, hip: [100, 2.5], ...lyingLeg, torso: -62, neck: -52, gaze: 12, arm: [0, 0], arm2: [190, 91], hz2: 21, roll: -26, bell: bellUp(236) })),
    // 2 sobre la mano
    K(0.32, P({ ...base, hip: [100, 2.5], ...lyingLeg, torso: -22, neck: -12, gaze: 70, arm: [0, 0], hand2: [63, 0], elbow2: 1, hz2: 26, roll: -34, bell: bellUp(236) })),
    // 3 puente
    K(0.44, P({ ...base, hip: [112, 26], ankle2: [168, 5.6], foot2: 20, stance2: 15, torso: -65, neck: -40, gaze: 40, arm: [0, 0], hand2: [63, 0], elbow2: 1, hz2: 26, roll: -30, bell: bellUp(236) })),
    // 3.5 la pierna se despega del suelo para barrer
    K(0.48, P({ ...base, hip: [108, 31], ankle2: [142, 17], foot2: 60, stance2: 10, torso: -70, neck: -45, gaze: 40, arm: [0, 0], hand2: [63, 0], elbow2: 1, hz2: 26, roll: -28, bell: bellUp(236) })),
    // 4 cadera alta + pierna barriendo bajo el cuerpo
    K(0.52, P({ ...base, hip: [104, 34], ankle2: [104, 12], foot2: 110, stance2: 3, torso: -74, neck: -50, gaze: 40, arm: [0, 0], hand2: [63, 0], elbow2: 1, hz2: 26, roll: -24, bell: bellUp(236) })),
    // 5 trípode: rodilla izquierda en el suelo junto a la mano
    K(0.62, P({ ...base, hip: [100, 24], ankle2: [46, 9], foot2: 125, stance2: 4, torso: -62, neck: -40, gaze: 40, arm: [0, 0], hand2: [72, 0], elbow2: 1, hz2: 24, roll: -16, bell: bellUp(236) })),
    // 6 media rodilla: tronco erguido, mano suelta
    K(0.74, P({ ...base, hip: [102, 32], ankle2: [52, 9], foot2: 125, stance2: 5, torso: -4, neck: -2, arm: [0, 0], arm2: [140, 130], hz2: 15, bell: bellUp(222) })),
    // 7 zancada de pie
    K(0.86, P({ ...base, hip: [120, 54], ankle2: [70, 12], foot2: 140, stance2: 6, torso: -2, neck: 0, arm: [0, 0], arm2: [170, 165], hz2: 15.5, bell: bellUp(216) })),
    // 8 de pie con la pesa arriba
    K(1, P({ ...base, hip: [134, 66], ankle2: [128, 0], foot2: 90, stance2: 8, torso: -2, neck: 4, arm: [0, 0], arm2: [182, 182], hz2: 15.5, bell: bellUp(212) })),
  ];
}

export const ANIMATIONS: Readonly<Record<ExerciseId, Animation>> = ANIMATIONS_DATA;

export const FIGURE_IDS = Object.keys(ANIMATIONS_DATA) as ExerciseId[];

/** Nombre corto en español de cada figura (aria-label por defecto). */
export const FIGURE_LABEL_ES: Readonly<Record<ExerciseId, string>> = {
  "kettlebell-deadlift": "Peso muerto con pesa rusa",
  "two-hand-swing": "Swing a dos manos",
  "one-arm-swing": "Swing a una mano",
  "single-leg-rdl": "Peso muerto rumano a una pierna",
  "hip-bridge": "Puente de glúteo",
  "goblet-squat": "Sentadilla goblet",
  "prying-goblet-squat": "Sentadilla goblet con palanca",
  "front-squat": "Sentadilla frontal",
  "reverse-lunge-racked": "Zancada hacia atrás con pesa en rack",
  "strict-press": "Press estricto",
  "push-press": "Push press",
  "floor-press": "Press en el suelo",
  "half-kneeling-press": "Press a media rodilla",
  "one-arm-row": "Remo a una mano",
  "high-pull": "Jalón alto",
  clean: "Cargada",
  snatch: "Arranque",
  "clean-and-press": "Cargada y press",
  "turkish-get-up": "Levantamiento turco",
  windmill: "Molino",
  halo: "Halo",
  "arm-bar": "Arm bar",
  "bottom-up-press": "Press con pesa invertida",
  "suitcase-carry": "Acarreo de maleta",
  "rack-carry": "Acarreo en rack",
  "farmer-carry": "Paseo del granjero",
  "bottom-up-carry": "Acarreo con pesa invertida",
  "waiter-carry": "Acarreo del mesero",
  "figure-8": "Ochos entre las piernas",
};

/** Calidad de la figura: 'buena' = fiel a la técnica; 'estilizada' = simplificación honesta. */
export const FIGURE_QUALITY: Readonly<Record<ExerciseId, "buena" | "estilizada">> = {
  "kettlebell-deadlift": "buena",
  "two-hand-swing": "buena",
  "one-arm-swing": "buena",
  "single-leg-rdl": "buena",
  "hip-bridge": "buena",
  "goblet-squat": "buena",
  "prying-goblet-squat": "buena",
  "front-squat": "buena",
  "reverse-lunge-racked": "buena",
  "strict-press": "buena",
  "push-press": "buena",
  "floor-press": "buena",
  "half-kneeling-press": "buena",
  "one-arm-row": "buena",
  "high-pull": "buena",
  clean: "buena",
  snatch: "buena",
  "clean-and-press": "buena",
  "turkish-get-up": "estilizada",
  windmill: "buena",
  halo: "buena",
  "arm-bar": "estilizada",
  "bottom-up-press": "buena",
  "suitcase-carry": "buena",
  "rack-carry": "buena",
  "farmer-carry": "buena",
  "bottom-up-carry": "buena",
  "waiter-carry": "buena",
  "figure-8": "estilizada",
};

// ───────────────────────── Vistas útiles por ejercicio ─────────────────────────

/** Vista de cámara: de lado (0°), de frente (90°) o tres cuartos (45°). "angle" = alias de "three-quarter". */
export type FigureView = "side" | "front" | "three-quarter";
export type FigureViewProp = FigureView | "angle" | "auto" | number;

export const VIEW_YAW: Readonly<Record<FigureView, number>> = { side: 0, front: 90, "three-quarter": 45 };

export interface FigureViewsSpec {
  /** Vistas que enseñan algo de la técnica (en el orden en que las alterna "Auto"). */
  views: readonly FigureView[];
  /** La vista que mejor enseña la técnica. */
  defaultView: FigureView;
  /** Ajuste fino del ángulo de alguna vista para este ejercicio (grados). */
  yaw?: Partial<Record<FigureView, number>>;
}

const V = (defaultView: FigureView, views: readonly FigureView[], yaw?: FigureViewsSpec["yaw"]): FigureViewsSpec =>
  yaw ? { views, defaultView, yaw } : { views, defaultView };

export const FIGURE_VIEWS: Readonly<Record<ExerciseId, FigureViewsSpec>> = {
  "kettlebell-deadlift": V("side", ["side", "three-quarter", "front"]),
  "two-hand-swing": V("side", ["side", "three-quarter", "front"]),
  "one-arm-swing": V("side", ["side", "three-quarter", "front"]),
  "single-leg-rdl": V("side", ["side", "three-quarter", "front"]),
  "hip-bridge": V("side", ["side", "three-quarter"], { "three-quarter": 35 }),
  "goblet-squat": V("front", ["front", "side", "three-quarter"]),
  "prying-goblet-squat": V("front", ["front", "side", "three-quarter"]),
  "front-squat": V("front", ["front", "side", "three-quarter"]),
  "reverse-lunge-racked": V("side", ["side", "three-quarter", "front"]),
  "strict-press": V("front", ["front", "side", "three-quarter"]),
  "push-press": V("front", ["front", "side", "three-quarter"]),
  "floor-press": V("side", ["side", "three-quarter"], { "three-quarter": 35 }),
  "half-kneeling-press": V("three-quarter", ["three-quarter", "side", "front"]),
  "one-arm-row": V("side", ["side", "three-quarter", "front"]),
  "high-pull": V("side", ["side", "three-quarter", "front"]),
  clean: V("three-quarter", ["three-quarter", "side", "front"]),
  snatch: V("three-quarter", ["three-quarter", "side", "front"]),
  "clean-and-press": V("three-quarter", ["three-quarter", "side", "front"]),
  "turkish-get-up": V("three-quarter", ["three-quarter", "side"], { "three-quarter": 35 }),
  windmill: V("front", ["front", "three-quarter", "side"]),
  halo: V("front", ["front", "three-quarter", "side"]),
  "arm-bar": V("side", ["side", "three-quarter", "front"], { front: 70 }),
  "bottom-up-press": V("front", ["front", "side", "three-quarter"]),
  "suitcase-carry": V("front", ["front", "three-quarter", "side"]),
  "rack-carry": V("front", ["front", "three-quarter", "side"]),
  "farmer-carry": V("front", ["front", "three-quarter", "side"]),
  "bottom-up-carry": V("front", ["front", "three-quarter", "side"]),
  "waiter-carry": V("front", ["front", "three-quarter", "side"]),
  "figure-8": V("front", ["front", "three-quarter", "side"]),
};

/** Normaliza el nombre de vista ("angle" es alias de "three-quarter"). */
export function normalizeView(v: FigureView | "angle"): FigureView {
  return v === "angle" ? "three-quarter" : v;
}

/** Yaw de cámara (grados) de una vista para un ejercicio. */
export function viewYaw(id: ExerciseId, view: FigureView | "angle" | number): number {
  if (typeof view === "number") return view;
  const v = normalizeView(view);
  return FIGURE_VIEWS[id].yaw?.[v] ?? VIEW_YAW[v];
}
