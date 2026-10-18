/**
 * Cinemática directa 2D para las figuras de ejercicios ("Lotería de Hierro").
 *
 * Vista lateral, la figura MIRA A LA DERECHA (+x). viewBox 0 0 200 200, suelo en y = 170.
 *
 * Convención de ángulos (grados): se miden desde la vertical hacia arriba.
 *    0 = arriba · +90 = adelante (derecha) · 180 = abajo · -90 = atrás (izquierda)
 *
 * Cada ángulo es la dirección del hueso desde su articulación proximal hacia la distal, EXCEPTO la
 * cadena de la pierna, que cuelga del tobillo cuando la figura está de pie:
 *    shin  = dirección tobillo -> rodilla
 *    thigh = dirección rodilla -> cadera
 *    torso = dirección cadera -> hombro
 *    neck  = dirección hombro -> centro de la cabeza
 *    upperArm = hombro -> codo · foreArm = codo -> mano (agarre)
 * Estos significados valen igual con cualquier ancla (tobillo, cadera, hombro, mano...): cambiar el
 * ancla solo traslada la figura, no cambia lo que significa cada ángulo.
 *
 * Las longitudes de hueso son CONSTANTES: la animación interpola ÁNGULOS (camino corto), nunca
 * posiciones, de modo que las extremidades no se estiran.
 */

// ───────────────────────── Constantes de geometría ─────────────────────────

export const VIEW = 200;
export const GROUND_Y = 170;

export const BONE = {
  shin: 32,
  thigh: 34,
  torso: 38,
  neck: 14,
  upperArm: 23,
  foreArm: 21,
  /** Talón y puntera medidos desde el tobillo a lo largo del pie. */
  heel: 6,
  toe: 15,
} as const;

/** Radio de la cabeza. */
export const HEAD_R = 8.5;
/** Altura del tobillo sobre el suelo con el pie plano (mitad del trazo del pie). */
export const ANKLE_H = 5.5;

/** Geometría de la kettlebell en coordenadas locales (agarre en el origen, cuerpo hacia +y). */
export const BELL = {
  r: 9.5,
  hang: 20,
  postX: 6.2,
} as const;

// ───────────────────────── Tipos ─────────────────────────

export type BellAt = "hand" | "hand2" | "both" | "pair" | "none";

export interface BellSpec {
  /**
   * 'hand' = en la mano cercana · 'hand2' = en la mano lejana · 'both' = una pesa a dos manos
   * (se agarra en `hand`) · 'pair' = una pesa en cada mano · 'none' = sin pesa.
   */
  at: BellAt;
  /** Distancia en px desde el agarre al centro del cuerpo de la pesa (por defecto 20). */
  hang?: number;
  /** Escala de la pesa (1 = normal). */
  size?: number;
  /** Dirección absoluta del cuerpo respecto al agarre. Si falta: dirección del antebrazo + rel. */
  ang?: number;
  /** Ángulo relativo a la dirección del antebrazo (solo si no hay `ang`). Por defecto 0. */
  rel?: number;
  /** true = la pesa pasa por detrás del cuerpo/cabeza (profundidad: halo, pesa en la mano lejana). */
  back?: boolean;
  /**
   * 3D: inclinación lateral (grados) de la dirección del cuerpo de la pesa, hacia FUERA del lado de la
   * mano que la sostiene (en 'both', + = hacia el lado derecho/cercano). Rack: ~30 (descansa por fuera
   * del antebrazo). Por defecto 0.
   */
  tilt?: number;
  /**
   * 3D: orientación del asa (grados alrededor de la vertical): 0 = la barra del asa apunta hacia delante
   * (agarre neutro, se ve la ventana del asa de lado) · 90 = barra lateral (agarre a dos manos).
   * Por defecto: 90 en 'both', 20 en el resto.
   */
  bar?: number;
}

/**
 * Parámetros laterales (eje z) de una pose. Todos opcionales: los valores por defecto reproducen una
 * postura natural (pies bajo las caderas, brazos al costado). Unidades del lienzo, medidas desde la
 * línea media del cuerpo y HACIA FUERA del lado de cada miembro (el 1 = derecho/cercano, el 2 =
 * izquierdo/lejano); los ángulos en grados.
 */
