"use client";

import type { ExerciseId } from "@/lib/engine/types";
import { BEATS } from "./beats";
import { usePhaseStep } from "./phaseBus";
import { useIs3d } from "./prefs";

/**
 * Las tres fases de la repetición bajo la figura, con la actual resaltada y sincronizada con el movimiento: sirve para
 * llevar el ritmo y la respiración al imitar. Solo aparece cuando el ejercicio se dibuja en 3D (la fase sale del visor).
 * Es una ayuda visual; la técnica por escrito sigue en los consejos que rotan debajo.
 */
export function PhaseBeats({ exerciseId, active = true }: { exerciseId: ExerciseId; active?: boolean }) {
  const is3d = useIs3d(exerciseId);
  const beats = BEATS[exerciseId];
  const step = usePhaseStep(beats.length);
  if (!is3d) return null;
  return (
    // Solo la fase actual lleva texto (el resto son números): así la frase cabe entera en cualquier ancho y no se pisa con nada.
    <ol aria-hidden="true" className="flex w-full max-w-sm items-center justify-center gap-1.5">
      {beats.map((b, i) => {
        const on = active && i === step;
        return (
          <li
            key={b}
            className={`flex min-h-8 items-center justify-center gap-1.5 rounded-[16px] font-num text-[12.5px] font-bold leading-[1.1] transition-colors duration-150 ${on ? "min-w-0 flex-1 bg-paper px-2.5 py-1 text-night" : "w-8 shrink-0 bg-night/35 text-paper/85"}`}
          >
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${on ? "bg-night text-paper" : ""}`}>{i + 1}</span>
            {on && <span className="min-w-0 text-left">{b}</span>}
          </li>
        );
      })}
    </ol>
  );
}
