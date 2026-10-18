import { stepDurationSec } from "@/lib/engine/steps";
import type { SessionPlan, Step } from "@/lib/engine/types";

/**
 * Línea de tiempo de la sesión: un segmento por bloque, con ANCHO PROPORCIONAL A SU DURACIÓN.
 * El relleno avanza con los pasos completados dentro de cada bloque.
 */
export function Timeline({ plan, steps, index }: { plan: SessionPlan; steps: Step[]; index: number }) {
  const segs = plan.blocks.map((b) => {
    const mine = steps.filter((s) => s.blockId === b.id);
    const dur = mine.reduce((a, s) => a + stepDurationSec(s), 0) || 1;
    const first = mine[0]?.index ?? 0;
    const done = mine.filter((s) => s.index < index).length;
    const current = mine.some((s) => s.index === index);
    return { id: b.id, dur, frac: mine.length ? (done + (current ? 0.5 : 0)) / mine.length : 0, current, first };
  });
  const total = segs.reduce((a, s) => a + s.dur, 0) || 1;
  return (
    <div className="flex h-2 flex-1 gap-[3px]" role="progressbar" aria-label="Avance de la sesión" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index}>
      {segs.map((s) => (
        <span key={s.id} className="relative h-full overflow-hidden rounded-full bg-night/35" style={{ flexGrow: s.dur / total, flexBasis: 0, minWidth: 6 }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-paper transition-[width] duration-500 ease-[var(--ease-out)]"
            style={{ width: `${Math.min(100, s.frac * 100)}%`, opacity: s.current ? 1 : 0.85 }}
          />
        </span>
      ))}
    </div>
  );
}
