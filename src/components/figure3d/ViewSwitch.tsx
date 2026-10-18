"use client";

import type { ExerciseId } from "@/lib/engine/types";
import { FIGURE_VIEWS } from "../figure/poses";
import { setFigureView, useFigureView, useIs3d } from "./prefs";
import type { FigureView } from "./types";

const OPTIONS: ReadonlyArray<{ id: FigureView; label: string; aria: string }> = [
  { id: "side", label: "Lado", aria: "Ver de lado" },
  { id: "front", label: "Frente", aria: "Ver de frente" },
  { id: "three-quarter", label: "3/4", aria: "Ver en tres cuartos" },
  { id: "auto", label: "Auto", aria: "Alternar las vistas automáticamente" },
];

/**
 * Cambio de ángulo del instructor (Lado · Frente · 3/4 · Auto). Se recuerda por ejercicio. Solo aparece cuando el
 * ejercicio se dibuja en 3D. `rail` = columna junto a la figura; `row` = fila bajo ella.
 */
export function ViewSwitch({ exerciseId, orientation = "row" }: { exerciseId: ExerciseId; orientation?: "row" | "rail" }) {
  const is3d = useIs3d(exerciseId);
  const chosen = useFigureView(exerciseId);
  if (!is3d) return null;
  // Lo que se resalta: la elección del usuario o, si no ha elegido, la mejor vista de ese ejercicio.
  const current = chosen === "angle" ? "three-quarter" : (chosen ?? FIGURE_VIEWS[exerciseId].defaultView);
  return (
    <div role="radiogroup" aria-label="Ángulo de la figura" className={orientation === "rail" ? "flex flex-col gap-1.5" : "flex flex-wrap justify-center gap-2"}>
      {OPTIONS.map((o) => {
        const on = current === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.aria}
            onClick={() => setFigureView(exerciseId, o.id)}
            className={`press inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 font-num text-[13.5px] font-bold ${on ? "bg-paper text-night" : "bg-night/40 text-paper"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