export interface Lateral {
  /** Tobillo principal: distancia lateral a la línea media (ancho de postura). */
  stance?: number;
  /** Segundo tobillo (por defecto = stance). */
  stance2?: number;
  /** Apertura de rodillas: gira el plano de flexión de la rodilla hacia fuera (grados). */
  kneeOut?: number;
  /** Apertura de las punteras (grados). */
  toeOut?: number;
  /** Mano principal: posición lateral (agarre a dos manos ~2.8; brazo al costado ~15.5). */
  handZ?: number;
  handZ2?: number;
  /** Codo: gira el plano de flexión del brazo hacia fuera (+) o hacia dentro (−), en grados. */
  elbowOut?: number;
  elbowOut2?: number;
  /** Giro del tronco entero alrededor de la columna (+ = el pecho gira hacia el lado derecho). */
  roll?: number;
  /** Giro de la parte superior (pecho, brazos, cabeza) alrededor de la vertical por la pelvis. */
  twist?: number;
  /** Giro de la cabeza (+ = la cara mira hacia el lado derecho). */
  headYaw?: number;
  /**
   * 0 = la mano sigue al hombro 3D (brazo dado por ángulos: con roll, el brazo vertical sigue vertical
   * sobre el hombro) · 1 = la mano queda en su posición absoluta de la pose (mano apoyada en el suelo).
   */
  handFix?: number;
  handFix2?: number;
}

export type FullLateral = Required<Lateral>;

export type AnchorJoint = "ankle" | "ankle2" | "knee" | "hip" | "shoulder" | "head" | "hand" | "hand2";

/** Dónde queda fijada la figura en el lienzo: la articulación `at` se coloca en (x, y). */
export interface Anchor {
  at: AnchorJoint;
  x: number;
  y: number;
}

export interface Pose {
  /** Pierna principal (cercana). */
  shin: number;
  thigh: number;
  torso: number;
  neck?: number;
  /** Dirección hacia la que mira la cara (por defecto: perpendicular al cuello, hacia delante). */
  gaze?: number;
  upperArm: number;
  foreArm: number;
  /** Pierna libre / segunda pierna (si falta: igual que la principal). */
  shin2?: number;
  thigh2?: number;
  /** Dirección talón -> puntera del pie. 90 = pie plano apuntando adelante. */
  foot?: number;
  foot2?: number;
  /** Brazo libre / segundo brazo (si falta: igual que el primero). */
  upperArm2?: number;
  foreArm2?: number;
  /** true = el segundo brazo se dibuja opaco, delante del torso (por defecto va detrás, atenuado). */
  front2?: boolean;
  bell: BellSpec;
  /** Ancla. Por defecto: tobillo en DEFAULT_ANKLE (pies fijos al suelo). */
  root?: Anchor;
  /** Parámetros laterales para la vista 3D (frente / tres cuartos). */
  lat?: Lateral;
}

export interface FullPose {
  shin: number;
  thigh: number;
  shin2: number;
  thigh2: number;
  foot: number;
  foot2: number;
  torso: number;
  neck: number;
  gaze: number;
  upperArm: number;
  foreArm: number;
  upperArm2: number;
  foreArm2: number;
  bell: {
    at: BellAt;
    hang: number;
    size: number;
    ang: number | null;
    rel: number;
    back: boolean;
    tilt: number;
    bar: number;
  };
  root: Anchor;
  lat: FullLateral;
}

/** Mano colgando al costado del muslo (posición lateral por defecto). */
export const HAND_Z_SIDE = 15.5;
/** Mano en el asa de una pesa agarrada a dos manos. */
export const HAND_Z_BOTH = 2.8;

function resolveLateral(p: Pose): FullLateral {
  const l = p.lat ?? {};
  const both = p.bell.at === "both";
  const stance = l.stance ?? 8;
  return {
    stance,
    stance2: l.stance2 ?? stance,
    kneeOut: l.kneeOut ?? 0,
    toeOut: l.toeOut ?? 10,
    handZ: l.handZ ?? (both ? HAND_Z_BOTH : HAND_Z_SIDE),
    handZ2: l.handZ2 ?? (both ? HAND_Z_BOTH : HAND_Z_SIDE),
    elbowOut: l.elbowOut ?? 0,
    elbowOut2: l.elbowOut2 ?? 0,
    roll: l.roll ?? 0,
    twist: l.twist ?? 0,
    headYaw: l.headYaw ?? 0,
    handFix: l.handFix ?? 0,
    handFix2: l.handFix2 ?? 0,
  };
}

