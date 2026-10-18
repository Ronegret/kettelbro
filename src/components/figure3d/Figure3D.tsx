"use client";

/**
 * <Figure3D /> — el personaje 3D de un ejercicio, con las mismas props que <ExerciseArt /> más personaje, vista y lado.
 *
 * DECISIÓN: three.js "vanilla" + un motor propio pequeño, no @react-three/fiber.
 *   - r3f añade reconciler, sistema de eventos y utilidades por encima de three y aquí no aporta nada: es UNA escena con UN
 *     personaje animado con un mixer y dibujado a demanda, sin árbol de componentes 3D. Con vanilla hay un solo renderer
 *     compartido por todas las figuras de la página, bucle propio con pausa/fuera de pantalla y control exacto de la memoria.
 *   - Medido (hito 1): visor three vanilla = 598 KB sin comprimir / 148 KB gzip / 123 KB brotli en el build de producción de
 *     Next (dos trozos: three + visor). @react-three/fiber 9.8.2 añade ENCIMA de three 187 KB / 59 KB gzip / 52 KB brotli
 *     (bundle aislado con esbuild, no integrado en Next): +40 % de gzip por un reconciler que esta escena no usa.
 *   - El JS inicial de las pantallas existentes no crece: este archivo importa solo tipos, la sonda (gate.ts, sin three)
 *     y la figura 2D; three vive en el trozo que next/dynamic descarga cuando se monta una figura Y hay WebGL2.
 *
 * Robustez: sin WebGL2 / ahorro de datos / error al cargar el visor o el GLB (2 reintentos) / contexto perdido más de 3
 * veces → se ve la figura 2D de siempre. Con el contexto perdido, la 2D cubre mientras tanto y el 3D vuelve si el navegador
 * lo restaura. El espacio se reserva desde el primer render (sin saltos de diseño).
 */

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ExerciseId } from "@/lib/engine/types";
import { ExerciseArt } from "../figure/ExerciseArt";
import { FIGURE_LABEL_ES } from "../figure/poses";
import { canUse3D } from "./gate";
import type { CharacterId, Figure3DStatus, FigureSide, FigureViewInput } from "./types";

export type { CharacterId, Figure3DStatus, FigureSide, FigureView, FigureViewInput } from "./types";

const Canvas3D = dynamic(() => import("./Figure3DCanvas"), { ssr: false, loading: () => null });

export interface Figure3DProps {
  exerciseId: ExerciseId;
  size?: number | string;
  playing?: boolean;
  repSec?: number;
  showGround?: boolean;
  label?: string;
  /** dark: contorno noche (sobre tinta clara) · light: contorno papel (sobre fondos oscuros). La ropa no cambia. */
  tone?: "dark" | "light";
  character?: CharacterId;
  /**
   * "side" | "front" | "three-quarter" | "auto" | "angle" (= tres cuartos) | grados (0 perfil, 90 frente, como `viewYaw` de la 2D).
   * Sin valor: la mejor vista del ejercicio (FIGURE_VIEWS[id].defaultView). En "side" el personaje mira a la derecha de la pantalla.
   */
  view?: FigureViewInput;
  /** "left" refleja el personaje (y la vista) para el lado izquierdo. */
  side?: FigureSide;
  /** Con side="left", mantiene al personaje mirando a la derecha (la mano de trabajo queda detrás del cuerpo). */
  keepFacing?: boolean;
  /** Muestra al personaje de pie (clip `idle`) aunque el ejercicio tenga clip: para presentarlo (elección de instructor). */
  idle?: boolean;
  /** Dibuja el recorrido de la pesa (por defecto sí; los acarreos nunca). */
  trail?: boolean;
  /** Siluetas fijas de tres momentos del movimiento detrás del personaje (por defecto no). */
  ghosts?: boolean;
  /** Congela el movimiento en esta fase (0..1): solo para el banco de pruebas visual. */
  phase?: number;
  /** Avisa de la fase (0..1) en cada fotograma: solo para la figura principal, que alimenta las fichas de fases. */
  onPhase?: (p: number) => void;
  onStatus?: (s: Figure3DStatus) => void;
}

/** Un fallo al descargar el trozo del visor no debe tumbar la pantalla: pasa a la 2D. */
class Guard extends Component<{ onError(e: unknown): void; children: ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError(): { bad: boolean } {
    return { bad: true };
  }
  componentDidCatch(e: unknown): void {
    this.props.onError(e);
  }
  render(): ReactNode {
    return this.state.bad ? null : this.props.children;
  }
}

export function Figure3D({
  exerciseId,
  size = 190,
  playing = true,
  repSec,
  showGround = true,
  label,
  tone = "dark",
  character = "bro",
  view,
  side = "right",
  keepFacing = false,
  idle = false,
  trail = true,
  ghosts = false,
  phase,
  onPhase,
  onStatus,
}: Figure3DProps) {
  // "probe" es el estado del servidor y del primer render del cliente: reserva el hueco y no decide nada todavía.
  const [state, setState] = useState<"probe" | Figure3DStatus["state"]>("probe");
  const cb = useRef(onStatus);
  useEffect(() => {
    cb.current = onStatus;
  });
  const report = useCallback((s: Figure3DStatus) => {
    setState(s.state);
    cb.current?.(s);
  }, []);
  useEffect(() => {
    report(canUse3D() ? { state: "loading" } : { state: "failed", error: "sin WebGL2 o ahorro de datos" });
  }, [report]);

  const show2d = state === "failed" || state === "lost";
  const aria = label ?? `Figura 3D animada: ${FIGURE_LABEL_ES[exerciseId]}`;
  return (
    <div style={{ width: size, height: size, position: "relative" }} className="shrink-0" role="img" aria-label={aria}>
      {state === "probe" || state === "loading" ? (
        <div aria-hidden style={{ position: "absolute", inset: 0 }}>
          <div
            style={{
              position: "absolute",
              left: "22%",
              right: "22%",
              bottom: "15%",
              height: "6%",
              borderRadius: "50%",
              background: "var(--ink-deep)",
              opacity: 0.45,
            }}
          />
        </div>
      ) : null}
      {state !== "probe" && state !== "failed" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: state === "ready" ? 1 : 0,
            transition: "opacity 0.22s var(--ease-out)",
            visibility: show2d ? "hidden" : "visible",
          }}
        >
          <Guard onError={(e) => report({ state: "failed", error: e instanceof Error ? e.message : String(e) })}>
            <Canvas3D
              exerciseId={exerciseId}
              character={character}
              view={view}
              side={side}
              keepFacing={keepFacing}
              idle={idle}
              trail={trail}
              ghosts={ghosts}
              phase={phase}
              onPhase={onPhase}
              tone={tone}
              showGround={showGround}
              playing={playing}
              repSec={repSec}
              onStatus={report}
            />
          </Guard>
        </div>
      ) : null}
      {show2d ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <ExerciseArt exerciseId={exerciseId} size="100%" playing={playing} repSec={repSec} showGround={showGround} tone={tone} label={aria} />
        </div>
      ) : null}
    </div>
  );
}

export default Figure3D;
