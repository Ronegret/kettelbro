/**
 * Esqueleto 3D de las figuras.
 *
 * Fuente: las poses SAGITALES de skeleton.ts (vista lateral, ángulos interpolados). Aquí se "levantan" a
 * 3D sin reescribirlas: las posiciones (x, y) de la cadera, el pecho, la cabeza, los tobillos y las
 * manos salen tal cual de la cinemática 2D, y se les añade la coordenada lateral z con los parámetros
 * `lat` de la pose (ancho de postura, manos juntas, etc.). Rodillas y codos se recolocan con IK de dos
 * huesos en 3D, usando la flexión 2D como polo: de lado la figura se ve igual que antes.
 *
 * Ejes (los del lienzo): x = adelante (derecha en la vista lateral) · y = ABAJO · z = lado derecho del
 * cuerpo (hacia quien mira en la vista lateral). Índice 0 = miembros derechos/cercanos, 1 = izquierdos.
 *
 * Cámara: ortográfica con giro `yaw` alrededor de la vertical. 0 = de lado (mirando a la derecha),
 * 90 = de frente, 45 = tres cuartos.
 */
import {
  BELL,
  BONE,
  GROUND_Y,
  bellAngle,
  samplePhase,
  solve,
  type Animation,
  type FullPose,
  type Pt,
} from "./skeleton";

export type CharacterId = "bro" | "princess";
export const CHARACTERS: readonly CharacterId[] = ["bro", "princess"];

export interface V3 {
  x: number;
  y: number;
  z: number;
}

const RAD = Math.PI / 180;

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k);
/** a + b·k */
export const madd = (a: V3, b: V3, k: number): V3 => v3(a.x + b.x * k, a.y + b.y * k, a.z + b.z * k);
export const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = (a: V3): number => Math.hypot(a.x, a.y, a.z);
export const mid = (a: V3, b: V3, t = 0.5): V3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
export function unit(a: V3, fallback: V3 = v3(1, 0, 0)): V3 {
  const l = len(a);
  return l < 1e-9 ? fallback : mul(a, 1 / l);
}

/** Rota alrededor de la vertical: +x gira hacia +z con ángulo positivo. */
export function rotY(v: V3, deg: number): V3 {
  if (!deg) return v;
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  return v3(v.x * c - v.z * s, v.y, v.x * s + v.z * c);
}

/** Rodrigues: rota v alrededor del eje unitario k. */
export function rotAxis(v: V3, k: V3, deg: number): V3 {
  if (!deg) return v;
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return v3(v.x * c + kv.x * s + k.x * kd, v.y * c + kv.y * s + k.y * kd, v.z * c + kv.z * s + k.z * kd);
}

/** IK de dos huesos en 3D: posición de la articulación intermedia (rodilla/codo). */
export function ik3(a: V3, b: V3, l1: number, l2: number, pole: V3): V3 {
  const ab = sub(b, a);
  const d = len(ab);
  if (d < 1e-6) return madd(a, unit(pole), l1);
  const u = mul(ab, 1 / d);
  // Fuera de alcance: recto (estirado una pizca) para respetar exactamente manos y pies de la pose.
  if (d >= l1 + l2 - 1e-6) return madd(a, u, (d * l1) / (l1 + l2));
  const dd = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  const x = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  let pp = sub(pole, mul(u, dot(pole, u)));
  if (len(pp) < 1e-6) pp = Math.abs(u.y) < 0.9 ? cross(u, v3(0, 1, 0)) : cross(u, v3(1, 0, 0));
  pp = unit(pp);
  return madd(madd(a, u, x), pp, h);
}

// ───────────────────────── Personajes: medidas del esqueleto ─────────────────────────

export interface CharDims {
  /** Escala de los parámetros laterales de la pose (autoría para la complexión del "bro"). */
  latScale: number;
  /** Media distancia entre articulaciones de cadera. */
  hipW: number;
  /** Media distancia entre articulaciones de hombro. */
  shoulderW: number;
}

export const CHAR_DIMS: Readonly<Record<CharacterId, CharDims>> = {
  bro: { latScale: 1, hipW: 6.4, shoulderW: 13.4 },
  princess: { latScale: 0.87, hipW: 6.6, shoulderW: 11.4 },
};

// ───────────────────────── Rig ─────────────────────────

export interface Bell3 {
  grip: V3;
  /** Dirección unitaria agarre -> centro del cuerpo. */
  dir: V3;
  /** Dirección unitaria de la barra del asa (perpendicular a dir). */
  bar: V3;
  hang: number;
  size: number;
}

