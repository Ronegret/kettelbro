"use client";

import { FigureAuto } from "@/components/figure3d/FigureAuto";
import { PhaseBeats } from "@/components/figure3d/PhaseBeats";
import { PoseStrip } from "@/components/figure3d/PoseStrip";
import { setPhase } from "@/components/figure3d/phaseBus";
import { ViewSwitch } from "@/components/figure3d/ViewSwitch";
import { Sheet } from "@/components/ui/Sheet";
import { EXERCISES } from "@/lib/engine/exercises";
import type { ExerciseId, WorkBlock } from "@/lib/engine/types";

/** Ficha técnica del ejercicio en curso: cues, error común, regresión/progresión y, para el get-up, sus 7 etapas. */
export function InfoSheet({
  open,
  onClose,
  exerciseId,
  block,
  focus,
  onEvidence,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId: ExerciseId;
  block?: WorkBlock;
  /** Tinta del día para el fondo de la figura. */
  focus?: string;
  onEvidence: () => void;
}) {
  const ex = EXERCISES[exerciseId];
  return (
    <Sheet open={open} onClose={onClose} title={ex.nameEs}>
      <p className="text-sm text-paper-mute">
        {ex.muscles.join(" · ")} · {ex.cadenceEs}
      </p>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div data-focus={focus} className="grid place-items-center rounded-[20px] bg-ink px-4 py-2">
          <FigureAuto exerciseId={exerciseId} size={210} playing={open} showGround ghosts onPhase={setPhase} />
        </div>
        <PhaseBeats exerciseId={exerciseId} active={open} />
        <ViewSwitch exerciseId={exerciseId} />
      </div>

      <h3 className="mt-5 font-slab text-lg">Paso a paso</h3>
      <div className="mt-2">
        <PoseStrip exerciseId={exerciseId} focus={focus} />
      </div>

      <h3 className="mt-5 font-slab text-lg">Cues</h3>
      <ul className="mt-2 space-y-2">
        {ex.cues.map((c) => (
          <li key={c} className="flex gap-3 text-[16px] leading-snug">
            <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-ink-lift" aria-hidden="true" />
            {c}
          </li>
        ))}
      </ul>

      {ex.stagesEs && (
        <>
          <h3 className="mt-5 font-slab text-lg">Las 7 etapas</h3>
          <ol className="mt-2 space-y-2">
            {ex.stagesEs.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px] leading-snug text-paper-dim">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink font-num text-[14px] font-bold text-on-ink">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </>
      )}

      <h3 className="mt-5 font-slab text-lg">Error común</h3>
      <p className="mt-1 text-[15px] leading-snug text-paper-dim">{ex.mistake}</p>

      {(ex.regression || ex.progression) && (
        <>
          <h3 className="mt-5 font-slab text-lg">Si hoy se siente…</h3>
          <ul className="mt-1 space-y-1 text-[15px] text-paper-dim">
            {ex.regression && <li>Muy difícil: baja a {EXERCISES[ex.regression].nameEs.toLowerCase()}.</li>}
            {ex.progression && <li>Muy fácil: sube a {EXERCISES[ex.progression].nameEs.toLowerCase()} cuando la técnica sea limpia.</li>}
          </ul>
        </>
      )}

      {block?.noteEs && (
        <>
          <h3 className="mt-5 font-slab text-lg">Del coach</h3>
          <p className="mt-1 text-[15px] leading-snug text-paper-dim">{block.noteEs}</p>
        </>
      )}

      <p className="mt-6 text-[13.5px] leading-snug text-paper-mute">
        Una demostración no sustituye a un entrenador. Si hay dolor (no la molestia muscular de esforzarte), para: hazlo sin peso o elige la versión más fácil.
      </p>

      {block && block.evidence.length > 0 && (
        <button type="button" onClick={onEvidence} className="press mt-6 h-11 rounded-full border-2 border-ink-lift/60 px-4 text-[14.5px] font-medium text-ink-lift">
          Respaldo científico de este bloque
        </button>
      )}
    </Sheet>
  );
}
