import { focusOfDay } from "@/lib/engine/generator";
import { MESO_WEEKS, MICRO_DAYS, THEME_LABEL_ES, cyclePosition } from "@/lib/engine/calendar";
import type { UserSettings } from "@/lib/engine/types";
import { Bean } from "./Bean";
import { Icon } from "./Icon";

/**
 * TU MES: 4 filas (semanas) × 7 columnas (días) del mesociclo actual.
 * Cada casilla lleva la tinta del enfoque de ese día; al completarla se marca con un visto.
 * Semana completa = ¡SEMANA COMPLETA!
 */
export function Tabla({
  dayIndex,
  settings,
  justDone,
  holdBean = false,
}: {
  dayIndex: number;
  settings: UserSettings;
  justDone?: number;
  /** true mientras el visto del día viaja volando desde la tarjeta: la casilla lo muestra al aterrizar. */
  holdBean?: boolean;
}) {
  const pos = cyclePosition(dayIndex, settings.primaryGoal);
  const cells = MESO_WEEKS * MICRO_DAYS;
  const start = (pos.mesocycle - 1) * cells + 1;
  const rows = Array.from({ length: MESO_WEEKS }, (_, w) =>
    Array.from({ length: MICRO_DAYS }, (_, d) => {
      const day = start + w * MICRO_DAYS + d;
      return { day, focus: focusOfDay(day, settings), done: day < dayIndex, today: day === dayIndex };
    }),
  );
  const loterias = rows.filter((r) => r.every((c) => c.done)).length;
  // Si el día recién completado cierra una semana, esa fila hace la ola de ¡SEMANA COMPLETA!
  const waveRow = justDone ? rows.findIndex((r) => r.some((c) => c.day === justDone) && r.every((c) => c.done)) : -1;

  return (
    <section aria-label="Tu mes" className="rounded-[22px] border border-white/10 bg-night-2 p-4 text-paper">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-slab text-[26px]">Tu mes {pos.mesocycle}</h2>
          <p className="mt-1 text-sm text-paper-dim">
            {THEME_LABEL_ES[pos.theme]} · semana {pos.week} de {MESO_WEEKS}
          </p>
        </div>
        {loterias > 0 && (
          <span className="inline-flex -skew-x-6 items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-slab text-[17px] text-on-ink">
            <Icon name="check" size={16} /> Semana completa ×{loterias}
          </span>
        )}
      </div>
      <div role="grid" aria-label="Días del mesociclo" className="grid gap-1.5">
        {rows.map((row, wi) => {
          const complete = row.every((c) => c.done);
          return (
            <div role="row" key={wi} className="grid grid-cols-7 gap-1.5">
              {row.map((c, ci) => (
                <div
                  role="gridcell"
                  key={c.day}
                  data-day={c.day}
                  data-focus={c.focus}
                  style={wi === waveRow ? { animation: "cell-wave 0.42s var(--ease-out) both", animationDelay: `${(holdBean ? 1.1 : 0.2) + ci * 0.06}s` } : undefined}
                  aria-label={`Día ${c.day}${c.done ? ", completado" : c.today ? ", hoy" : ""}`}
                  className={`relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[10px] ${
                    c.done ? "bg-ink text-on-ink" : c.today ? "bg-ink text-on-ink" : "border border-white/10 bg-night-3 text-paper-mute"
                  } ${c.today ? "outline outline-[2.5px] outline-offset-2 outline-paper" : ""}`}
                >
                  <span className="px-1.5 pt-1 font-num text-[13px] font-bold leading-none">{c.day}</span>
                  {!c.done && !c.today && <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1.5 h-1 rounded-full bg-ink" />}
                  {c.done && !(holdBean && justDone === c.day) && (
                    <Bean
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%]"
                      size={24}
                      drop={justDone === c.day}
                    />
                  )}
                </div>
              ))}
              {complete && <span className="sr-only">Semana {wi + 1} completa</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
