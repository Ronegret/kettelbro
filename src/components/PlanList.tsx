import { EXERCISES } from "@/lib/engine/exercises";
import type { BlockRole, SessionPlan } from "@/lib/engine/types";
import { bellLabelLong, protocolLabel } from "@/lib/format";
import { blockEstimateSec } from "@/lib/engine/steps";

const ROLE_ES: Record<BlockRole, string> = {
  warmup: "Calentamiento",
  primary: "Principal",
  secondary: "Complemento",
  finisher: "Remate",
  cooldown: "Vuelta a la calma",
};

/**
 * La rutina del día como línea de tiempo: cada bloque ocupa una altura proporcional a su duración
 * (la longitud ES el tiempo). Sin tarjetas anidadas: filas separadas por un trazo.
 */
export function PlanList({ plan }: { plan: SessionPlan }) {
  const durs = plan.blocks.map((b) => blockEstimateSec(b));
  const total = durs.reduce((a, b) => a + b, 0) || 1;
  return (
    <ol aria-label="Rutina de hoy" className="relative">
      {plan.blocks.map((b, i) => {
        const ex = EXERCISES[b.exerciseId];
        const share = (durs[i] as number) / total;
        const complex = b.protocol.kind === "complex";
        return (
          <li key={b.id} className="flex gap-3.5" style={{ minHeight: `${Math.max(56, Math.round(share * 340))}px` }}>
            <div className="flex w-3 shrink-0 flex-col items-center" aria-hidden="true">
              <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${b.role === "primary" ? "bg-ink-lift" : "border-2 border-paper-mute"}`} />
              <span
                className={`mt-1 w-[5px] flex-1 rounded-full ${
                  b.role === "primary" ? "bg-ink-lift" : b.role === "secondary" || b.role === "finisher" ? "bg-ink-lift/45" : "bg-seam"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-medium leading-snug">
                  {complex && b.protocol.kind === "complex" ? b.protocol.items.map((it) => EXERCISES[it.exerciseId].nameEs).join(" + ") : ex.nameEs}
                </span>
                <span className="shrink-0 font-num text-sm text-paper-dim">{Math.max(1, Math.round((durs[i] as number) / 60))} min</span>
              </p>
              <p className="text-[14px] text-paper-dim">
                {ROLE_ES[b.role]} · {protocolLabel(b.protocol, b.exerciseId)} · {bellLabelLong(b)}
              </p>
              {b.methodEs && <p className="mt-0.5 text-[14px] text-ink-lift">{b.methodEs}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
