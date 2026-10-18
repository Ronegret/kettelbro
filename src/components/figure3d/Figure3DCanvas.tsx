"use client";

/**
 * Parte con three.js de <Figure3D />: SOLO se carga bajo demanda (next/dynamic desde Figure3D.tsx).
 * Crea la FigureView, la conecta a tamaño, visibilidad, tinta del día y contexto WebGL, y le pasa las props.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ExerciseId } from "@/lib/engine/types";
import { ANIMATIONS } from "../figure/poses";
import { stillPhase } from "../figure/skeleton";
import { onGlStatus } from "./engine";
import { FigureView, type ViewProps } from "./FigureView";
import { readInk, watchInk } from "./ink";
import type { CharacterId, Figure3DStatus, FigureSide, FigureViewInput } from "./types";

export interface Figure3DCanvasProps {
  exerciseId: ExerciseId;
  character: CharacterId;
  view: FigureViewInput | undefined;
  side: FigureSide;
  keepFacing: boolean;
  tone: "dark" | "light";
  showGround: boolean;
  playing: boolean;
  repSec: number | undefined;
  idle?: boolean | undefined;
  trail?: boolean | undefined;
  ghosts?: boolean | undefined;
  phase?: number | undefined;
  onPhase?: ((p: number) => void) | undefined;
  onStatus(s: Figure3DStatus): void;
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void): (() => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReduced = (): boolean => window.matchMedia(REDUCED).matches;

export default function Figure3DCanvas(props: Figure3DCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<FigureView | null>(null);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const still = stillPhase(ANIMATIONS[props.exerciseId]);
  const { exerciseId, view, side, keepFacing, tone, showGround, playing, repSec, character, idle, trail, ghosts, phase } = props;
  const vp: ViewProps = { exerciseId, view, side, keepFacing, tone, showGround, playing, repSec, still, reduced, idle, trail, ghosts, phase };

  // Props → vista. La creación (efecto de abajo) lee la última a través de la ref; este efecto aplica cada cambio.
  const vpRef = useRef(vp);
  const statusRef = useRef(props.onStatus);
  const phaseRef = useRef(props.onPhase);
  useEffect(() => {
    vpRef.current = vp;
    statusRef.current = props.onStatus;
    phaseRef.current = props.onPhase;
    viewRef.current?.update(vp);
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    let clip: { name: string; idle: boolean } | undefined;
    const emit = (s: Figure3DStatus): void => statusRef.current(s);
    const v = new FigureView(
      canvas,
      vpRef.current,
      {
        onReady: (name, idle) => {
          clip = { name, idle };
          emit({ state: "ready", clip: name, usedIdle: idle });
        },
        onFail: (e) => emit({ state: "failed", error: e instanceof Error ? e.message : String(e) }),
        // Solo la figura principal pide la fase; el resto no paga nada.
        ...(props.onPhase ? { onPhase: (p: number) => phaseRef.current?.(p) } : {}),
      },
      character,
    );
    viewRef.current = v;
    v.setInk(readInk(host));
    v.resize(host.clientWidth, host.clientHeight);
    const ro = new ResizeObserver(([e]) => e && v.resize(e.contentRect.width, e.contentRect.height));
    ro.observe(host);
    const io = new IntersectionObserver((es) => {
      const e = es[es.length - 1];
      if (!e) return;
      v.inView = e.isIntersecting;
      v.invalidate();
    });
    io.observe(host);
    const stopInk = watchInk(host, (t) => v.setInk(t));
    const stopGl = onGlStatus((s) => {
      v.paused = s !== "ok";
      if (s === "ok") {
        v.invalidate();
        if (clip) emit({ state: "ready", clip: clip.name, usedIdle: clip.idle });
      } else emit({ state: s === "lost" ? "lost" : "failed" });
    });
    void v.init();
    return () => {
      stopGl();
      stopInk();
      io.disconnect();
      ro.disconnect();
      v.dispose();
      viewRef.current = null;
    };
  }, [character]);

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

export type { ExerciseId };