export const DEFAULT_ANKLE: Anchor = { at: "ankle", x: 86, y: GROUND_Y - ANKLE_H };

export type Ease = "linear" | "in" | "out" | "inOut" | "sine" | "snap" | "hold";

export interface Keyframe {
  /** Tiempo dentro del ciclo (0..1). */
  t: number;
  pose: Pose;
  /** Easing del tramo que empieza en este keyframe. */
  ease?: Ease;
}

export interface Animation {
  /** Segundos que dura una repetición completa por defecto. */
  cycleSec: number;
  /**
   * 'pingpong': los keyframes describen la mitad "de ida" y la repetición es ida + vuelta.
   * 'cycle': los keyframes describen la repetición entera y se cierra sola sobre el primero.
   */
  loop: "pingpong" | "cycle";
  keys: Keyframe[];
  /** Easing por defecto de los tramos (si el keyframe no define uno). */
  ease?: Ease;
  /** Tiempo-de-keyframe (0..1) de la pose más representativa (movimiento reducido / miniaturas). */
  still: number;
  /**
   * Para caminatas: px que se desplaza el suelo hacia atrás durante un ciclo completo
   * (la figura camina "en el sitio" sobre una cinta; las marcas del suelo corren).
   */
  travel?: number;
}

// ───────────────────────── Matemática básica ─────────────────────────

const RAD = Math.PI / 180;

export const dirX = (a: number): number => Math.sin(a * RAD);
export const dirY = (a: number): number => -Math.cos(a * RAD);

/** Interpolación angular por el camino corto. */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const EASES: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  snap: (t) => 1 - Math.pow(1 - t, 3),
  hold: (t) => (t < 1 ? 0 : 1),
};

// ───────────────────────── Resolución de poses ─────────────────────────

export function resolvePose(p: Pose): FullPose {
  return {
    shin: p.shin,
    thigh: p.thigh,
    shin2: p.shin2 ?? p.shin,
    thigh2: p.thigh2 ?? p.thigh,
    foot: p.foot ?? 90,
    foot2: p.foot2 ?? p.foot ?? 90,
    torso: p.torso,
    neck: p.neck ?? p.torso,
    gaze: p.gaze ?? (p.neck ?? p.torso) + 90,
    upperArm: p.upperArm,
    foreArm: p.foreArm,
    upperArm2: p.upperArm2 ?? p.upperArm,
    foreArm2: p.foreArm2 ?? p.foreArm,
    bell: {
      at: p.bell.at,
      hang: p.bell.hang ?? BELL.hang,
      size: p.bell.size ?? 1,
      ang: p.bell.ang ?? null,
      rel: p.bell.rel ?? 0,
      back: p.bell.back ?? false,
      tilt: p.bell.tilt ?? 0,
      bar: p.bell.bar ?? (p.bell.at === "both" ? 90 : 20),
    },
    root: p.root ?? DEFAULT_ANKLE,
    lat: resolveLateral(p),
  };
}

// ───────────────────────── Cinemática directa ─────────────────────────

export interface Pt {
  x: number;
  y: number;
}

export interface BellInstance {
  grip: Pt;
  /** Dirección del cuerpo respecto al agarre (grados). */
  ang: number;
  size: number;
  hang: number;
  /** true = pesa de la mano lejana en modo 'pair' (se dibuja detrás). */
  far: boolean;
}

export interface Skeleton {
  hip: Pt;
  shoulder: Pt;
  head: Pt;
  /** Dirección hacia la que mira la cara (para la nariz). */
  face: number;
  knee: Pt;
  ankle: Pt;
  heel: Pt;
  toe: Pt;
  knee2: Pt;
  ankle2: Pt;
  heel2: Pt;
  toe2: Pt;
  elbow: Pt;
  hand: Pt;
  elbow2: Pt;
  hand2: Pt;
  bells: BellInstance[];
}

const pt = (x: number, y: number): Pt => ({ x, y });

function at(base: Pt, len: number, ang: number): Pt {
  return pt(base.x + len * dirX(ang), base.y + len * dirY(ang));
}

