"use client";

import { useSearchParams } from "next/navigation";
import { Figure3D } from "@/components/figure3d/Figure3D";
import { PhaseBeats } from "@/components/figure3d/PhaseBeats";
import { setPhase } from "@/components/figure3d/phaseBus";
import { BEATS } from "@/components/figure3d/beats";
import { CLIPS_3D } from "@/components/figure3d/clips";
import { isCharacterId, parseView, type CharacterId } from "@/components/figure3d/types";
import { FIGURE_IDS, FIGURE_LABEL_ES } from "@/components/figure/poses";
import type { ExerciseId } from "@/lib/engine/types";

const INKS = ["power", "strength", "endurance", "hybrid", "skill", "recovery"] as const;

/**
 * Banco de pruebas VISUAL de legibilidad (solo desarrollo): los 29 ejercicios a tamaño real, cada uno sobre un color de carta
 * distinto, congelados en una fase del movimiento. Parámetros: char=bro|princess · phase=0..1 · size=px · view=side|front|... ·

 * trail=0 (sin recorrido) · ghosts=1 (siluetas de poses clave) · only=id,id (solo esos ejercicios) · beats=1 (con las fichas de fases).
 */
export function Legibilidad() {
  const sp = useSearchParams();
  const charParam = sp.get("char");
  const character: CharacterId = isCharacterId(charParam) ? charParam : "bro";
  const phaseRaw = sp.get("phase");
  const phase = phaseRaw === null || phaseRaw === "" ? undefined : Math.min(1, Math.max(0, Number(phaseRaw)));
  const size = Math.min(420, Math.max(90, Number(sp.get("size")) || 200));
  const view = parseView(sp.get("view")) ?? undefined;
  const trail = sp.get("trail") !== "0";
  const ghosts = sp.get("ghosts") === "1";
  const beats = sp.get("beats") === "1";
  const only = sp.get("only")?.split(",").filter(Boolean);
  const ids = (FIGURE_IDS as ExerciseId[]).filter((id) => CLIPS_3D.has(id) && (!only || only.includes(id)));
  // La fase en vivo de las fichas la daría la figura principal; aquí se fija a la misma que se dibuja.
  if (phase !== undefined) setPhase(phase);

  return (
    <main className="bg-night p-3 text-paper">
      <p className="mb-2 font-num text-[12px] opacity-70">
        {character} · fase {phase ?? "viva"} · {size}px · {ids.length} ejercicios
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
        {ids.map((id, i) => (
          <figure key={id} data-focus={INKS[i % INKS.length]} className="m-0">
            <div className="grid place-items-center rounded-[14px] bg-ink">
              <Figure3D exerciseId={id} size={size} playing={phase === undefined} phase={phase} trail={trail} ghosts={ghosts} character={character} view={view} />
            </div>
            <figcaption className="mt-1 text-[11px] leading-tight opacity-80">{FIGURE_LABEL_ES[id]}</figcaption>
            {beats && (
              <div className="mt-1">
                <PhaseBeats exerciseId={id} />
                <span className="sr-only">{BEATS[id].join(", ")}</span>
              </div>
            )}
          </figure>
        ))}
      </div>
    </main>
  );
}
