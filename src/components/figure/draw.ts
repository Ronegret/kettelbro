/**
 * Dibujo humano de las figuras: convierte el rig 3D + cámara en atributos SVG (formas planas, sin
 * contornos pesados) y en el ORDEN de las partes por profundidad. Sin React: ExerciseFigure pinta la
 * estructura una vez y aplica estos atributos por referencia en cada fotograma.
 *
 * Partes (cada una es un <g> que se reordena según su profundidad):
 *   piernas (muslo, espinilla, zapatilla) · tronco (con ropa) · cuello · cabeza (cara, pelo/barba) ·
 *   coleta · brazos (brazo, antebrazo con tatuajes recortados, mano) · pesas (asa y cuerpo por separado).
 */
import { BELL, BONE, GROUND_Y } from "./skeleton";
import {
  add,
  cross,
  dp,
  dv,
  len,
  madd,
  mid,
  mul,
  pj,
  pv,
  rotY,
  sub,
  unit,
  v3,
  type Cam,
  type CharacterId,
  type P2,
  type Rig,
  type V3,
} from "./rig";

// ───────────────────────── Partes ─────────────────────────

export type PartKey =
  | "thR"
  | "thL"
  | "shR"
  | "shL"
  | "ftR"
  | "ftL"
  | "torso"
  | "neck"
  | "head"
  | "tail"
  | "uaR"
  | "uaL"
  | "faR"
  | "faL"
  | "hdR"
  | "hdL"
  | "bh0"
  | "bb0"
  | "bh1"
  | "bb1";

export type Attrs = Record<string, string>;

export interface Frame {
  a: Record<string, Attrs>;
  order: PartKey[];
}

// ───────────────────────── Apariencia por personaje ─────────────────────────

type R3 = readonly [number, number, number];
/** Sección del tronco: [s (0 = cadera, 1 = hombros), media anchura lateral, media profundidad, desplazamiento al frente]. */
type Sec = readonly [number, number, number, number];
/** Sección de la zapatilla: [t (0 talón .. 1 puntera), media anchura, media altura, bajada bajo la línea del pie]. */
type ShoeSec = readonly [number, number, number, number];

export interface Look {
  id: CharacterId;
  thigh: R3;
  shin: R3;
  upper: R3;
  fore: R3;
  neck: number;
  fist: number;
  torso: readonly Sec[];
  top: readonly Sec[];
  pants: readonly Sec[];
  band: readonly Sec[];
  /** Fracción del muslo / espinilla cubierta por el pantalón. */
  thighCover: number;
  shinCover: number;
  pantsExtra: number;
  sock: boolean;
  /** Escote: [s, media anchura, media altura]. */
  neckline: readonly [number, number, number];
  /** Sisa (piel al costado del pecho): [s, media altura, media anchura]. */
  armhole: readonly [number, number, number];
  /** Cráneo: [radio al frente, vertical, lateral]. */
  head: R3;
  /** Mandíbula / barba: [adelante, abajo, radio frente, vertical, lateral]. */
  jaw: readonly [number, number, number, number, number];
  shoe: readonly ShoeSec[];
  eye: readonly [number, number];
  tattoo: boolean;
  beard: boolean;
  hair: boolean;
}

export const LOOKS: Readonly<Record<CharacterId, Look>> = {
  bro: {
    id: "bro",
    thigh: [7.2, 6.7, 4.8],
    shin: [4.9, 5.1, 3.0],
    upper: [5.7, 4.7, 3.5],
    fore: [3.9, 3.7, 2.6],
    neck: 4.7,
    fist: 3.3,
    torso: [
      [-0.14, 9.8, 7.4, -0.8],
      [0.03, 12.6, 8.4, -1.2],
      [0.3, 11.6, 7.6, -0.2],
      [0.6, 13.4, 9.0, 0.9],
      [0.84, 14.6, 8.8, 0.7],
      [1.03, 12.4, 6.6, -0.2],
    ],
    top: [
      [0.26, 12.0, 7.95, -0.2],
      [0.6, 13.8, 9.35, 0.9],
      [0.8, 13.1, 9.15, 0.7],
      [0.95, 9.2, 7.9, 0.2],
      [1.045, 5.6, 6.7, -0.2],
    ],
    pants: [
      [-0.16, 10.4, 7.9, -0.8],
      [0.03, 13.1, 8.9, -1.2],
      [0.35, 12.1, 8.1, -0.2],
    ],
    band: [
      [0.29, 12.25, 8.25, -0.2],
      [0.36, 12.15, 8.15, -0.2],
    ],
    thighCover: 0.56,
    shinCover: 0,
    pantsExtra: 1.3,
    sock: true,
    neckline: [0.96, 4.8, 4.4],
    armhole: [0.86, 6.4, 4.6],
    head: [8.4, 9.4, 7.4],
    jaw: [2.6, 4.2, 6.3, 5.5, 7.1],
    shoe: [
      [0, 3.6, 3.7, 1.9],
      [0.38, 4.2, 3.8, 1.7],
      [0.74, 4.4, 3.0, 2.5],
      [1, 3.6, 2.3, 3.1],
    ],
    eye: [1.0, 1.15],
    tattoo: true,
    beard: true,
    hair: false,
  },
  princess: {
    id: "princess",
    thigh: [6.3, 5.7, 4.1],
    shin: [4.1, 4.2, 2.6],
    upper: [4.1, 3.4, 2.8],
    fore: [3.0, 2.8, 2.1],
    neck: 3.3,
    fist: 2.7,
    torso: [
      [-0.14, 9.6, 7.0, -0.9],
      [0.03, 12.6, 8.0, -1.4],
      [0.32, 9.2, 6.4, 0],
      [0.6, 10.6, 7.4, 1.0],
      [0.84, 11.8, 7.0, 0.6],
      [1.03, 10.2, 5.6, -0.2],
    ],
    top: [
      [0.55, 10.35, 7.25, 0.85],
      [0.66, 10.95, 7.75, 1.05],
      [0.82, 11.3, 7.25, 0.6],
      [0.96, 7.6, 6.2, 0.2],
      [1.045, 4.6, 5.7, -0.2],
    ],
    pants: [
      [-0.16, 9.9, 7.3, -0.9],
      [0.03, 12.95, 8.35, -1.4],
      [0.37, 9.45, 6.65, 0],
    ],
    band: [
      [0.31, 9.62, 6.72, 0],
      [0.37, 9.55, 6.7, 0],
    ],
    thighCover: 1,
    shinCover: 0.84,
    pantsExtra: 0.25,
    sock: false,
    neckline: [0.97, 3.9, 3.8],
    armhole: [0.86, 6.0, 4.2],
    head: [8.0, 9.0, 7.0],
    jaw: [2.1, 4.4, 5.6, 4.4, 5.4],
    shoe: [
      [0, 3.2, 3.4, 1.9],
      [0.38, 3.7, 3.5, 1.7],
      [0.74, 3.9, 2.8, 2.5],
      [1, 3.2, 2.1, 3.0],
    ],
    eye: [1.05, 1.3],
    tattoo: false,
    beard: false,
    hair: true,
  },
};