type Pair = [V3, V3];

export interface Rig {
  pelvis: V3;
  /** Centro de los hombros (punto "shoulder" de la pose 2D). */
  chest: V3;
  head: V3;
  /** Marco de la pelvis (con roll): columna, pecho, lado derecho. */
  up: V3;
  fwd: V3;
  lat: V3;
  /** Giro de la parte superior (grados, alrededor de la vertical). */
  twist: number;
  hip: Pair;
  knee: Pair;
  ankle: Pair;
  heel: Pair;
  toe: Pair;
  /** "Arriba" del pie (para el grosor de la zapatilla). */
  footUp: Pair;
  sh: Pair;
  elbow: Pair;
  hand: Pair;
  /** La mano agarra una pesa (puño). */
  grip: [boolean, boolean];
  /** Marco de la cabeza: cara, arriba, lado derecho. */
  hF: V3;
  hU: V3;
  hL: V3;
  bells: Bell3[];
}

const p3 = (q: Pt, z = 0): V3 => v3(q.x, q.y, z);

function bend2(jointMid: Pt, a: Pt, b: Pt): V3 {
  return unit(v3(jointMid.x - (a.x + b.x) / 2, jointMid.y - (a.y + b.y) / 2, 0), v3(0, 0, 0));
}

export function solveRig(p: FullPose, ch: CharDims): Rig {
  const s2 = solve(p);
  const L = p.lat;
  const k = ch.latScale;

  const pelvis = p3(s2.hip);
  const t = p.torso * RAD;
  let up = v3(Math.sin(t), -Math.cos(t), 0);
  let fwd = v3(Math.cos(t), Math.sin(t), 0);
  let lat = v3(0, 0, 1);
  if (L.roll) {
    fwd = rotAxis(fwd, up, L.roll);
    lat = rotAxis(lat, up, L.roll);
  }
  const tw = L.twist;
  const twP = (q: V3): V3 => (tw ? add(pelvis, rotY(sub(q, pelvis), tw)) : q);
  const latC = rotY(lat, tw);

  const chest = twP(p3(s2.shoulder));
  const head = twP(p3(s2.head));

  const hip: Pair = [madd(pelvis, lat, ch.hipW), madd(pelvis, lat, -ch.hipW)];
  const sh: Pair = [madd(chest, latC, ch.shoulderW), madd(chest, latC, -ch.shoulderW)];

  // ── Piernas ──
  const ankle: Pair = [p3(s2.ankle, L.stance * k), p3(s2.ankle2, -L.stance2 * k)];
  const kneeOut = L.kneeOut * RAD;
  const toeOut = L.toeOut * RAD;
  const knee = [v3(0, 0, 0), v3(0, 0, 0)] as Pair;
  const heel = [v3(0, 0, 0), v3(0, 0, 0)] as Pair;
  const toe = [v3(0, 0, 0), v3(0, 0, 0)] as Pair;
  const footUp = [v3(0, -1, 0), v3(0, -1, 0)] as Pair;
  for (const i of [0, 1] as const) {
    const side = i === 0 ? 1 : -1;
    const k2 = i === 0 ? s2.knee : s2.knee2;
    const a2 = i === 0 ? s2.ankle : s2.ankle2;
    let b = bend2(k2, s2.hip, a2);
    if (len(b) < 1e-6) b = v3(1, 0, 0);
    const pole = add(mul(b, Math.cos(kneeOut)), v3(0, 0, side * Math.sin(kneeOut)));
    knee[i] = ik3(hip[i], ankle[i], BONE.thigh, BONE.shin, pole);

    const h2 = i === 0 ? s2.heel : s2.heel2;
    const t2 = i === 0 ? s2.toe : s2.toe2;
    const fl = Math.hypot(t2.x - h2.x, t2.y - h2.y) || 1;
    const fx = (t2.x - h2.x) / fl;
    const fy = (t2.y - h2.y) / fl;
    const f3 = v3(fx * Math.cos(toeOut), fy, side * fx * Math.sin(toeOut));
    heel[i] = madd(ankle[i], f3, -BONE.heel);
    toe[i] = madd(ankle[i], f3, BONE.toe);
    const sv = cross(f3, v3(0, -1, 0));
    let fu = len(sv) < 1e-6 ? v3(-1, 0, 0) : unit(cross(unit(sv), f3));
    if (fu.y > 0) fu = mul(fu, -1);
    footUp[i] = fu;
  }

  // ── Brazos ── (la cadena 2D se aplica desde el hombro 3D: con roll la mano sigue al hombro)
  const hand = [v3(0, 0, 0), v3(0, 0, 0)] as Pair;
  const elbow = [v3(0, 0, 0), v3(0, 0, 0)] as Pair;
  const sh0 = [madd(p3(s2.shoulder), lat, ch.shoulderW), madd(p3(s2.shoulder), lat, -ch.shoulderW)] as Pair;
  for (const i of [0, 1] as const) {
    const side = i === 0 ? 1 : -1;
    const h2 = i === 0 ? s2.hand : s2.hand2;
    const e2 = i === 0 ? s2.elbow : s2.elbow2;
    const base = sh0[i];
    // z de la mano relativa al hombro (sin roll equivale a z = ±handZ; con roll sigue al hombro).
    const hz = base.z + side * ((i === 0 ? L.handZ : L.handZ2) * k - ch.shoulderW);
    const fix = i === 0 ? L.handFix : L.handFix2;
    const rx = base.x + (h2.x - s2.shoulder.x);
    const ry = base.y + (h2.y - s2.shoulder.y);
    const hu = v3(rx + (h2.x - rx) * fix, ry + (h2.y - ry) * fix, hz);
    hand[i] = twP(hu);
    let b = bend2(e2, s2.shoulder, h2);
    if (len(b) < 1e-6) b = v3(-0.3, 0.95, 0);
    const eo = (i === 0 ? L.elbowOut : L.elbowOut2) * RAD;
    const out = mul(lat, side);
    const pole = rotY(add(mul(b, Math.cos(eo)), mul(out, Math.sin(eo))), tw);
    elbow[i] = ik3(sh[i], hand[i], BONE.upperArm, BONE.foreArm, pole);
  }

  // ── Cabeza ──
  const g = p.gaze * RAD;
  let hF = v3(Math.sin(g), -Math.cos(g), 0);
  let hU = v3(-Math.cos(g), -Math.sin(g), 0);
  let hL = v3(0, 0, 1);
  if (L.roll) {
    hF = rotAxis(hF, up, L.roll);
    hU = rotAxis(hU, up, L.roll);
    hL = rotAxis(hL, up, L.roll);
  }
  if (L.headYaw) {
    hF = rotAxis(hF, hU, L.headYaw);
    hL = rotAxis(hL, hU, L.headYaw);
  }
  if (tw) {
    hF = rotY(hF, tw);
    hU = rotY(hU, tw);
    hL = rotY(hL, tw);
  }

  // ── Pesas ──
  const bells: Bell3[] = [];
  const b = p.bell;
  const bellDir = (ang: number, tilt: number, side: number): V3 => {
    const a = ang * RAD;
    const ti = tilt * RAD;
    return rotY(v3(Math.sin(a) * Math.cos(ti), -Math.cos(a) * Math.cos(ti), side * Math.sin(ti)), tw);
  };
  const barDir = (dir: V3, deg: number, side: number): V3 => {
    const a = deg * RAD;
    const base = rotY(v3(Math.cos(a), 0, side * Math.sin(a)), tw);
    const pr = sub(base, mul(dir, dot(base, dir)));
    return len(pr) < 1e-4 ? unit(cross(dir, v3(0, 1, 0)), v3(0, 0, 1)) : unit(pr);
  };
  const push = (grip: V3, ang: number, side: number) => {
    const dir = bellDir(ang, b.tilt, side === 0 ? 1 : side);
    bells.push({ grip, dir, bar: barDir(dir, b.bar, side === 0 ? 1 : side), hang: b.hang, size: b.size });
  };
  const ang1 = bellAngle(p);
  if (b.at === "hand") push(hand[0], ang1, 1);
  else if (b.at === "hand2") push(hand[1], ang1, -1);
  else if (b.at === "both") push(mid(hand[0], hand[1]), ang1, 0);
  else if (b.at === "pair") {
    push(hand[0], ang1, 1);
    push(hand[1], p.bell.ang ?? p.foreArm2 + b.rel, -1);
  }
  const grip: [boolean, boolean] = [
    b.at === "hand" || b.at === "both" || b.at === "pair",
    b.at === "hand2" || b.at === "both" || b.at === "pair",
  ];

  return {
    pelvis,
    chest,
    head,
    up,
    fwd,
    lat,
    twist: tw,
    hip,
    knee,
    ankle,
    heel,
    toe,
    footUp,
    sh,
    elbow,
    hand,
    grip,
    hF,
    hU,
    hL,
    bells,
  };
}

