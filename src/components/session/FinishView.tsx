"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Feel, SessionPlan, SetLog } from "@/lib/engine/types";
import { fmtClock, nf } from "@/lib/format";

/** Equivalencia RPE ↔ repeticiones en reserva (escala RIR validada, Zourdos 2016): se muestra en lenguaje llano. */
const RPE_TEXT: Record<number, string> = {
  1: "Casi nada de esfuerzo.",
  2: "Muy suave.",
  3: "Suave: conversación normal.",
  4: "Cómodo, podrías hacer muchas más.",
  5: "Moderado: te quedaban 5 o más.",
  6: "Te quedaban unas 4 repeticiones.",
  7: "Te quedaban unas 3 repeticiones.",
  8: "Te quedaban 2 repeticiones.",
  9: "Te quedaba 1 repetición.",
  10: "Máximo: no podías hacer ni una más.",
};

const FEELS: Array<{ id: Feel; label: string; text: string }> = [
  { id: 1, label: "Fácil", text: "Me sobró energía" },
  { id: 2, label: "Justa", text: "Como debía ser" },
  { id: 3, label: "Durísima", text: "Me costó mucho" },
];

export function FinishView({
  plan,
  sets,
  durationSec,
  tonnageKg,
  saving,
  onSave,
  onBack,
}: {
  plan: SessionPlan;
  sets: SetLog[];
  durationSec: number;
  tonnageKg: number;
  saving: boolean;
  onSave: (rpe: number, feel: Feel) => void;
  /** Volver a la sesión (por ejemplo, si se terminó por error). */
  onBack?: () => void;
}) {
  const [rpe, setRpe] = useState(Math.min(10, Math.max(1, Math.round(plan.rpeTarget))));
  const [feel, setFeel] = useState<Feel>(2);
  const reps = sets.reduce((a, s) => a + (s.skipped ? 0 : s.reps), 0);
  const skipped = sets.filter((s) => s.skipped).length;

  return (
    <div data-focus={plan.focus} className="bg-ink-deep text-paper">
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6 pt-safe">
      {onBack && (
        <button type="button" onClick={onBack} className="press -ml-1 mt-4 inline-flex h-11 items-center gap-1.5 self-start rounded-full bg-night/35 pl-2 pr-4 text-[15px] font-medium">
          <Icon name="back" size={20} /> Volver a la sesión
        </button>
      )}
      <h1 className="pt-5 font-slab text-[34px] leading-[1.05] text-balance">¡Terminaste el Día {plan.dayIndex}!</h1>
      <p className="mt-2 text-[16px] text-paper/80">Cuéntanos cómo se sintió: ajusta tu próxima sesión.</p>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          [fmtClock(durationSec), "tiempo"],
          [nf(reps), "repeticiones"],
          [nf(tonnageKg), "kg movidos"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-[16px] bg-night/45 px-2 py-3">
            <dd className="heat-num text-[28px] leading-none" style={{ ["--heat" as string]: 0.8 }}>
              {v}
            </dd>
            <dt className="mt-1 text-[14px] text-paper/75">{l}</dt>
          </div>
        ))}
      </dl>
      {skipped > 0 && <p className="mt-2 text-center text-sm text-paper/75">Saltaste {skipped} {skipped === 1 ? "serie" : "series"}: se tomó en cuenta.</p>}

      <section className="mt-8" aria-labelledby="rpe">
        <h2 id="rpe" className="font-slab text-2xl">
          ¿Qué tan duro estuvo?
        </h2>
        <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Esfuerzo percibido de 1 a 10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rpe === n}
              onClick={() => setRpe(n)}
              className={`press h-14 rounded-[14px] border-2 font-num text-xl font-bold ${rpe === n ? "border-paper bg-paper text-night" : "border-paper/30 bg-night/35"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 min-h-[1.5rem] text-[15px] text-paper/85" aria-live="polite">
          {RPE_TEXT[rpe]}
        </p>
      </section>

      <section className="mt-6" aria-labelledby="feel">
        <h2 id="feel" className="font-slab text-2xl">
          ¿Cómo te sentiste?
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sensación">
          {FEELS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={feel === f.id}
              onClick={() => setFeel(f.id)}
              className={`press rounded-[14px] border-2 px-2 py-3 text-center ${feel === f.id ? "border-paper bg-paper text-night" : "border-paper/30 bg-night/35"}`}
            >
              <span className="block font-slab text-[17px]">{f.label}</span>
              <span className="block text-[14px] leading-tight opacity-80">{f.text}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-auto pt-8">
        <Button variant="paper" size="lg" className="w-full" disabled={saving} onClick={() => onSave(rpe, feel)}>
          {saving ? "Guardando…" : "Guardar sesión"}
        </Button>
      </div>
    </main>
    </div>
  );
}