// ───────────────────────── Utilidades 2D ─────────────────────────

const RAD = Math.PI / 180;
const KAPPA = 0.5523;
/** Luz desde arriba a la izquierda: la sombra cae hacia abajo/derecha. */
const LIGHT: P2 = { x: 0.5, y: 0.86 };

const n = (v: number): string => String(Math.round(v * 100) / 100);
const P = (x: number, y: number): P2 => ({ x, y });
const pt = (p: P2): string => `${n(p.x)} ${n(p.y)}`;
const padd = (a: P2, b: P2, k = 1): P2 => P(a.x + b.x * k, a.y + b.y * k);
const pdot = (a: P2, b: P2): number => a.x * b.x + a.y * b.y;
const plen = (a: P2): number => Math.hypot(a.x, a.y);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

function frameOf(a: P2, b: P2): { t: P2; nn: P2; L: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  const t = L < 1e-3 ? P(0, 1) : P(dx / L, dy / L);
  return { t, nn: P(-t.y, t.x), L };
}

/** Cápsula afinada (radios en el extremo proximal, el medio y el distal). */
function limbD(a: P2, b: P2, r0: number, r1: number, r2: number): string {
  const { t, nn } = frameOf(a, b);
  const m = P((a.x + b.x) / 2, (a.y + b.y) / 2);
  const A1 = padd(a, nn, r0);
  const A2 = padd(a, nn, -r0);
  const M1 = padd(m, nn, r1);
  const M2 = padd(m, nn, -r1);
  const B1 = padd(b, nn, r2);
  const B2 = padd(b, nn, -r2);
  const c1 = P(2 * M1.x - (A1.x + B1.x) / 2, 2 * M1.y - (A1.y + B1.y) / 2);
  const c2 = P(2 * M2.x - (B2.x + A2.x) / 2, 2 * M2.y - (B2.y + A2.y) / 2);
  const tb = padd(b, t, r2);
  const ta = padd(a, t, -r0);
  return (
    `M${pt(A1)}Q${pt(c1)} ${pt(B1)}` +
    `C${pt(padd(B1, t, KAPPA * r2))} ${pt(padd(tb, nn, KAPPA * r2))} ${pt(tb)}` +
    `C${pt(padd(tb, nn, -KAPPA * r2))} ${pt(padd(B2, t, KAPPA * r2))} ${pt(B2)}` +
    `Q${pt(c2)} ${pt(A2)}` +
    `C${pt(padd(A2, t, -KAPPA * r0))} ${pt(padd(ta, nn, -KAPPA * r0))} ${pt(ta)}` +
    `C${pt(padd(ta, nn, KAPPA * r0))} ${pt(padd(A1, t, -KAPPA * r0))} ${pt(A1)}Z`
  );
}

/** Franja de sombra plana a lo largo de un miembro (lado contrario a la luz). */
function shadeD(a: P2, b: P2, r0: number, r1: number, r2: number): string {
  const { nn } = frameOf(a, b);
  const sg = pdot(nn, LIGHT) >= 0 ? 1 : -1;
  const k = 0.6;
  return limbD(padd(a, nn, sg * k * r0), padd(b, nn, sg * k * r2), (1 - k) * r0, (1 - k) * r1, (1 - k) * r2);
}

/** Spline Catmull-Rom (desde p[0], que ya es el punto actual). */
function crPath(p: P2[]): string {
  let s = "";
  for (let i = 0; i < p.length - 1; i++) {
    const p1 = p[i] as P2;
    const p2 = p[i + 1] as P2;
    const p0 = p[i - 1] ?? p1;
    const p3 = p[i + 2] ?? p2;
    s += `C${pt(P(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6))} ${pt(P(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6))} ${pt(p2)}`;
  }
  return s;
}

interface Sec2 {
  c: P2;
  A: P2;
  B: P2;
}

interface TubeOut {
  d: string;
  nn: P2;
  e: number[];
}

