"use client";

import { Sheet } from "@/components/ui/Sheet";
import { GRADE_TEXT, getEvidence, gradeOf } from "@/lib/evidence";

/** Respaldo científico: cada cita se verificó contra PubMed/DOI. Se muestra el diseño y el tamaño de muestra. */
export function EvidenceSheet({ open, onClose, ids, title = "Respaldo científico" }: { open: boolean; onClose: () => void; ids: readonly string[]; title?: string }) {
  const items = getEvidence(ids);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-4 text-[14.5px] text-paper-dim">
        Estos estudios respaldan cómo está armada tu sesión de hoy. Cada uno se muestra con su diseño y limitaciones: ninguno promete milagros.
      </p>
      <p className="mb-4 text-[14px] text-paper-mute">
        Nivel: <b>A</b> guía o meta-análisis · <b>B</b> ensayo controlado · <b>C</b> laboratorio o biomecánica · <b>D</b> consenso, encuesta o caso. Es un juicio cualitativo, no GRADE.
      </p>
      <ul className="space-y-4">
        {items.map((e) => (
          <li key={e.id} className="border-t border-seam pt-4 first:border-t-0 first:pt-0">
            <p className="flex items-start gap-2.5 font-medium leading-snug">
              <span title={GRADE_TEXT[gradeOf(e)]} aria-label={`Nivel ${gradeOf(e)}: ${GRADE_TEXT[gradeOf(e)]}`} className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink font-num text-[14px] font-extrabold text-on-ink">
                {gradeOf(e)}
              </span>
              {e.title}
            </p>
            <p className="mt-0.5 text-[14px] text-paper-mute">
              {e.authors} · {e.year} · {e.journal}
            </p>
            <p className="mt-1 text-[14px] font-medium text-ink-lift">
              {e.design}
              {e.n ? ` · n = ${e.n}` : ""}
            </p>
            <p className="mt-1.5 text-[14.5px] leading-snug text-paper-dim">{e.findingEs}</p>
            <a href={e.url} target="_blank" rel="noreferrer noopener" className="mt-1.5 inline-block text-[14px] font-medium text-ink-lift underline underline-offset-4">
              Ver fuente
            </a>
          </li>
        ))}
        {items.length === 0 && <li className="text-paper-dim">Esta sesión no tiene estudios asociados.</li>}
      </ul>
    </Sheet>
  );
}
