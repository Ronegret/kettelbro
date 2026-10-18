"use client";

import type { ExerciseId } from "@/lib/engine/types";
import { ExerciseFigure } from "./ExerciseFigure";

/**
 * Arte del ejercicio dentro de cartas y player: la figura animada en tinta plana.
 * Hereda la paleta del enfoque del día: trazo noche, pesa papel, detalles en la tinta profunda.
 */
export function ExerciseArt({
  exerciseId,
  size = 190,
  playing = true,
  repSec,
  showGround = true,
  label,
  tone = "dark",
}: {
  exerciseId: ExerciseId;
  playing?: boolean;
  repSec?: number;
  size?: number | string;
  showGround?: boolean;
  label?: string;
  /** dark: figura noche sobre tinta clara; light: figura papel sobre fondos oscuros. */
  tone?: "dark" | "light";
}) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <ExerciseFigure
        exerciseId={exerciseId}
        ink={tone === "dark" ? "var(--fig-ink)" : "var(--paper)"}
        accent={tone === "dark" ? "var(--fig-bell)" : "var(--ink-lift)"}
        paper="var(--fig-detail)"
        playing={playing}
        repSec={repSec}
        showGround={showGround}
        label={label}
      />
    </div>
  );
}