/** Silueta de un tubo de secciones elípticas proyectadas (tronco, zapatilla). */
function tube(secs: Sec2[], minCap: number): TubeOut {
  const f = secs[0] as Sec2;
  const l = secs[secs.length - 1] as Sec2;
  const { t, nn } = frameOf(f.c, l.c);
  const ext = (s: Sec2, d: P2): number => Math.hypot(pdot(d, s.A), pdot(d, s.B));
  const e = secs.map((s) => ext(s, nn));
  const left = secs.map((s, i) => padd(s.c, nn, e[i] as number));
  const right = secs.map((s, i) => padd(s.c, nn, -(e[i] as number))).reverse();
  const eL = e[e.length - 1] as number;
  const e0 = e[0] as number;
  const capL = Math.max(ext(l, t), minCap * eL);
  const capF = Math.max(ext(f, t), minCap * e0);
  const L1 = left[left.length - 1] as P2;
  const R1 = right[0] as P2;
  const tipL = padd(l.c, t, capL);
  const R0 = right[right.length - 1] as P2;
  const L0 = left[0] as P2;
  const tipF = padd(f.c, t, -capF);
  const d =
    `M${pt(L0)}` +
    crPath(left) +
    `C${pt(padd(L1, t, KAPPA * capL))} ${pt(padd(tipL, nn, KAPPA * eL))} ${pt(tipL)}` +
    `C${pt(padd(tipL, nn, -KAPPA * eL))} ${pt(padd(R1, t, KAPPA * capL))} ${pt(R1)}` +
    crPath(right) +
    `C${pt(padd(R0, t, -KAPPA * capF))} ${pt(padd(tipF, nn, -KAPPA * e0))} ${pt(tipF)}` +
    `C${pt(padd(tipF, nn, KAPPA * e0))} ${pt(padd(L0, t, -KAPPA * capF))} ${pt(L0)}Z`;
  return { d, nn, e };
}

/** Círculo transformado afínmente: c + a·cos + b·sin. */
function discD(c: P2, a: P2, b: P2): string {
  const p0 = padd(c, a);
  const p1 = padd(c, b);
  const p2 = padd(c, a, -1);
  const p3 = padd(c, b, -1);
  return (
    `M${pt(p0)}C${pt(padd(p0, b, KAPPA))} ${pt(padd(p1, a, KAPPA))} ${pt(p1)}` +
    `C${pt(padd(p1, a, -KAPPA))} ${pt(padd(p2, b, KAPPA))} ${pt(p2)}` +
    `C${pt(padd(p2, b, -KAPPA))} ${pt(padd(p3, a, -KAPPA))} ${pt(p3)}` +
    `C${pt(padd(p3, a, KAPPA))} ${pt(padd(p0, b, -KAPPA))} ${pt(p0)}Z`
  );
}

interface Ell {
  c: P2;
  rx: number;
  ry: number;
  rot: number;
}

/** Proyección (exacta) de un elipsoide de semiejes a, b, d. */
function projEll(cam: Cam, c3: V3, a: V3, b: V3, d: V3): Ell {
  const A = pv(cam, a);
  const B = pv(cam, b);
  const D = pv(cam, d);
  const m11 = A.x * A.x + B.x * B.x + D.x * D.x;
  const m12 = A.x * A.y + B.x * B.y + D.x * D.y;
  const m22 = A.y * A.y + B.y * B.y + D.y * D.y;
  const tr = (m11 + m22) / 2;
  const df = Math.sqrt(((m11 - m22) / 2) ** 2 + m12 * m12);
  return {
    c: pj(cam, c3),
    rx: Math.sqrt(tr + df),
    ry: Math.sqrt(Math.max(0, tr - df)),
    rot: 0.5 * Math.atan2(2 * m12, m11 - m22),
  };
}

const ellAttrs = (e: Ell): Attrs => ({
  cx: n(e.c.x),
  cy: n(e.c.y),
  rx: n(e.rx),
  ry: n(e.ry),
  transform: `rotate(${n(e.rot / RAD)} ${n(e.c.x)} ${n(e.c.y)})`,
});

function ellPoint(e: Ell, th: number, grow = 0): P2 {
  const cr = Math.cos(e.rot);
  const sr = Math.sin(e.rot);
  const x = (e.rx + grow) * Math.cos(th);
  const y = (e.ry + grow) * Math.sin(th);
  return P(e.c.x + x * cr - y * sr, e.c.y + x * sr + y * cr);
}

/** Contorno de elipse con festones (rizos). */
function bumpyD(e: Ell, count: number, bump: number, phase = 0): string {
  const pts: P2[] = [];
  for (let i = 0; i < count; i++) pts.push(ellPoint(e, phase + (2 * Math.PI * i) / count));
  let d = `M${pt(pts[0] as P2)}`;
  for (let i = 0; i < count; i++) {
    const a = pts[i] as P2;
    const b = pts[(i + 1) % count] as P2;
    const m = P((a.x + b.x) / 2, (a.y + b.y) / 2);
    const o = P(m.x - e.c.x, m.y - e.c.y);
    const ol = plen(o) || 1;
    d += `Q${pt(padd(m, o, (2 * bump) / ol))} ${pt(b)}`;
  }
  return d + "Z";
}

/** Tubo de radio variable a lo largo de una polilínea (coleta). */
function polyTubeD(p: P2[], r: number[]): string {
  const N = p.length;
  const nrm: P2[] = [];
  for (let i = 0; i < N; i++) {
    const a = p[Math.max(0, i - 1)] as P2;
    const b = p[Math.min(N - 1, i + 1)] as P2;
    nrm.push(frameOf(a, b).nn);
  }
  const L = p.map((q, i) => padd(q, nrm[i] as P2, r[i] as number));
  const R = p.map((q, i) => padd(q, nrm[i] as P2, -(r[i] as number))).reverse();
  const tEnd = frameOf(p[N - 2] as P2, p[N - 1] as P2).t;
  const tStart = frameOf(p[0] as P2, p[1] as P2).t;
  const rE = r[N - 1] as number;
  const r0 = r[0] as number;
  const nE = nrm[N - 1] as P2;
  const n0 = nrm[0] as P2;
  const tipE = padd(p[N - 1] as P2, tEnd, rE);
  const tipS = padd(p[0] as P2, tStart, -r0);
  const LE = L[N - 1] as P2;
  const RE = R[0] as P2;
  const RS = R[N - 1] as P2;
  const LS = L[0] as P2;
  return (
    `M${pt(LS)}` +
    crPath(L) +
    `C${pt(padd(LE, tEnd, KAPPA * rE))} ${pt(padd(tipE, nE, KAPPA * rE))} ${pt(tipE)}` +
    `C${pt(padd(tipE, nE, -KAPPA * rE))} ${pt(padd(RE, tEnd, KAPPA * rE))} ${pt(RE)}` +
    crPath(R) +
    `C${pt(padd(RS, tStart, -KAPPA * r0))} ${pt(padd(tipS, n0, -KAPPA * r0))} ${pt(tipS)}` +
    `C${pt(padd(tipS, n0, KAPPA * r0))} ${pt(padd(LS, tStart, -KAPPA * r0))} ${pt(LS)}Z`
  );
}

