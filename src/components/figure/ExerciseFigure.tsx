"use client";

/**
 * <ExerciseFigure /> — figura animada de un ejercicio ("Lotería de Hierro": tinta plana, trazo grueso
 * con terminaciones redondeadas, sin degradados).
 *
 * Rendimiento: React pinta el SVG UNA vez (en la pose representativa, que además es lo que ve el SSR
 * y quien prefiere movimiento reducido). Después un único ticker global (requestAnimationFrame)
 * muta los atributos de los nodos por referencia: cero renders de React por fotograma. El ticker se
 * detiene solo cuando no hay figuras activas, y cada figura se salta los fotogramas si la pestaña
 * está oculta o ella no está en pantalla.
 */

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import type { ExerciseId } from "@/lib/engine/types";
import { ANIMATIONS, FIGURE_LABEL_ES } from "./poses";
import {
  BELL,
  HEAD_R,
  dirX,
  dirY,
  framingOf,
  samplePhase,
  solve,
  stillPhase,
  type Animation,
  type FullPose,
  type Pt,
  type Skeleton,
} from "./skeleton";

export interface ExerciseFigureProps {
  exerciseId: ExerciseId;
  /** Color de la tinta (trazo de cuerpo, asa y contorno de la pesa). */
  ink?: string;
  /** Color de la pesa. */
  accent?: string;
  /** Color de los detalles de ropa (bandas, brillo de la pesa). */
  paper?: string;
  /** Segundos por repetición. Por defecto, el `cycleSec` de la animación. */
  repSec?: number;
  /** false = congela la figura en el fotograma actual. Por defecto true. */
  playing?: boolean;
  /** Dibuja el suelo (línea + marcas). */
  showGround?: boolean;
  /** Texto accesible (nombre del ejercicio). Por defecto, un nombre corto en español. */
  label?: string;
  className?: string;
  /** Fase fija del ciclo (0..1): muestra ese fotograma y no anima. Útil para miniaturas. */
  phase?: number;
  /** Detalles de ropa en color papel (cinturilla, dobladillos, cinta). Por defecto true. */
  detail?: boolean;
}

// ───────────────────────── Geometría del dibujo ─────────────────────────

const W = {
  thigh: 13,
  shin: 11.5,
  foot: 9.5,
  upperArm: 10.5,
  foreArm: 9.5,
  neck: 7.5,
  handR: 4.9,
  far: 0.55,
};

type Attrs = Record<string, string>;
type Frame = Record<string, Attrs>;

const n = (v: number): string => String(Math.round(v * 100) / 100);

const seg = (a: Pt, b: Pt): Attrs => ({ x1: n(a.x), y1: n(a.y), x2: n(b.x), y2: n(b.y) });

/** Línea corta perpendicular a un hueso (dobladillo de la ropa). */
function cross(a: Pt, b: Pt, k: number, half: number): Attrs {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = a.x + dx * k;
  const cy = a.y + dy * k;
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  return { x1: n(cx - nx), y1: n(cy - ny), x2: n(cx + nx), y2: n(cy + ny) };
}

function bellAttrs(b: Skeleton["bells"][number] | undefined): { g: Attrs; handle: Attrs; body: Attrs; shine: Attrs } {
  if (!b) {
    return { g: { visibility: "hidden" }, handle: {}, body: {}, shine: {} };
  }
  const H = b.hang;
  const R = BELL.r;
  const px = BELL.postX;
  const yEnd = H - 6.5;
  const flat = R * 0.8;
  const half = Math.sqrt(R * R - flat * flat);
  return {
    g: {
      visibility: "visible",
      transform: `translate(${n(b.grip.x)} ${n(b.grip.y)}) rotate(${n(b.ang - 180)}) scale(${n(b.size)})`,
    },
    handle: {
      d: `M${-px} ${n(yEnd)}L${-px} 3Q${-px} 0.3 ${n(-px + 2.8)} 0.3L${n(px - 2.8)} 0.3Q${px} 0.3 ${px} 3L${px} ${n(yEnd)}`,
    },
    body: {
      d: `M${n(-half)} ${n(H + flat)}A${R} ${R} 0 1 1 ${n(half)} ${n(H + flat)}Z`,
    },
    shine: { cx: n(-R * 0.38), cy: n(H - R * 0.34) },
  };
}

