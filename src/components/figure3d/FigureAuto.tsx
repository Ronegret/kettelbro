"use client";

import { ExerciseArt } from "../figure/ExerciseArt";
import type { ExerciseId } from "@/lib/engine/types";
import { Figure3D } from "./Figure3D";
import { useCharacter, useFigureView, useIs3d } from "./prefs";
import type { FigureSide, FigureViewInput } from "./types";

/**
 * La figura de un ejercicio con las preferencias del usuario: el instructor 3D elegido, en la vista elegida, cuando el
 * ejercicio tiene clip 3D y el 3D está activado; si no, la figura 2D de siempre. <Figure3D /> a su vez cae a la 2D si el
 * dispositivo no soporta WebGL. Mismas props que <ExerciseArt /> más el lado de trabajo.
 */
export function FigureAuto({
  exerciseId,
  size = 190,
  playing = true,
  repSec,
  showGround = true,
  label,
  tone = "dark",
  side = "right",
  view: viewProp,
  ghosts,
  phase,
  onPhase,
}: {
  exerciseId: ExerciseId;
  size?: number | string;
  playing?: boolean;
  repSec?: number;
  showGround?: boolean;
  label?: string;
  tone?: "dark" | "light";
  side?: FigureSide;
  /** Vista por defecto en este lugar (por ejemplo tres cuartos en las cartas); la que elige la persona manda sobre ella. */
  view?: FigureViewInput;
  /** Siluetas fijas de tres momentos del movimiento detrás del personaje (solo en 3D). */
  ghosts?: boolean;
  /** Congela el movimiento en esta fase (0..1): para mostrar una postura concreta (solo en 3D). */
  phase?: number;
  /** La figura principal de la pantalla avisa de su fase (alimenta <PhaseBeats />). */
  onPhase?: (p: number) => void;
}) {
  const is3d = useIs3d(exerciseId);
  const character = useCharacter();
  const chosen = useFigureView(exerciseId);
  const view = chosen ?? viewProp;
  if (!is3d) return <ExerciseArt exerciseId={exerciseId} size={size} playing={playing} repSec={repSec} showGround={showGround} label={label} tone={tone} />;
  return <Figure3D exerciseId={exerciseId} size={size} playing={playing} repSec={repSec} showGround={showGround} label={label} tone={tone} character={character} view={view} side={side} ghosts={ghosts ?? false} {...(phase !== undefined ? { phase } : {})} onPhase={onPhase} />;
}