const circleSub = (c: P2, r: number): string =>
  `M${n(c.x - r)} ${n(c.y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;

// ───────────────────────── Tatuajes (coordenadas locales del hueso) ─────────────────────────
// u = 0 en la articulación proximal .. 1 en la distal · v = -1..1 de un borde al otro del miembro.

const fx = (v: number): string => String(Math.round(v * 1000) / 1000);
function bandLocal(u: number, w: number): string {
  const a = u - w / 2;
  const b = u + w / 2;
  return `M${fx(a)} -1.4Q${fx(a + 0.05)} 0 ${fx(a)} 1.4L${fx(b)} 1.4Q${fx(b + 0.05)} 0 ${fx(b)} -1.4Z`;
}
function diamondLocal(u0: number, u1: number, hv: number, hole = 0.45): string {
  const um = (u0 + u1) / 2;
  const outer = `M${fx(u0)} 0L${fx(um)} ${fx(hv)}L${fx(u1)} 0L${fx(um)} ${fx(-hv)}Z`;
  const k = hole;
  const iu0 = um - ((um - u0) * k);
  const iu1 = um + ((u1 - um) * k);
  const inner = `M${fx(iu0)} 0L${fx(um)} ${fx(-hv * k)}L${fx(iu1)} 0L${fx(um)} ${fx(hv * k)}Z`;
  return outer + inner;
}
function teethLocal(u0: number, u1: number, count: number, span: number): string {
  let d = "";
  const w = (2 * span) / count;
  for (let i = 0; i < count; i++) {
    const v0 = -span + i * w;
    d += `M${fx(u1)} ${fx(v0)}L${fx(u1)} ${fx(v0 + w)}L${fx(u0)} ${fx(v0 + w / 2)}Z`;
  }
  return d;
}

export const TATTOO = {
  upperBands: bandLocal(0.84, 0.05) + bandLocal(0.76, 0.022) + bandLocal(0.17, 0.03),
  upperMotif: teethLocal(0.58, 0.7, 3, 0.85) + diamondLocal(0.24, 0.52, 0.42) + diamondLocal(0.6, 0.7, 0.0001, 0),
  foreBands: bandLocal(0.72, 0.045) + bandLocal(0.8, 0.02) + bandLocal(0.1, 0.02),
  foreMotif: diamondLocal(0.16, 0.36, 0.36) + diamondLocal(0.38, 0.58, 0.36) + teethLocal(0.6, 0.67, 3, 0.8),
} as const;

// ───────────────────────── Figura ─────────────────────────

type Side = 0 | 1;
const SIDES: readonly Side[] = [0, 1];
const SFX = ["R", "L"] as const;

function secAt(tab: readonly Sec[], s: number): Sec {
  const first = tab[0] as Sec;
  if (s <= first[0]) return first;
  for (let i = 0; i < tab.length - 1; i++) {
    const a = tab[i] as Sec;
    const b = tab[i + 1] as Sec;
    if (s <= b[0]) {
      const u = (s - a[0]) / (b[0] - a[0]);
      return [s, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
    }
  }
  return tab[tab.length - 1] as Sec;
}

interface TorsoFrame {
  c: V3;
  up: V3;
  fwd: V3;
  lat: V3;
}

function torsoFrame(rig: Rig, s: number): TorsoFrame {
  const w = smooth(0.15, 0.95, s);
  const ang = rig.twist * w;
  const up = rotY(rig.up, ang);
  return { c: madd(rig.pelvis, up, s * BONE.torso), up, fwd: rotY(rig.fwd, ang), lat: rotY(rig.lat, ang) };
}

function torsoSecs(cam: Cam, rig: Rig, tab: readonly Sec[], grow = 0): Sec2[] {
  return tab.map(([s, w, d, f]) => {
    const fr = torsoFrame(rig, s);
    const c3 = madd(fr.c, fr.fwd, f);
    return { c: pj(cam, c3), A: pv(cam, mul(fr.lat, w + grow)), B: pv(cam, mul(fr.fwd, d + grow)) };
  });
}

/** Opacidad de la capa que oscurece los miembros lejanos. */
const darkness = (rel: number): number => clamp01((-rel - 2.5) / 13) * 0.34;

export interface DrawOpts {
  /** Desplazamiento de la coleta por inercia (vector 3D). */
  sway: V3;
}

export function drawFigure(rig: Rig, cam: Cam, look: Look, opts: DrawOpts): Frame {
  const a: Record<string, Attrs> = {};
  const depth: Array<[PartKey, number]> = [];
  const P2of = (p: V3): P2 => pj(cam, p);
  const bodyDepth = (dp(cam, rig.pelvis) + dp(cam, rig.chest)) / 2;
  const dark = (k: string, d: string, depthVal: number) => {
    a[k] = { d, opacity: n(darkness(depthVal - bodyDepth)) };
  };

  // ── Piernas ──
  for (const i of SIDES) {
    const sx = SFX[i];
    const hip = rig.hip[i];
    const knee = rig.knee[i];
    const ankle = rig.ankle[i];
    const H = P2of(hip);
    const Kp = P2of(knee);
    const A = P2of(ankle);
    const [t0, t1, t2] = look.thigh;
    const thD = limbD(H, Kp, t0, t1, t2);
    a[`th${sx}`] = { d: thD };
    const cov = look.thighCover;
    const e = look.pantsExtra;
    const Ce = P2of(mid(hip, knee, cov));
    const rc = t0 + (t2 - t0) * cov;
    a[`th${sx}P`] = { d: cov >= 1 ? limbD(H, Kp, t0 + e, t1 + e, t2 + e) : limbD(H, Ce, t0 + e, (t0 + rc) / 2 + e * 1.05, rc + e) };
    a[`th${sx}S`] = { d: shadeD(H, Kp, t0, t1, t2) };
    const thDepth = dp(cam, mid(hip, knee, 0.6)) - 1.2;
    dark(`th${sx}D`, cov >= 1 ? (a[`th${sx}P`] as Attrs).d as string : thD, thDepth);
    depth.push([i === 0 ? "thR" : "thL", thDepth]);

    const [s0, s1, s2] = look.shin;
    const shD = limbD(Kp, A, s0, s1, s2);
    a[`sh${sx}`] = { d: shD };
    if (look.shinCover > 0) {
      const sc = look.shinCover;
      const Se = P2of(mid(knee, ankle, sc));
      const rs = s0 + (s2 - s0) * sc;
      a[`sh${sx}P`] = { d: limbD(Kp, Se, s0 + e, s1 + e, rs + e) };
    }
    if (look.sock) {
      const So = P2of(mid(knee, ankle, 0.84));
      a[`sh${sx}K`] = { d: limbD(So, A, s2 + 0.35, s2 + 0.3, s2 + 0.3) };
    }
    a[`sh${sx}S`] = { d: shadeD(Kp, A, s0, s1, s2) };
    const shDepth = dp(cam, mid(knee, ankle)) - 1.2;
    dark(`sh${sx}D`, shD, shDepth);
    depth.push([i === 0 ? "shR" : "shL", shDepth]);

    // Zapatilla: tubo talón -> puntera con secciones elípticas
    const heel = rig.heel[i];
    const toe = rig.toe[i];
    const fu = rig.footUp[i];
    const fd = unit(sub(toe, heel));
    const side = unit(cross(fd, fu), v3(0, 0, 1));
    const shoe: Sec2[] = [];
    const sole: Sec2[] = [];
    for (const [t, w, h, drop] of look.shoe) {
      const c3 = madd(madd(heel, sub(toe, heel), t), fu, -drop);
      shoe.push({ c: P2of(c3), A: pv(cam, mul(side, w)), B: pv(cam, mul(fu, h)) });
      sole.push({ c: P2of(madd(c3, fu, -(h - 0.95))), A: pv(cam, mul(side, w + 0.18)), B: pv(cam, mul(fu, 1.05)) });
    }
    const shoeD = tube(shoe, 0.62).d;
    a[`ft${sx}`] = { d: shoeD };
    a[`ft${sx}So`] = { d: tube(sole, 0.62).d };
    const ftDepth = Math.max(dp(cam, toe), dp(cam, heel)) - 0.9;
    dark(`ft${sx}D`, shoeD, ftDepth);
    depth.push([i === 0 ? "ftR" : "ftL", ftDepth]);
  }

  // ── Tronco ──
  const skin = tube(torsoSecs(cam, rig, look.torso), 0.42);
  a.tSkin = { d: skin.d };
  a.tClip = { d: skin.d };
  a.tTop = { d: tube(torsoSecs(cam, rig, look.top), 0.35).d };
  a.tPants = { d: tube(torsoSecs(cam, rig, look.pants), 0.5).d };
  a.tBand = { d: tube(torsoSecs(cam, rig, look.band), 0.2).d };
  {
    // Escote (piel en el pecho) y sisas (piel en los costados): parches sobre la superficie.
    const [ns, nw, nh] = look.neckline;
    const sec = secAt(look.torso, ns);
    const fr = torsoFrame(rig, ns);
    const c3 = madd(madd(fr.c, fr.fwd, sec[2] * 0.97 + sec[3]), fr.up, -nh * 0.35);
    const facing = dv(cam, fr.fwd);
    a.tNeck = {
      d: discD(P2of(c3), pv(cam, mul(fr.lat, nw)), pv(cam, mul(fr.up, nh))),
      opacity: n(smooth(-0.1, 0.25, facing)),
    };
    const [as, ah, aw] = look.armhole;
    const sa = secAt(look.torso, as);
    const fa = torsoFrame(rig, as);
    for (const i of SIDES) {
      const sg = i === 0 ? 1 : -1;
      const c = madd(madd(fa.c, fa.lat, sg * sa[1] * 0.97), fa.fwd, sa[3] - 0.6);
      const f = dv(cam, mul(fa.lat, sg));
      a[`tArm${i}`] = {
        d: discD(P2of(c), pv(cam, mul(fa.up, ah)), pv(cam, mul(fa.fwd, aw))),
        opacity: n(smooth(-0.05, 0.3, f)),
      };
    }
    // Sombra del tronco: franja del lado contrario a la luz
    const sg = pdot(skin.nn, LIGHT) >= 0 ? 1 : -1;
    const secs = torsoSecs(cam, rig, look.torso);
    const shadeSecs = secs.map((s, i) => ({
      c: padd(s.c, skin.nn, sg * 0.62 * (skin.e[i] as number)),
      A: P(s.A.x * 0.38, s.A.y * 0.38),
      B: P(s.B.x * 0.38, s.B.y * 0.38),
    }));
    a.tShade = { d: tube(shadeSecs, 0.3).d };
  }
  const torsoDepth = dp(cam, mid(rig.pelvis, rig.chest));
  depth.push(["torso", torsoDepth]);

  // ── Cuello ──
  {
    const top = torsoFrame(rig, 1);
    const base = madd(rig.chest, top.up, 1.5);
    const neckTop = madd(rig.head, rig.hU, -4.2);
    const B = P2of(base);
    const T = P2of(neckTop);
    const r = look.neck;
    a.nk = { d: limbD(B, T, r * 1.08, r, r * 0.94) };
    a.nkS = { d: shadeD(B, T, r * 1.08, r, r * 0.94) };
    depth.push(["neck", dp(cam, rig.chest) + 0.4]);
  }

  // ── Cabeza ──
  drawHead(a, rig, cam, look, opts, depth);

  // ── Brazos ──
  for (const i of SIDES) {
    const sx = SFX[i];
    const S3 = rig.sh[i];
    const E3 = rig.elbow[i];
    const H3 = rig.hand[i];
    const S = P2of(S3);
    const E = P2of(E3);
    const H = P2of(H3);
    const [u0, u1, u2] = look.upper;
    const [f0, f1, f2] = look.fore;
    const uaD = limbD(S, E, u0, u1, u2);
    const faD = limbD(E, H, f0, f1, f2);
    a[`ua${sx}`] = { d: uaD };
    a[`fa${sx}`] = { d: faD };
    a[`ua${sx}S`] = { d: shadeD(S, E, u0, u1, u2) };
    a[`fa${sx}S`] = { d: shadeD(E, H, f0, f1, f2) };
    const uaDepth = dp(cam, mid(S3, E3)) + 1.5;
    const faDepth = dp(cam, mid(E3, H3)) + 1.6;
    dark(`ua${sx}D`, uaD, uaDepth);
    dark(`fa${sx}D`, faD, faDepth);
    depth.push([i === 0 ? "uaR" : "uaL", uaDepth]);
    depth.push([i === 0 ? "faR" : "faL", faDepth]);

    if (look.tattoo) {
      // Tatuajes: marco local del hueso + desplazamiento lateral de los motivos según hacia dónde mira
      // la cara externa del brazo (simula la vuelta del dibujo alrededor del cilindro).
      const out3 = mul(rotY(rig.lat, rig.twist), i === 0 ? 1 : -1);
      const seg = (A: P2, B: P2, hw: number, key: string) => {
        const { nn } = frameOf(A, B);
        a[`${key}C`] = { d: key.startsWith("ua") ? uaD : faD };
        a[`${key}T`] = {
          transform: `matrix(${n(B.x - A.x)} ${n(B.y - A.y)} ${n(nn.x * hw)} ${n(nn.y * hw)} ${n(A.x)} ${n(A.y)})`,
        };
        const o = pv(cam, out3);
        const phi = Math.atan2(pdot(o, nn), dv(cam, out3));
        const v1 = (phi / (Math.PI / 2)) * 0.95;
        const v2 = v1 > 0 ? v1 - 2 : v1 + 2;
        a[`${key}T1`] = { transform: `translate(0 ${n(v1)})` };
        a[`${key}T2`] = { transform: `translate(0 ${n(v2)})` };
      };
      seg(S, E, u1, `ua${sx}`);
      seg(E, H, f1, `fa${sx}`);
    }

    // Mano: puño sobre el asa o mano abierta en la dirección del antebrazo
    const fd3 = unit(sub(H3, E3));
    const fd = pv(cam, fd3);
    let hd: string;
    if (rig.grip[i]) {
      const r = look.fist;
      hd = limbD(padd(H, fd, -1.2), padd(H, fd, 1.5), r * 0.92, r, r * 0.95);
    } else {
      const r = look.fist * 0.8;
      hd = limbD(padd(H, fd, -0.6), padd(H, fd, 5.2), r, r * 1.08, r * 0.72);
    }
    a[`hd${sx}`] = { d: hd };
    const hdDepth = dp(cam, H3) + 1.8;
    dark(`hd${sx}D`, hd, hdDepth);
    depth.push([i === 0 ? "hdR" : "hdL", hdDepth]);
  }

  // ── Pesas ──
  for (const bi of [0, 1] as const) {
    const b = rig.bells[bi];
    const kh = bi === 0 ? "bh0" : "bh1";
    const kb = bi === 0 ? "bb0" : "bb1";
    if (!b) {
      a[`P_${kh}`] = { visibility: "hidden" };
      a[`P_${kb}`] = { visibility: "hidden" };
      depth.push([kh, -999]);
      depth.push([kb, -999]);
      continue;
    }
    a[`P_${kh}`] = { visibility: "visible" };
    a[`P_${kb}`] = { visibility: "visible" };
    const s = b.size;
    const R = BELL.r * s;
    const G = P2of(b.grip);
    const C3 = madd(b.grip, b.dir, b.hang * s);
    const C = P2of(C3);
    const D2 = pv(cam, b.dir);
    const dl = plen(D2);
    let Bar = pv(cam, b.bar);
    const minBar = 0.42;
    if (plen(Bar) < minBar) {
      const q = dl > 0.05 ? P(-D2.y / dl, D2.x / dl) : P(1, 0);
      const sg = pdot(q, Bar) >= 0 ? 1 : -1;
      Bar = P(q.x * minBar * sg, q.y * minBar * sg);
    }
    const px = BELL.postX * s;
    const a1 = padd(padd(C, D2, -0.6 * R), Bar, px);
    const a2 = padd(padd(G, D2, 3 * s), Bar, px);
    const c1 = padd(G, Bar, px);
    const a3 = padd(G, Bar, px - 2.8 * s);
    const a4 = padd(G, Bar, -(px - 2.8 * s));
    const c2 = padd(G, Bar, -px);
    const a5 = padd(padd(G, D2, 3 * s), Bar, -px);
    const a6 = padd(padd(C, D2, -0.6 * R), Bar, -px);
    a[kh] = {
      d: `M${pt(a1)}L${pt(a2)}Q${pt(c1)} ${pt(a3)}L${pt(a4)}Q${pt(c2)} ${pt(a5)}L${pt(a6)}`,
      "stroke-width": n(3.7 * s),
    };
    // Cuerpo esférico con base plana (la base desaparece si la pesa apunta a la cámara)
    let body: string;
    if (dl < 0.05) {
      body = circleSub(C, R) + "Z";
    } else {
      const ph = P(D2.x / dl, D2.y / dl);
      const q = P(-ph.y, ph.x);
      const h = R * (0.8 + 0.2 * (1 - dl));
      const w = Math.sqrt(Math.max(0, R * R - h * h));
      const E1 = padd(padd(C, ph, h), q, w);
      const E2 = padd(padd(C, ph, h), q, -w);
      body = `M${pt(E1)}A${n(R)} ${n(R)} 0 1 1 ${pt(E2)}Z`;
    }
    a[kb] = { d: body };
    a[`${kb}Sh`] = {
      cx: n(C.x - 0.36 * R),
      cy: n(C.y - 0.38 * R),
      rx: n(0.2 * R),
      ry: n(0.34 * R),
      transform: `rotate(35 ${n(C.x - 0.36 * R)} ${n(C.y - 0.38 * R)})`,
    };
    a[`${kb}Dk`] = {
      d: `M${pt(padd(C, P(0.72, -0.62), R))}A${n(R)} ${n(R)} 0 0 1 ${pt(padd(C, P(-0.62, 0.72), R))}A${n(R * 1.15)} ${n(R * 1.15)} 0 0 0 ${pt(padd(C, P(0.72, -0.62), R))}Z`,
    };
    depth.push([kh, dp(cam, b.grip) + 1.7]);
    depth.push([kb, dp(cam, C3) + 1.65]);
  }

  // ── Sombra en el suelo ──
  {
    const xs: number[] = [];
    const near = (p: V3, r: number) => {
      if (p.y > GROUND_Y - 24) {
        const q = P2of(p);
        xs.push(q.x - r, q.x + r);
      }
    };
    for (const i of SIDES) {
      near(rig.heel[i], 4);
      near(rig.toe[i], 4);
      near(rig.knee[i], 6);
      near(rig.hand[i], 3);
    }
    near(rig.pelvis, 12);
    near(rig.chest, 12);
    near(rig.head, 8);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    a.shadow = { cx: n((lo + hi) / 2), cy: n(GROUND_Y + 0.4), rx: n((hi - lo) / 2 + 6), ry: "3.4" };
  }

  // Orden por profundidad (lejos -> cerca). Empates: orden estable de inserción.
  const order = depth
    .map((d, i) => ({ k: d[0], d: d[1], i }))
    .sort((x, y) => x.d - y.d || x.i - y.i)
    .map((x) => x.k);
  return { a, order };
}

// ───────────────────────── Cabeza ─────────────────────────

function drawHead(a: Record<string, Attrs>, rig: Rig, cam: Cam, look: Look, opts: DrawOpts, depth: Array<[PartKey, number]>): void {
  const F = rig.hF;
  const U = rig.hU;
  const L = rig.hL;
  const [rf, ru, rl] = look.head;
  const sc = madd(rig.head, U, 0.6);
  const surf = (b: number, e: number, k = 1): V3 => {
    const cb = Math.cos(b * RAD);
    const sb = Math.sin(b * RAD);
    const ce = Math.cos(e * RAD);
    const se = Math.sin(e * RAD);
    return add(sc, add(add(mul(F, rf * ce * cb * k), mul(U, ru * se * k)), mul(L, rl * ce * sb * k)));
  };
  const normal = (b: number, e: number): V3 => {
    const cb = Math.cos(b * RAD);
    const sb = Math.sin(b * RAD);
    const ce = Math.cos(e * RAD);
    const se = Math.sin(e * RAD);
    return unit(add(add(mul(F, (ce * cb) / rf), mul(U, se / ru)), mul(L, (ce * sb) / rl)));
  };
  const tanH = (b: number): V3 => unit(add(mul(F, -Math.sin(b * RAD)), mul(L, Math.cos(b * RAD))));
  const facing = (b: number, e: number): number => dv(cam, normal(b, e));
  const P2of = (p: V3): P2 => pj(cam, p);

  const skull = projEll(cam, sc, mul(F, rf), mul(U, ru), mul(L, rl));
  a.hSkull = ellAttrs(skull);
  a.hShine = {
    cx: n(skull.c.x - skull.rx * 0.28),
    cy: n(skull.c.y - skull.ry * 0.55),
    rx: "2.4",
    ry: "1.3",
    transform: `rotate(-28 ${n(skull.c.x - skull.rx * 0.28)} ${n(skull.c.y - skull.ry * 0.55)})`,
  };

  const [jf, ju, jrf, jru, jrl] = look.jaw;
  const jc = madd(madd(rig.head, F, jf), U, -ju);
  a.hJaw = ellAttrs(projEll(cam, jc, mul(F, jrf), mul(U, jru), mul(L, jrl)));

  // Orejas
  for (const i of [0, 1] as const) {
    const b = i === 0 ? 96 : -96;
    const c = surf(b, -6, 1.03);
    a[`hEar${i}`] = {
      d: discD(P2of(c), pv(cam, mul(U, 2.5)), pv(cam, mul(tanH(b), 1.5))),
      opacity: n(smooth(-0.4, -0.12, facing(b, -6))),
    };
  }
  // Ojos y cejas
  const [ew, eh] = look.eye;
  for (const i of [0, 1] as const) {
    const b = i === 0 ? 33 : -33;
    const fe = facing(b, 7);
    a[`hEye${i}`] = {
      d: discD(P2of(surf(b, 7, 1.0)), pv(cam, mul(tanH(b), ew)), pv(cam, mul(U, eh))),
      opacity: n(smooth(0.02, 0.2, fe)),
    };
    const bb = i === 0 ? 30 : -30;
    a[`hBrow${i}`] = {
      d: discD(P2of(surf(bb, 23, 1.02)), pv(cam, mul(tanH(bb), 2.5)), pv(cam, mul(U, look.beard ? 0.85 : 0.6))),
      opacity: n(smooth(0.0, 0.18, facing(bb, 23))),
    };
  }
  // Nariz: triángulo en el plano medio de la cara (perfil: sobresale; de frente: una línea sugerida)
  {
    const bridge = surf(0, 9, 0.99);
    const tip = madd(surf(0, -7, 1.0), F, 2.3);
    const base = surf(0, -17, 0.98);
    const vis = smooth(-0.15, 0.1, facing(0, -5));
    a.hNose = { d: `M${pt(P2of(bridge))}L${pt(P2of(tip))}L${pt(P2of(base))}Z`, opacity: n(vis) };
  }
  // Boca (sobre la mandíbula / barba)
  {
    const be = 12 * RAD;
    const mc = add(jc, add(mul(F, jrf * Math.cos(be) * 1.0), mul(U, jru * Math.sin(be))));
    const nrm = unit(add(mul(F, Math.cos(be) / jrf), mul(U, Math.sin(be) / jru)));
    a.hMouth = {
      d: discD(P2of(mc), pv(cam, mul(L, look.beard ? 2.1 : 1.9)), pv(cam, mul(U, look.beard ? 0.75 : 0.62))),
      opacity: n(smooth(0.0, 0.2, dv(cam, nrm))),
    };
  }

  // Pelo (princess): masa trasera, casquete recortado por el nacimiento del pelo, rizos y coleta
  if (look.hair) {
    const back = projEll(cam, madd(madd(sc, U, 1.3), F, -1.6), mul(F, rf + 1.5), mul(U, ru + 1.3), mul(L, rl + 1.6));
    a.hBack = { d: bumpyD(back, 14, 0.85, 0.2) };
    const cap = projEll(cam, madd(madd(sc, U, 0.5), F, -0.25), mul(F, rf + 0.9), mul(U, ru + 1.0), mul(L, rl + 0.95));
    a.hCap = { d: bumpyD(cap, 16, 0.55) };
    const V = v3(cam.s, 0, cam.c);
    const psi = Math.atan2(V.x * L.x + V.y * L.y + V.z * L.z, V.x * F.x + V.y * F.y + V.z * F.z) / RAD;
    const line: P2[] = [];
    const hl = (b: number): number => 9 + 31 * Math.cos(b * RAD);
    for (let k = 0; k <= 12; k++) {
      const b = psi - 90 + (180 * k) / 12;
      line.push(P2of(surf(b, hl(b), 1.02)));
    }
    let u2 = pv(cam, U);
    const ul = plen(u2);
    u2 = ul < 0.05 ? P(0, -1) : P(u2.x / ul, u2.y / ul);
    const first = line[0] as P2;
    const last = line[line.length - 1] as P2;
    a.hClip = {
      d: `M${line.map(pt).join("L")}L${pt(padd(last, u2, 40))}L${pt(padd(first, u2, 40))}Z`,
    };
    let curls = "";
    for (const b of [-62, -34, -8, 16, 40, 64]) {
      if (Math.abs(b - psi) > 88 || facing(b, hl(b)) < 0.05) continue;
      curls += circleSub(P2of(surf(b, hl(b) - 1.5, 1.04)), 1.55);
    }
    a.hCurls = { d: curls || "M0 0" };

    // Coleta: cuelga de la parte alta de la nuca, con inercia (sway)
    const G = v3(0, 1, 0);
    const bk = mul(F, -1);
    const sw = opts.sway;
    const p0 = surf(180, 34, 1.04);
    const p1 = add(madd(p0, unit(add(add(mul(bk, 0.9), mul(G, 0.25)), mul(U, 0.25))), 4.6), mul(sw, 0.25));
    const p2 = add(madd(p1, unit(add(mul(bk, 0.4), G)), 6.4), mul(sw, 0.55));
    const p3 = add(madd(p2, unit(add(mul(bk, 0.15), G)), 6.4), mul(sw, 1.0));
    const p4 = add(madd(p3, G, 4.4), mul(sw, 1.35));
    const radii = [2.4, 4.3, 4.9, 4.0, 2.0];
    const pts3 = [p0, p1, p2, p3, p4].map((p, i) => {
      const r = radii[i] as number;
      return p.y > GROUND_Y - r ? v3(p.x, GROUND_Y - r, p.z) : p;
    });
    const pts = pts3.map(P2of);
    a.tail = { d: polyTubeD(pts, radii) };
    let tc = "";
    for (const [i, f, side] of [
      [1, 0.4, 1],
      [2, 0.0, -1],
      [2, 0.7, 1],
      [3, 0.3, -1],
    ] as const) {
      const A = pts[i] as P2;
      const B = pts[i + 1] as P2;
      const c = P(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f);
      const { nn } = frameOf(A, B);
      const cc = padd(c, nn, side * 1.6);
      tc += `M${pt(padd(cc, nn, -1.3))}a1.3 1.3 0 1 ${side > 0 ? 1 : 0} ${n(nn.x * 2.6)} ${n(nn.y * 2.6)}`;
    }
    a.tailC = { d: tc };
    const t01 = frameOf(pts[0] as P2, pts[1] as P2);
    a.tailTie = { d: discD(pts[0] as P2, P(t01.t.x * 1.3, t01.t.y * 1.3), P(t01.nn.x * 2.7, t01.nn.y * 2.7)) };
    depth.push(["tail", dp(cam, p0) - 2.2]);
  } else {
    depth.push(["tail", -999]);
  }

  depth.push(["head", dp(cam, rig.head) + 0.8]);
}

/** Desplazamiento inercial de la coleta a partir del movimiento de la cabeza (lienzo/ciclo). */
export function swayFrom(prevHead: V3, head: V3, gain: number): V3 {
  const d = sub(prevHead, head);
  const l = len(d);
  if (l < 1e-6) return v3(0, 0, 0);
  const m = Math.min(5, l * gain);
  return mul(d, m / l);
}

export { mid as mid3 };