function buildFrame(p: FullPose): Frame {
  const s = solve(p);
  const f: Frame = {};

  // Piernas (la 2ª va atenuada, detrás)
  f.thigh2 = seg(s.hip, s.knee2);
  f.shin2 = seg(s.knee2, s.ankle2);
  f.foot2 = seg(s.heel2, s.toe2);
  f.thigh = seg(s.hip, s.knee);
  f.shin = seg(s.knee, s.ankle);
  f.foot = seg(s.heel, s.toe);

  // Brazos
  f.upper2 = seg(s.shoulder, s.elbow2);
  f.fore2 = seg(s.elbow2, s.hand2);
  f.hand2 = { cx: n(s.hand2.x), cy: n(s.hand2.y) };
  f.upper = seg(s.shoulder, s.elbow);
  f.fore = seg(s.elbow, s.hand);
  f.hand = { cx: n(s.hand.x), cy: n(s.hand.y) };

  // Torso: trapecio con esquinas redondeadas (cintura más estrecha que el pecho)
  const ux = dirX(p.torso);
  const uy = dirY(p.torso);
  const nx = dirX(p.torso + 90);
  const ny = dirY(p.torso + 90);
  const bx = s.hip.x - ux * 3;
  const by = s.hip.y - uy * 3;
  const hf = 5.8;
  const hb = 5.8;
  const sf = 7.6;
  const sb = 6;
  f.torso = {
    d:
      `M${n(bx - nx * hb)} ${n(by - ny * hb)}` +
      `L${n(bx + nx * hf)} ${n(by + ny * hf)}` +
      `L${n(s.shoulder.x + nx * sf)} ${n(s.shoulder.y + ny * sf)}` +
      `L${n(s.shoulder.x - nx * sb)} ${n(s.shoulder.y - ny * sb)}Z`,
  };
  f.neck = seg(s.shoulder, s.head);

  // Cabeza
  f.head = { cx: n(s.head.x), cy: n(s.head.y) };
  f.nose = {
    cx: n(s.head.x + (HEAD_R + 0.3) * dirX(s.face)),
    cy: n(s.head.y + (HEAD_R + 0.3) * dirY(s.face)),
  };
  // Cinta en la frente: perpendicular al cuello, desplazada hacia la cara
  const hx = dirX(p.neck);
  const hy = dirY(p.neck);
  const fx = dirX(s.face);
  const fy = dirY(s.face);
  const off = 2.4;
  const bandHalf = Math.sqrt(HEAD_R * HEAD_R - off * off) - 0.4;
  const cx0 = s.head.x + hx * off;
  const cy0 = s.head.y + hy * off;
  f.band = {
    x1: n(cx0 - fx * bandHalf),
    y1: n(cy0 - fy * bandHalf),
    x2: n(cx0 + fx * bandHalf),
    y2: n(cy0 + fy * bandHalf),
  };

  // Detalles de ropa
  const wbx = s.hip.x + ux * 5;
  const wby = s.hip.y + uy * 5;
  f.waist = { x1: n(wbx - nx * 6.4), y1: n(wby - ny * 6.4), x2: n(wbx + nx * 6.4), y2: n(wby + ny * 6.4) };
  f.hem = cross(s.knee, s.hip, 0.38, 5.2);
  f.hem2 = cross(s.knee2, s.hip, 0.38, 5.2);
  f.sleeve = cross(s.shoulder, s.elbow, 0.62, 4.4);
  f.sleeve2 = cross(s.shoulder, s.elbow2, 0.62, 4.4);

  // Pesas
  const front = s.bells.find((b) => !b.far);
  const back = s.bells.find((b) => b.far);
  const bf = bellAttrs(front);
  const bb = bellAttrs(back);
  f.bellF = bf.g;
  f.bellFHandle = bf.handle;
  f.bellFHandleHalo = bf.handle;
  f.bellFBody = bf.body;
  f.bellFHalo = bf.body;
  f.bellFShine = bf.shine;
  f.bellB = bb.g;
  f.bellBHandle = bb.handle;
  f.bellBHandleHalo = bb.handle;
  f.bellBBody = bb.body;
  f.bellBHalo = bb.body;
  f.bellBShine = bb.shine;
  // Puño sobre el asa de la pesa delantera
  f.fist = front
    ? { cx: n(front.grip.x), cy: n(front.grip.y), visibility: "visible" }
    : { cx: "0", cy: "0", visibility: "hidden" };
  return f;
}

