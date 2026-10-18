"use client";

import type { ExerciseId } from "@/lib/engine/types";
import { BEATS } from "./beats";
import { FigureAuto } from "./FigureAuto";
import { useIs3d } from "./prefs";

/** Momento de la repetición que representa cada fase (el centro de cada tercio, como las fichas en vivo). */
const KEY_PHASES = [1 / 6, 1 / 2, 5 / 6] as const;

/**
 * Las tres posturas clave de la repetición, congeladas y una junto a otra (salida · esfuerzo · llegada), con su frase.
 * Para estudiar el movimiento antes de imitarlo. Solo se dibuja en 3D: la 2D no puede congelar una fase.
 */
export function PoseStrip({ exerciseId, focus }: { exerciseId: ExerciseId; focus?: string | undefined }) {
  const is3d = useIs3d(exerciseId);
  if (!is3d) return null;
  return (
    <ol className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {BEATS[exerciseId].map((label, i) => (
        <li key={label} className="w-[62%] shrink-0 snap-start">
          <div data-focus={focus} className="aspect-square overflow-hidden rounded-[16px] bg-ink">
            <FigureAuto exerciseId={exerciseId} size="100%" playing={false} phase={KEY_PHASES[i] as number} showGround={false} />
          </div>
          <p className="mt-1.5 flex items-start gap-1.5 text-[14px] font-bold leading-tight">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-num text-[11px] text-on-ink" data-focus={focus}>
              {i + 1}
            </span>
            <span className="min-w-0">{label}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
