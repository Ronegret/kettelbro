"use client";

import { Figure3D } from "./Figure3D";
import { setCharacter, useCharacter } from "./prefs";
import type { CharacterId } from "./types";

const CARDS: ReadonlyArray<{ id: CharacterId; name: string; role: string; focus: string }> = [
  { id: "bro", name: "Bro", role: "Tu instructor", focus: "strength" },
  { id: "princess", name: "Princess", role: "Tu instructora", focus: "skill" },
];

/**
 * Elección del instructor que te acompaña (Bro o Princess). Se guarda en este dispositivo. Cada tarjeta enseña al
 * personaje quieto en tres cuartos (con la figura 2D de respaldo si el dispositivo no soporta 3D).
 */
export function InstructorPicker() {
  const current = useCharacter();
  return (
    <div role="radiogroup" aria-label="Instructor" className="grid grid-cols-2 gap-3">
      {CARDS.map((c) => {
        const on = current === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setCharacter(c.id)}
            className={`press flex flex-col items-center rounded-[20px] border-[3px] p-2.5 pb-3 transition-colors duration-200 ${on ? "border-paper bg-night-3" : "border-seam bg-night-2"}`}
          >
            <span data-focus={c.focus} className="grid w-full place-items-center rounded-[14px] bg-ink py-1">
              <Figure3D exerciseId="goblet-squat" idle size={150} playing view="three-quarter" character={c.id} showGround={false} label={`${c.name}, instructor`} />
            </span>
            <span className="mt-2 font-slab text-[24px] leading-none">{c.name}</span>
            <span className="mt-1 text-[14px] text-paper-dim">{c.role}</span>
            <span className={`mt-2 inline-flex h-6 items-center rounded-full px-3 font-num text-[12px] font-bold caps ${on ? "bg-paper text-night" : "text-paper-mute"}`}>{on ? "Elegido" : "Elegir"}</span>
          </button>
        );
      })}
    </div>
  );
}