// ───────────────────────── Ticker global ─────────────────────────

type Tick = (now: number) => void;
const subscribers = new Set<Tick>();
let rafId = 0;

function loop(now: number): void {
  subscribers.forEach((fn) => fn(now));
  rafId = subscribers.size > 0 ? requestAnimationFrame(loop) : 0;
}

function subscribeTicker(fn: Tick): () => void {
  subscribers.add(fn);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}

// ───────────────────────── movimiento reducido ─────────────────────────

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(cb: () => void): () => void {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReduced = (): boolean => window.matchMedia(REDUCED_QUERY).matches;
const getReducedServer = (): boolean => false;

// ───────────────────────── Componente ─────────────────────────

interface NodeSlot {
  el: Element;
  last: Attrs;
}

function applyFrame(slots: Map<string, NodeSlot>, frame: Frame): void {
  for (const name in frame) {
    const slot = slots.get(name);
    const attrs = frame[name];
    if (!slot || !attrs) continue;
    for (const k in attrs) {
      const v = attrs[k] as string;
      if (slot.last[k] !== v) {
        slot.last[k] = v;
        slot.el.setAttribute(k, v);
      }
    }
  }
}

const GROUND_TICK_GAP = 22;

export function ExerciseFigure({
  exerciseId,
  ink = "#0b0e14",
  accent = "#f2432d",
  paper = "#f4f6fa",
  repSec,
  playing = true,
  showGround = false,
  label,
  className,
  phase,
  detail = true,
}: ExerciseFigureProps) {
  const anim: Animation = ANIMATIONS[exerciseId];
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = "fig" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getReducedServer);

  // Fase actual (persiste entre pausas). Empieza en la pose representativa.
  const phaseRef = useRef<{ id: ExerciseId; value: number }>({ id: exerciseId, value: stillPhase(anim) });
  if (phaseRef.current.id !== exerciseId) phaseRef.current = { id: exerciseId, value: stillPhase(anim) };

  const staticPhase = phase ?? stillPhase(anim);
  const staticPose = samplePhase(anim, staticPhase);
  const F = buildFrame(staticPose);
  const arm2Front = anim.keys.some((k) => k.pose.front2);
  const fr = framingOf(anim);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const slots = new Map<string, NodeSlot>();
    svg.querySelectorAll("[data-n]").forEach((el) => {
      slots.set(el.getAttribute("data-n") as string, { el, last: {} });
    });
    const groundTicks = svg.querySelector("[data-ground]");

    const draw = (ph: number): void => {
      applyFrame(slots, buildFrame(samplePhase(anim, ph)));
      if (groundTicks && anim.travel) {
        const off = (ph * anim.travel * fr.s) % GROUND_TICK_GAP;
        groundTicks.setAttribute("transform", `translate(${n(-off)} 0)`);
      }
    };

    // Fase fija (controlada por quien llama) o movimiento reducido: un solo dibujo.
    if (phase !== undefined) {
      draw(phase);
      return;
    }
    if (reduced) {
      draw(stillPhase(anim));
      return;
    }

    draw(phaseRef.current.value);
    if (!playing) return;

    let inView = true;
    let last = 0;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            const e = entries[entries.length - 1];
            if (e) inView = e.isIntersecting;
          })
        : null;
    io?.observe(svg);

    const dur = repSec && repSec > 0 ? repSec : anim.cycleSec;
    const unsub = subscribeTicker((now) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      if (document.hidden || !inView) return;
      phaseRef.current.value = (phaseRef.current.value + dt / dur) % 1;
      draw(phaseRef.current.value);
    });
    return () => {
      unsub();
      io?.disconnect();
    };
  }, [anim, exerciseId, fr, playing, reduced, repSec, phase]);

  const aria = label ?? `Figura animada: ${FIGURE_LABEL_ES[exerciseId]}`;
  const fx = (name: string): Attrs => F[name] ?? {};

  const limb = (name: string, w: number) => (
    <line data-n={name} {...fx(name)} stroke={ink} strokeWidth={w} strokeLinecap="round" />
  );
  const trim = (name: string, w = 2.3) => (
    <line data-n={name} {...fx(name)} stroke={paper} strokeWidth={w} strokeLinecap="butt" />
  );
  const bellNode = (suffix: "F" | "B") => (
    <g data-n={`bell${suffix}`} {...fx(`bell${suffix}`)}>
      {/* Corte de papel alrededor de la pesa: la separa del cuerpo (línea blanca de linograbado) */}
      <path
        data-n={`bell${suffix}HandleHalo`}
        {...fx(`bell${suffix}HandleHalo`)}
        fill="none"
        stroke={paper}
        strokeWidth={8.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        data-n={`bell${suffix}Halo`}
        {...fx(`bell${suffix}Halo`)}
        fill={paper}
        stroke={paper}
        strokeWidth={7}
        strokeLinejoin="round"
      />
      <path
        data-n={`bell${suffix}Handle`}
        {...fx(`bell${suffix}Handle`)}
        fill="none"
        stroke={ink}
        strokeWidth={4.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        data-n={`bell${suffix}Body`}
        {...fx(`bell${suffix}Body`)}
        fill={accent}
        stroke={ink}
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <ellipse
        data-n={`bell${suffix}Shine`}
        {...fx(`bell${suffix}Shine`)}
        rx={2}
        ry={3.4}
        transform="rotate(32)"
        fill={paper}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </g>
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      role="img"
      aria-label={aria}
      focusable="false"
      className={className}
      style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", display: "block", overflow: "visible" }}
    >
      {showGround ? (
        <g>
          <defs>
            <clipPath id={clipId}>
              <rect x={14} y={172} width={172} height={22} />
            </clipPath>
          </defs>
          <line x1={14} y1={170.5} x2={186} y2={170.5} stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
          <g clipPath={`url(#${clipId})`}>
            <g data-ground="">
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={i}
                  x1={14 + i * GROUND_TICK_GAP}
                  y1={176}
                  x2={14 + i * GROUND_TICK_GAP - 9}
                  y2={186}
                  stroke={ink}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  opacity={0.7}
                />
              ))}
            </g>
          </g>
        </g>
      ) : null}

      <g transform={`translate(${n(fr.tx)} ${n(fr.ty)}) scale(${n(fr.s)})`}>
      {/* Capa lejana: extremidades del lado opuesto, atenuadas */}
      <g opacity={W.far}>
        {limb("thigh2", W.thigh)}
        {limb("shin2", W.shin)}
        {limb("foot2", W.foot)}
        {detail ? trim("hem2") : null}
        {arm2Front ? null : (
          <>
            {limb("upper2", W.upperArm)}
            {limb("fore2", W.foreArm)}
            {detail ? trim("sleeve2", 2.2) : null}
            <circle data-n="hand2" {...fx("hand2")} r={W.handR} fill={ink} />
          </>
        )}
      </g>
      {bellNode("B")}

      {/* Tronco y cabeza */}
      <path data-n="torso" {...fx("torso")} fill={ink} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      {limb("neck", W.neck)}
      <circle data-n="head" {...fx("head")} r={HEAD_R} fill={ink} />
      <circle data-n="nose" {...fx("nose")} r={2.3} fill={ink} />
      {detail ? (
        <>
          {trim("band", 2.1)}
          {trim("waist", 2.4)}
        </>
      ) : null}

      {/* Pierna cercana */}
      {limb("thigh", W.thigh)}
      {limb("shin", W.shin)}
      {limb("foot", W.foot)}
      {detail ? trim("hem") : null}

      {/* Segundo brazo cuando va delante */}
      {arm2Front ? (
        <>
          {limb("upper2", W.upperArm)}
          {limb("fore2", W.foreArm)}
          {detail ? trim("sleeve2", 2.2) : null}
          <circle data-n="hand2" {...fx("hand2")} r={W.handR} fill={ink} />
        </>
      ) : null}

      {/* Brazo cercano */}
      {limb("upper", W.upperArm)}
      {limb("fore", W.foreArm)}
      {detail ? trim("sleeve", 2.2) : null}

      {bellNode("F")}
      <circle data-n="hand" {...fx("hand")} r={W.handR} fill={ink} />
      <circle data-n="fist" {...fx("fist")} r={W.handR} fill={ink} />
      </g>
    </svg>
  );
}

export default ExerciseFigure;