/** Posición de la articulación `joint` con la cadera en el origen. */
function relJoint(p: FullPose, joint: AnchorJoint): Pt {
  const hip = pt(0, 0);
  switch (joint) {
    case "hip":
      return hip;
    case "knee":
      return at(hip, -BONE.thigh, p.thigh);
    case "ankle":
      return at(at(hip, -BONE.thigh, p.thigh), -BONE.shin, p.shin);
    case "ankle2":
      return at(at(hip, -BONE.thigh, p.thigh2), -BONE.shin, p.shin2);
    case "shoulder":
      return at(hip, BONE.torso, p.torso);
    case "head":
      return at(at(hip, BONE.torso, p.torso), BONE.neck, p.neck);
    case "hand": {
      const s = at(hip, BONE.torso, p.torso);
      return at(at(s, BONE.upperArm, p.upperArm), BONE.foreArm, p.foreArm);
    }
    case "hand2": {
      const s = at(hip, BONE.torso, p.torso);
      return at(at(s, BONE.upperArm, p.upperArm2), BONE.foreArm, p.foreArm2);
    }
  }
}

/** Posición absoluta de la cadera según el ancla de la pose. */
export function hipPosition(p: FullPose): Pt {
  const r = relJoint(p, p.root.at);
  return pt(p.root.x - r.x, p.root.y - r.y);
}

export function bellAngle(p: FullPose): number {
  if (p.bell.ang !== null) return p.bell.ang;
  const fa = p.bell.at === "hand2" ? p.foreArm2 : p.foreArm;
  return fa + p.bell.rel;
}

export function solve(p: FullPose): Skeleton {
  const hip = hipPosition(p);
  const knee = at(hip, -BONE.thigh, p.thigh);
  const ankle = at(knee, -BONE.shin, p.shin);
  const knee2 = at(hip, -BONE.thigh, p.thigh2);
  const ankle2 = at(knee2, -BONE.shin, p.shin2);
  const shoulder = at(hip, BONE.torso, p.torso);
  const head = at(shoulder, BONE.neck, p.neck);
  const elbow = at(shoulder, BONE.upperArm, p.upperArm);
  const hand = at(elbow, BONE.foreArm, p.foreArm);
  const elbow2 = at(shoulder, BONE.upperArm, p.upperArm2);
  const hand2 = at(elbow2, BONE.foreArm, p.foreArm2);

  const bells: BellInstance[] = [];
  const b = p.bell;
  if (b.at === "hand" || b.at === "both" || b.at === "pair") {
    bells.push({ grip: hand, ang: bellAngle(p), size: b.size, hang: b.hang, far: b.back });
  }
  if (b.at === "hand2") {
    bells.push({ grip: hand2, ang: bellAngle(p), size: b.size, hang: b.hang, far: b.back });
  }
  if (b.at === "pair") {
    bells.push({ grip: hand2, ang: p.bell.ang ?? p.foreArm2 + b.rel, size: b.size, hang: b.hang, far: true });
  }

  return {
    hip,
    shoulder,
    head,
    face: p.gaze,
    knee,
    ankle,
    heel: at(ankle, -BONE.heel, p.foot),
    toe: at(ankle, BONE.toe, p.foot),
    knee2,
    ankle2,
    heel2: at(ankle2, -BONE.heel, p.foot2),
    toe2: at(ankle2, BONE.toe, p.foot2),
    elbow,
    hand,
    elbow2,
    hand2,
    bells,
  };
}

// ───────────────────────── Interpolación de poses ─────────────────────────

const ANGLE_KEYS = [
  "shin",
  "thigh",
  "shin2",
  "thigh2",
  "foot",
  "foot2",
  "torso",
  "neck",
  "gaze",
  "upperArm",
  "foreArm",
  "upperArm2",
  "foreArm2",
] as const;

