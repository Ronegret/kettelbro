"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BodyFields, RecommendationPanel, parseBody } from "@/components/BodyPanel";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { useReadyProgram } from "@/components/RequireProgram";
import { Button } from "@/components/ui/Button";
import { Switch, ToggleChip } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { EXERCISES, WEIGH_EVERY_DAYS, addWeight, bmi, recommendBells, weightTrend } from "@/lib/engine";
import { localDateKey } from "@/lib/engine/defaults";
import type { BodyProfile, ExerciseId } from "@/lib/engine/types";
import { daysBetween } from "@/lib/engine/calendar";

const OWNABLE = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40];
const WEIGH_EVIDENCE = ["zheng2015", "madigan2015", "steinberg2014"];

function dateLabel(d: string, today: string) {
  const diff = daysBetween(d, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const [, m, day] = d.split("-");
  return `${Number(day)}/${Number(m)}`;
}

export default function Pesas() {
  const p = useReadyProgram();
  const s = p.settings;
  const today = localDateKey();
  const body = s.body;
  const last = body?.weights[body.weights.length - 1];

  const [heightStr, setHeightStr] = useState(body ? String(body.heightCm) : "");
  const [weightStr, setWeightStr] = useState(last ? String(last.kg) : "");
  const [evidence, setEvidence] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const parsed = parseBody(heightStr, weightStr);
  const rec = useMemo(
    () => (body && last ? recommendBells({ weightKg: last.kg, heightCm: body.heightCm, level: s.level }) : null),
    [body, last, s.level],
  );
  const trend = body ? weightTrend(body.weights) : null;
  const memory = Object.entries(p.state.memory).filter(([, m]) => m && m.lastDayIndex > 0) as Array<[ExerciseId, NonNullable<(typeof p.state.memory)[ExerciseId]>]>;

  const save = (patch: Partial<typeof s>) => void p.saveSettings({ ...s, ...patch });

  function toggleBell(kg: number) {
    const has = s.bells.includes(kg);
    const bells = has ? s.bells.filter((b) => b !== kg) : [...s.bells, kg].sort((a, b) => a - b);
    if (bells.length === 0) return; // al menos una pesa
    const referenceKg = bells.includes(s.referenceKg) ? s.referenceKg : bells.reduce((best, b) => (Math.abs(b - s.referenceKg) < Math.abs(best - s.referenceKg) ? b : best), bells[0] as number);
    save({ bells, referenceKg });
  }

  function saveBody() {
    if (!parsed) return;
    const base: BodyProfile = { heightCm: parsed.heightCm, weights: body?.weights ?? [], ...(body?.bellsCheckedAt ? { bellsCheckedAt: body.bellsCheckedAt } : { bellsCheckedAt: today }) };
    save({ body: addWeight(base, today, parsed.weightKg) });
    setSavedMsg(`Guardado: ${parsed.weightKg} kg.`);
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-6 pt-safe">
      <Link href="/perfil" className="press mt-5 inline-flex h-11 items-center gap-1.5 text-[15px] font-medium text-paper-dim">
        <Icon name="back" size={20} /> Perfil
      </Link>
      <h1 className="font-slab text-[34px] leading-none">Mis pesas y mi cuerpo</h1>
      <p className="mt-2 text-[15.5px] text-paper-dim">Aquí queda registrado qué pesas usas y cuánto pesas. La app programa tus cargas con esto.</p>

      {/* ───── Pesas que tengo ───── */}
      <section className="mt-8" aria-labelledby="mis">
        <h2 id="mis" className="font-slab text-2xl">
          Las pesas que tengo
        </h2>
        <p className="mt-1 text-[14.5px] text-paper-dim">Solo te mandaremos ejercicios con estas pesas (kg).</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Pesas disponibles">
          {OWNABLE.map((kg) => (
            <ToggleChip key={kg} on={s.bells.includes(kg)} onToggle={() => toggleBell(kg)}>
              {kg}
            </ToggleChip>
          ))}
        </div>
        <div className="mt-3">
          <Switch checked={Boolean(s.hasPairs)} onChange={(v) => save({ hasPairs: v })} label="Tengo dos pesas iguales" description="Habilita el acarreo de granjero y otros ejercicios de dos pesas." />
        </div>
        <h3 className="mt-5 font-slab text-lg">Mi pesa de referencia</h3>
        <p className="text-[14.5px] text-paper-dim">La más pesada con la que haces 10 swings a dos manos con buena técnica.</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Pesa de referencia">
          {s.bells.map((kg) => (
            <button
              key={kg}
              type="button"
              role="radio"
              aria-checked={s.referenceKg === kg}
              onClick={() => save({ referenceKg: kg })}
              className={`press h-12 min-w-[64px] rounded-[14px] border-2 px-3 font-num text-[17px] font-bold ${s.referenceKg === kg ? "border-ink bg-ink text-on-ink" : "border-seam text-paper-dim"}`}
            >
              {kg} kg
            </button>
          ))}
        </div>
      </section>

      {/* ───── Recomendación ───── */}
      <section className="mt-9" aria-labelledby="rec">
        <h2 id="rec" className="font-slab text-2xl">
          Qué pesas usar según tu cuerpo
        </h2>
        {rec ? (
          <div className="mt-3 space-y-3">
            <RecommendationPanel rec={rec} />
            {rec.referenceKg !== s.referenceKg && s.bells.includes(rec.referenceKg) && (
              <Button variant="secondary" onClick={() => save({ referenceKg: rec.referenceKg })}>
                Usar {rec.referenceKg} kg como referencia
              </Button>
            )}
            {rec.referenceKg !== s.referenceKg && !s.bells.includes(rec.referenceKg) && (
              <p className="text-[14.5px] text-paper-dim">
                Tu referencia actual es {s.referenceKg} kg. La sugerida ({rec.referenceKg} kg) no está entre tus pesas: si la consigues, márcala arriba.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-paper-dim">Anota tu estatura y tu peso aquí abajo y te sugerimos las pesas.</p>
        )}
      </section>

      {/* ───── Cuerpo y pesajes ───── */}
      <section className="mt-9" aria-labelledby="cuerpo">
        <h2 id="cuerpo" className="font-slab text-2xl">
          Mi cuerpo y mis pesajes
        </h2>
        <div className="mt-3">
          <BodyFields height={heightStr} weight={weightStr} onHeight={setHeightStr} onWeight={setWeightStr} />
          <Button className="mt-3 w-full" size="lg" disabled={!parsed} onClick={saveBody}>
            Guardar pesaje de hoy
          </Button>
          {savedMsg && (
            <p role="status" className="mt-2 text-[15px] text-ink-lift">
              {savedMsg}
            </p>
          )}
          {body && last && <p className="mt-2 text-[14.5px] text-paper-dim">IMC {bmi(last.kg, body.heightCm).toFixed(1)}: dato informativo, no un diagnóstico.</p>}
        </div>

        <div className="mt-4 rounded-[18px] bg-night-2 p-4 text-[15px] leading-snug">
          <p className="font-slab text-lg">¿Cada cuánto pesarte?</p>
          <p className="mt-1 text-paper-dim">
            Una vez por semana (cada {WEIGH_EVERY_DAYS} días): el mismo día, en ayunas y después de ir al baño. Mira la tendencia de 4 semanas, no un número suelto: el peso sube y baja 1-2 kg por día por el agua y la comida.
          </p>
          <p className="mt-2 text-paper-dim">
            Los estudios sobre pesaje se hicieron en programas de control de peso: pesarse con regularidad se asoció con mejores resultados y no con malestar psicológico, y pesarse a diario no superó a hacerlo una vez por semana. Para entrenar con pesas es una guía práctica.
          </p>
          <button type="button" onClick={() => setEvidence(true)} className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink-lift/60 px-4 text-[14.5px] font-medium text-ink-lift">
            <Icon name="book" size={18} /> Ver los estudios
          </button>
        </div>

        {body && body.weights.length > 0 && (
          <div className="mt-4">
            <h3 className="font-slab text-lg">Historial</h3>
            {trend && (
              <p className="text-[14.5px] text-paper-dim">
                En {trend.days} días: {trend.deltaKg > 0 ? "+" : ""}
                {trend.deltaKg.toString().replace(".", ",")} kg.
              </p>
            )}
            <ul className="mt-2 divide-y divide-seam">
              {[...body.weights]
                .reverse()
                .slice(0, 10)
                .map((w, i, arr) => {
                  const prev = arr[i + 1];
                  const d = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
                  return (
                    <li key={w.date} className="flex items-baseline justify-between py-2.5 text-[16px]">
                      <span className="text-paper-dim">{dateLabel(w.date, today)}</span>
                      <span className="font-num text-[19px] font-bold">
                        {w.kg.toString().replace(".", ",")} kg
                        {d !== null && d !== 0 && <span className="ml-2 text-[14px] font-medium text-paper-dim">{d > 0 ? "+" : ""}{d.toString().replace(".", ",")}</span>}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </section>

      {/* ───── Registro por ejercicio ───── */}
      <section className="mt-9" aria-labelledby="reg">
        <h2 id="reg" className="font-slab text-2xl">
          Registro de pesas por ejercicio
        </h2>
        {memory.length === 0 ? (
          <p className="mt-2 text-[15px] text-paper-dim">Cuando completes tus primeras sesiones, aquí queda anotada la pesa que usas en cada ejercicio y tu mejor serie.</p>
        ) : (
          <ul className="mt-2 divide-y divide-seam">
            {memory
              .sort((a, b) => b[1].lastDayIndex - a[1].lastDayIndex)
              .map(([id, m]) => (
                <li key={id} className="py-3">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{EXERCISES[id].nameEs}</span>
                    <span className="font-num text-[18px] font-bold text-ink-lift">{m.bellKg} kg</span>
                  </p>
                  <p className="text-[14px] text-paper-dim">
                    {m.bestReps > 0 ? `Mejor serie: ${m.bestBellKg} kg × ${m.bestReps}` : "Aún sin mejor serie"}
                    {m.stage > 0 && m.stage < 4 ? ` · mezclando ${m.stage}/4 con la pesa siguiente` : ""}
                    {m.stage >= 4 ? " · listo para subir de pesa" : ""}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>

      {/* ───── Revisión mensual ───── */}
      <section className="mt-9" aria-labelledby="mensual">
        <h2 id="mensual" className="font-slab text-2xl">
          Revisión mensual
        </h2>
        <p className="mt-1 text-[15px] text-paper-dim">
          Una vez al mes (al empezar cada ciclo de 4 semanas) revisa si tu pesa de referencia sigue siendo la correcta.
          {body?.bellsCheckedAt ? ` Última revisión: ${dateLabel(body.bellsCheckedAt, today).toLowerCase()}.` : ""}
        </p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => body && save({ body: { ...body, bellsCheckedAt: today } })}
          disabled={!body}
        >
          Ya revisé mis pesas
        </Button>
        {!body && <p className="mt-2 text-[14.5px] text-paper-dim">Guarda tu estatura y peso para activar los recordatorios.</p>}
      </section>

      <EvidenceSheet open={evidence} onClose={() => setEvidence(false)} ids={WEIGH_EVIDENCE} title="Estudios sobre pesarse" />
    </div>
  );
}