// ───────────────────────── Cámara ─────────────────────────

export interface Cam {
  yaw: number;
  c: number;
  s: number;
  /** x del eje vertical alrededor del que gira la cámara. */
  px: number;
}

export function camera(yaw: number, px: number): Cam {
  return { yaw, c: Math.cos(yaw * RAD), s: Math.sin(yaw * RAD), px };
}

export interface P2 {
  x: number;
  y: number;
}

/** Proyección de un punto (x en pantalla, y igual). */
export const pj = (cam: Cam, p: V3): P2 => ({ x: cam.px + (p.x - cam.px) * cam.c - p.z * cam.s, y: p.y });
/** Profundidad de un punto (+ = hacia quien mira). */
export const dp = (cam: Cam, p: V3): number => (p.x - cam.px) * cam.s + p.z * cam.c;
/** Proyección de un vector. */
export const pv = (cam: Cam, v: V3): P2 => ({ x: v.x * cam.c - v.z * cam.s, y: v.y });
/** Componente de profundidad de un vector. */
export const dv = (cam: Cam, v: V3): number => v.x * cam.s + v.z * cam.c;

// ───────────────────────── Encuadre ─────────────────────────

export interface Framing3 {
  /** Escala común a todas las vistas del ejercicio (no cambia al girar). */
  s: number;
  /** Eje de giro de la cámara. */
  px: number;
  ty: number;
  /** Desplazamiento horizontal por yaw (centra la figura en cada vista). */
  tx: (yaw: number) => number;
}