export function lerpPose(a: FullPose, b: FullPose, t: number): FullPose {
  if (t <= 0) return a;
  if (t >= 1) return b;

  // Anclas distintas -> se mezcla la posición de la cadera (lo único común a ambas).
  let root: Anchor;
  if (a.root.at === b.root.at) {
    root = { at: a.root.at, x: lerp(a.root.x, b.root.x, t), y: lerp(a.root.y, b.root.y, t) };
  } else {
    const ha = hipPosition(a);
    const hb = hipPosition(b);
    root = { at: "hip", x: lerp(ha.x, hb.x, t), y: lerp(ha.y, hb.y, t) };
  }

  const out = { root } as FullPose;
  for (const k of ANGLE_KEYS) out[k] = lerpAngle(a[k], b[k], t);

  let ang: number | null = null;
  if (a.bell.ang !== null || b.bell.ang !== null) {
    ang = lerpAngle(bellAngle(a), bellAngle(b), t);
  }
  out.bell = {
    at: t < 0.5 ? a.bell.at : b.bell.at,
    hang: lerp(a.bell.hang, b.bell.hang, t),
    size: lerp(a.bell.size, b.bell.size, t),
    ang,
    rel: lerpAngle(a.bell.rel, b.bell.rel, t),
    back: t < 0.5 ? a.bell.back : b.bell.back,
    tilt: lerp(a.bell.tilt, b.bell.tilt, t),
    bar: lerp(a.bell.bar, b.bell.bar, t),
  };
  const la = a.lat;
  const lb = b.lat;
  out.lat = {
    stance: lerp(la.stance, lb.stance, t),
    stance2: lerp(la.stance2, lb.stance2, t),
    kneeOut: lerp(la.kneeOut, lb.kneeOut, t),
    toeOut: lerp(la.toeOut, lb.toeOut, t),
    handZ: lerp(la.handZ, lb.handZ, t),
    handZ2: lerp(la.handZ2, lb.handZ2, t),
    elbowOut: lerp(la.elbowOut, lb.elbowOut, t),
    elbowOut2: lerp(la.elbowOut2, lb.elbowOut2, t),
    roll: lerp(la.roll, lb.roll, t),
    twist: lerp(la.twist, lb.twist, t),
    headYaw: lerp(la.headYaw, lb.headYaw, t),
    handFix: lerp(la.handFix, lb.handFix, t),
    handFix2: lerp(la.handFix2, lb.handFix2, t),
  };
  return out;
}

// ───────────────────────── Animaciones ─────────────────────────

interface CompiledKey {
  t: number;
  pose: FullPose;
  ease: Ease;
}

const compiled = new WeakMap<Animation, CompiledKey[]>();

function compile(anim: Animation): CompiledKey[] {
  const hit = compiled.get(anim);
  if (hit) return hit;
  const keys: CompiledKey[] = [...anim.keys]
    .sort((x, y) => x.t - y.t)
    .map((k) => ({ t: k.t, pose: resolvePose(k.pose), ease: k.ease ?? anim.ease ?? "inOut" }));
  const first = keys[0];
  if (!first) throw new Error("Animation sin keyframes");
  if (first.t > 0) keys.unshift({ t: 0, pose: first.pose, ease: first.ease });
  const last = keys[keys.length - 1] as CompiledKey;
  if (last.t < 1) {
    keys.push({ t: 1, pose: anim.loop === "cycle" ? (keys[0] as CompiledKey).pose : last.pose, ease: last.ease });
  }
  compiled.set(anim, keys);
  return keys;
}

/** Pose en un instante del tiempo-de-keyframe (0..1), sin tener en cuenta ida/vuelta. */
export function sampleKeyTime(anim: Animation, kt: number): FullPose {
  const keys = compile(anim);
  const x = Math.min(1, Math.max(0, kt));
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i] as CompiledKey;
    const k1 = keys[i + 1] as CompiledKey;
    if (x <= k1.t || i === keys.length - 2) {
      const span = k1.t - k0.t;
      const u = span <= 0 ? 1 : Math.min(1, Math.max(0, (x - k0.t) / span));
      return lerpPose(k0.pose, k1.pose, EASES[k0.ease](u));
    }
  }
  return (keys[0] as CompiledKey).pose;
}

/** Convierte la fase del ciclo (0..1, una repetición completa) en tiempo-de-keyframe. */
export function phaseToKeyTime(anim: Animation, phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (anim.loop === "pingpong") return p < 0.5 ? p * 2 : (1 - p) * 2;
  return p;
}

/** Fase del ciclo en la que se ve la pose representativa. */
export function stillPhase(anim: Animation): number {
  return anim.loop === "pingpong" ? anim.still / 2 : anim.still;
}

export function samplePhase(anim: Animation, phase: number): FullPose {
  return sampleKeyTime(anim, phaseToKeyTime(anim, phase));
}

// ───────────────────────── Encuadre automático ─────────────────────────

export interface Framing {
  /** Escala uniforme (anclada al suelo). */
  s: number;
  tx: number;
  ty: number;
}