const framingCache = new WeakMap<Animation, Map<string, Framing3>>();

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
}

function boundsAt(rigs: Rig[], px: number, yaw: number, headR: number): Bounds {
  const cam = camera(yaw, px);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  const put = (p: V3, r: number) => {
    const q = pj(cam, p);
    if (q.x - r < minX) minX = q.x - r;
    if (q.x + r > maxX) maxX = q.x + r;
    if (q.y - r < minY) minY = q.y - r;
  };
  for (const r of rigs) {
    for (const i of [0, 1] as const) {
      put(r.hip[i], 8);
      put(r.knee[i], 6);
      put(r.heel[i], 5);
      put(r.toe[i], 5);
      put(r.sh[i], 7);
      put(r.elbow[i], 5.5);
      put(r.hand[i], 5);
    }
    put(r.head, headR);
    put(r.pelvis, 10);
    for (const b of r.bells) {
      put(madd(b.grip, b.dir, b.hang * b.size), (BELL.r + 2) * b.size);
      put(b.grip, 5);
    }
  }
  return { minX, maxX, minY };
}

/**
 * Encuadre fijo por animación y personaje: abarca TODO el recorrido en las tres vistas base, con una
 * escala común (la figura no crece ni encoge al girar la cámara) y centrado propio para cada yaw.
 */
export function framing3(anim: Animation, character: CharacterId): Framing3 {
  let byChar = framingCache.get(anim);
  if (!byChar) {
    byChar = new Map();
    framingCache.set(anim, byChar);
  }
  const hit = byChar.get(character);
  if (hit) return hit;

  const dims = CHAR_DIMS[character];
  const rigs: Rig[] = [];
  const steps = 40;
  for (let i = 0; i < steps; i++) rigs.push(solveRig(samplePhase(anim, i / steps), dims));
  let px = 0;
  for (const r of rigs) px += r.pelvis.x;
  px /= rigs.length;

  const headR = character === "princess" ? 13 : 11;
  const fit = (b: Bounds) => {
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, GROUND_Y + 2 - b.minY);
    return Math.min(1.45, 176 / w, 160 / h);
  };
  const base = [0, 45, 90].map((y) => boundsAt(rigs, px, y, headR));
  const s = Math.min(...base.map(fit));
  const centers = new Map<number, number>();
  const centerAt = (yaw: number): number => {
    const key = Math.round(yaw);
    const c = centers.get(key);
    if (c !== undefined) return c;
    const b = boundsAt(rigs, px, key, headR);
    const v = (b.minX + b.maxX) / 2;
    centers.set(key, v);
    return v;
  };
  const f: Framing3 = {
    s,
    px,
    ty: GROUND_Y * (1 - s),
    tx: (yaw: number) => {
      // Interpolación entre grados enteros (el giro animado pasa por valores fraccionarios).
      const y0 = Math.floor(yaw);
      const u = yaw - y0;
      const c = centerAt(y0) * (1 - u) + centerAt(y0 + 1) * u;
      return 100 - s * c;
    },
  };
  byChar.set(character, f);
  return f;
}