const framings = new WeakMap<Animation, Framing>();

/**
 * Cámara fija por animación: encuadra TODO el recorrido (incluida la pesa) para que la figura llene
 * la carta sin salirse del lienzo en ningún momento del ciclo. La cámara no se mueve durante la animación.
 */
export function framingOf(anim: Animation): Framing {
  const hit = framings.get(anim);
  if (hit) return hit;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const s = solve(samplePhase(anim, i / steps));
    const pts: Array<[Pt, number]> = [
      [s.heel, 5.5],
      [s.toe, 5.5],
      [s.heel2, 5.5],
      [s.toe2, 5.5],
      [s.knee, 6.5],
      [s.knee2, 6.5],
      [s.hip, 7.5],
      [s.shoulder, 7.5],
      [s.head, 9],
      [s.elbow, 5.5],
      [s.hand, 6],
      [s.elbow2, 5.5],
      [s.hand2, 6],
    ];
    for (const b of s.bells) {
      pts.push([
        { x: b.grip.x + b.hang * b.size * dirX(b.ang), y: b.grip.y + b.hang * b.size * dirY(b.ang) },
        (BELL.r + 2) * b.size,
      ]);
      pts.push([b.grip, 5]);
    }
    for (const [p, r] of pts) {
      minX = Math.min(minX, p.x - r);
      maxX = Math.max(maxX, p.x + r);
      minY = Math.min(minY, p.y - r);
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, GROUND_Y + 2 - minY);
  const sc = Math.min(1.5, 172 / w, 160 / h);
  const cx = (minX + maxX) / 2;
  const f: Framing = { s: sc, tx: 100 - sc * cx, ty: GROUND_Y * (1 - sc) };
  framings.set(anim, f);
  return f;
}

// ───────────────────────── Ayudas de autoría (IK 2D) ─────────────────────────
// Se usan SOLO al escribir poses: devuelven ángulos; la animación sigue interpolando ángulos.

export type V2 = readonly [number, number];

const deg = (r: number): number => r / RAD;

/** Ángulo (desde la vertical, + = derecha) del vector (dx, up). */
export function angleOf(dx: number, up: number): number {
  return deg(Math.atan2(dx, up));
}

/**
 * Ley de cosenos para dos huesos l1 (proximal) y l2 desde un origen hasta un objetivo a (dx, up).
 * Devuelve la dirección del primer hueso y la del segundo. `side` = +1 pone la articulación
 * intermedia girada en sentido horario (hacia la derecha/abajo) respecto a la línea al objetivo.
 */
function twoBone(l1: number, l2: number, dx: number, up: number, side: 1 | -1): [number, number] {
  const d = Math.hypot(dx, up);
  const base = angleOf(dx, up);
  const reach = l1 + l2 - 0.001;
  if (d >= reach) return [base, base];
  const dd = Math.max(d, Math.abs(l1 - l2) + 0.001);
  const cosA = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd);
  const A = deg(Math.acos(Math.min(1, Math.max(-1, cosA))));
  const a1 = base + side * A;
  const mx = l1 * dirX(a1);
  const my = -l1 * dirY(a1); // "up" de la articulación intermedia
  const a2 = angleOf(dx - mx, up - my);
  return [a1, a2];
}

/**
 * Pierna: dado el vector tobillo -> cadera (adelante, arriba), devuelve {shin, thigh}.
 * knee = +1 rodilla hacia adelante (normal) · -1 hacia atrás.
 */
export function legIK(hipFromAnkle: V2, knee: 1 | -1 = 1): { shin: number; thigh: number } {
  const [dx, up] = hipFromAnkle;
  const [shin, kneeToHipFromAnkle] = twoBone(BONE.shin, BONE.thigh, dx, up, knee);
  // twoBone devuelve la dirección del 2º hueso medida de rodilla a cadera: justo el "thigh".
  return { shin, thigh: kneeToHipFromAnkle };
}

/** Brazo: dado el vector hombro -> mano (adelante, arriba), devuelve {upperArm, foreArm}. */
export function armIK(handFromShoulder: V2, side: 1 | -1 = 1): { upperArm: number; foreArm: number } {
  const [dx, up] = handFromShoulder;
  const [upperArm, foreArm] = twoBone(BONE.upperArm, BONE.foreArm, dx, up, side);
  return { upperArm, foreArm };
}
