"use client";

import { InstructorPicker } from "@/components/figure3d/InstructorPicker";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { BroBell } from "@/components/ui/BroBell";
import { Button } from "@/components/ui/Button";
import { OptionCard, Switch, ToggleChip } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { BodyFields, RecommendationPanel, parseBody } from "@/components/BodyPanel";
import { addWeight, recommendBells } from "@/lib/engine/body";
import { localDateKey } from "@/lib/engine/defaults";
import type { Focus, Level, PrimaryGoal, UserSettings } from "@/lib/engine/types";

const BELL_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];
const SUGGEST_REF: Record<Level, number> = { novice: 10, intermediate: 16, advanced: 24 };

type StepId = "coach" | "safety" | "level" | "goal" | "time" | "body" | "bells" | "cues";
const STEP_FOCUS: Record<StepId, Focus> = { coach: "skill", safety: "hybrid", level: "power", goal: "strength", time: "endurance", body: "recovery", bells: "skill", cues: "power" };
const EASE = [0.16, 1, 0.3, 1] as const;

const LEVELS: Array<{ id: Level; title: string; text: string }> = [
  { id: "novice", title: "Novato", text: "Casi no he usado pesa rusa. Quiero aprender la técnica bien desde el inicio." },
  { id: "intermediate", title: "Intermedio", text: "Hago swings, sentadillas goblet y press con buena técnica." },
  { id: "advanced", title: "Avanzado", text: "Clean, snatch y get-up con confianza y pesas pesadas." },
];
const GOALS: Array<{ id: PrimaryGoal; title: string; text: string; badge?: string }> = [
  { id: "balanced", title: "Equilibrado", text: "Fuerza, potencia y resistencia rotando por mes.", badge: "Recomendado" },
  { id: "strength", title: "Fuerza", text: "Más meses dedicados a empujar, tirar y sentadillas pesadas." },
  { id: "power", title: "Potencia", text: "Más trabajo explosivo de cadera: swings, cleans, snatches." },
  { id: "endurance", title: "Resistencia", text: "Más trabajo cardiovascular y de series largas con pesa." },
];
const TIMES: Array<{ id: UserSettings["minutes"]; title: string; text: string; badge?: string }> = [
  { id: 10, title: "10 min", text: "Exprés: lo mínimo útil para mantener el hábito en días apretados." },
  { id: 15, title: "15 min", text: "Rápida: calentamiento corto y un bloque bien hecho." },
  { id: 20, title: "20 min", text: "Estándar: el equilibrio ideal entre efecto y constancia.", badge: "Recomendado" },
  { id: 25, title: "25 min", text: "Completa: un bloque más. Es el máximo: lo corto y constante rinde." },
];

export function OnboardingFlow({
  initial,
  mode = "onboarding",
  onDone,
  onCancel,
}: {
  initial: UserSettings;
  mode?: "onboarding" | "edit";
  onDone: (s: UserSettings) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const steps: StepId[] = mode === "onboarding" ? ["coach", "safety", "level", "goal", "time", "body", "bells", "cues"] : ["level", "goal", "time", "body", "bells", "cues"];
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const [s, setS] = useState<UserSettings>(initial);
  const [flagChest, setFlagChest] = useState(false);
  const [flagDoctor, setFlagDoctor] = useState(false);
  const [consulted, setConsulted] = useState(false);
  const [bells, setBells] = useState<number[]>(initial.bells);
  const [pairs, setPairs] = useState(Boolean(initial.hasPairs));
  const [refTouched, setRefTouched] = useState(mode === "edit");
  const lastW = initial.body?.weights[initial.body.weights.length - 1]?.kg;
  const [heightStr, setHeightStr] = useState(initial.body ? String(initial.body.heightCm) : "");
  const [weightStr, setWeightStr] = useState(lastW ? String(lastW) : "");
  const parsed = parseBody(heightStr, weightStr);
  const rec = useMemo(() => (parsed ? recommendBells({ weightKg: parsed.weightKg, heightCm: parsed.heightCm, level: s.level }) : null), [parsed?.weightKg, parsed?.heightCm, s.level]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = steps[i] as StepId;
  const redFlag = flagChest || flagDoctor;

  const suggested = useMemo(() => {
    const target = rec ? rec.referenceKg : SUGGEST_REF[s.level];
    return bells.length ? bells.reduce((best, b) => (Math.abs(b - target) < Math.abs(best - target) ? b : best), bells[0] as number) : target;
  }, [bells, s.level, rec]);
  const referenceKg = refTouched && bells.includes(s.referenceKg) ? s.referenceKg : suggested;

  const canNext =
    step === "safety"
      ? !redFlag || consulted
      : step === "bells"
        ? bells.length > 0
        : step === "body"
          ? (heightStr === "" && weightStr === "") || Boolean(parsed)
          : true;

  const go = (d: number) => {
    setDir(d);
    setI((x) => Math.min(steps.length - 1, Math.max(0, x + d)));
  };

  async function finish() {
    setSaving(true);
    try {
      const today = localDateKey();
      let body = s.body;
      if (parsed) {
        const base = { heightCm: parsed.heightCm, weights: s.body?.weights ?? [], ...(s.body?.bellsCheckedAt ? { bellsCheckedAt: s.body.bellsCheckedAt } : {}) };
        const lastKg = base.weights[base.weights.length - 1]?.kg;
        body = lastKg === parsed.weightKg ? base : addWeight(base, today, parsed.weightKg);
        if (!body.bellsCheckedAt) body = { ...body, bellsCheckedAt: today };
      }
      await onDone({
        ...s,
        ...(body ? { body } : {}),
        bells: [...bells].sort((a, b) => a - b),
        hasPairs: pairs,
        referenceKg,
        onboardedAt: s.onboardedAt ?? Date.now(),
      });
    } finally {
      setSaving(false);
    }
  }

  const last = i === steps.length - 1;

  return (
    <main data-focus={STEP_FOCUS[step]} className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6 pt-safe">
      <header className="flex items-center gap-3 pt-4">
        <button
          type="button"
          onClick={() => {
            if (i > 0) go(-1);
            else if (mode === "onboarding") setExitOpen(true);
            else onCancel?.();
          }}
          aria-label={i === 0 ? "Salir" : "Paso anterior"}
          className="press grid h-11 w-11 place-items-center rounded-full bg-night-2"
        >
          <Icon name={i === 0 ? "x" : "back"} size={22} />
        </button>
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label="Progreso">
          {steps.map((id, k) => (
            <span key={id} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${k <= i ? "bg-ink" : "bg-night-3"}`} />
          ))}
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden pb-24 pt-6">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.section
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 36 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -36 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="space-y-5"
          >
            {step === "coach" && (
              <>
                <Heading title="Elige a tu instructor" sub="Te muestra cada ejercicio, de lado, de frente y en tres cuartos. Puedes cambiarlo cuando quieras en Perfil." mood="hype" />
                <InstructorPicker />
              </>
            )}

            {step === "safety" && (
              <>
                <Heading title="Antes de empezar" sub="Tres preguntas rápidas para entrenarte con seguridad." mood="idle" />
                <div className="space-y-2.5" role="group" aria-label="Preguntas de seguridad">
                  <Switch tone="warn" checked={flagChest} onChange={setFlagChest} label="Siento dolor en el pecho, mareos o falta de aire con esfuerzo leve." />
                  <Switch tone="warn" checked={flagDoctor} onChange={setFlagDoctor} label="Un profesional de salud me indicó evitar el ejercicio intenso o con pesas." />
                  <Switch
                    checked={Boolean(s.lowBackCare)}
                    onChange={(v) => setS({ ...s, lowBackCare: v })}
                    label="Tengo dolor o molestias en la espalda baja."
                    description="Adaptamos tus rutinas: sin ejercicios balísticos como el swing."
                  />
                </div>
                {redFlag && (
                  <div role="alert" className="rounded-[16px] border-2 border-[#ff5f6d] bg-[#3a1424] p-4 text-[15px]">
                    <p className="font-slab text-lg">Consulta primero a un profesional</p>
                    <p className="mt-1 text-paper-dim">
                      kettellbro no sustituye el consejo médico. Si tienes alguna de estas señales, habla con un profesional de salud antes de entrenar con
                      pesas.
                    </p>
                    <label className="mt-3 flex items-start gap-3 text-[15px]">
                      <input type="checkbox" checked={consulted} onChange={(e) => setConsulted(e.target.checked)} className="mt-1 h-5 w-5 accent-[#ff5f6d]" />
                      Ya lo consulté y puedo entrenar.
                    </label>
                  </div>
                )}
              </>
            )}

            {step === "level" && (
              <>
                <Heading title="¿Qué nivel tienes?" sub="Define qué ejercicios aparecen y cuánta carga empezamos." mood="wink" />
                <div className="space-y-2.5" role="radiogroup" aria-label="Nivel">
                  {LEVELS.map((l) => (
                    <OptionCard key={l.id} selected={s.level === l.id} onSelect={() => setS({ ...s, level: l.id })} title={l.title} description={l.text} />
                  ))}
                </div>
              </>
            )}

            {step === "goal" && (
              <>
                <Heading title="¿Qué buscas?" sub="Tu meta inclina el calendario; nunca descuida los demás patrones." mood="hype" />
                <div className="space-y-2.5" role="radiogroup" aria-label="Meta">
                  {GOALS.map((g) => (
                    <OptionCard key={g.id} selected={s.primaryGoal === g.id} onSelect={() => setS({ ...s, primaryGoal: g.id })} title={g.title} description={g.text} badge={g.badge} />
                  ))}
                </div>
              </>
            )}

            {step === "time" && (
              <>
                <Heading title="¿Cuánto tiempo tienes?" sub="Incluye calentamiento. Con volumen bajo ya hay ganancias de fuerza: mejor corto y todos los días." mood="idle" />
                <div className="space-y-2.5" role="radiogroup" aria-label="Duración">
                  {TIMES.map((t) => (
                    <OptionCard key={t.id} selected={s.minutes === t.id} onSelect={() => setS({ ...s, minutes: t.id })} title={t.title} description={t.text} badge={t.badge} />
                  ))}
                </div>
              </>
            )}

            {step === "body" && (
              <>
                <Heading title="Tu cuerpo" sub="Con tu peso y estatura te sugerimos qué pesas usar. Es opcional: puedes saltarlo." mood="idle" />
                <BodyFields height={heightStr} weight={weightStr} onHeight={setHeightStr} onWeight={setWeightStr} />
                {rec ? (
                  <RecommendationPanel rec={rec} />
                ) : (
                  <p className="rounded-[16px] bg-night-2 p-4 text-[15px] text-paper-dim">Si prefieres no dar estos datos, empezamos con una pesa según tu nivel y la ajustamos con tu esfuerzo en cada sesión.</p>
                )}
                {parsed && (
                  <p className="text-[14.5px] leading-snug text-paper-dim">
                    Plan de pesaje: una vez por semana, el mismo día, en ayunas. La app te lo recordará dentro de tu plan y cada mes revisarás tus pesas.
                  </p>
                )}
              </>
            )}

            {step === "bells" && (
              <>
                <Heading title="¿Qué pesas tienes?" sub="Solo te mandaremos ejercicios con las pesas que marques (kg)." mood="idle" />
                {rec && (
                  <button
                    type="button"
                    onClick={() => setBells((b) => Array.from(new Set([...b, ...rec.starterSet])).sort((x, y) => x - y))}
                    className="press w-full rounded-[14px] border-2 border-dashed border-ink-lift/70 px-4 py-3 text-left text-[15px]"
                  >
                    <span className="font-slab">Set sugerido para tu cuerpo: {rec.starterSet.join(" + ")} kg.</span> Toca para marcarlo si ya lo tienes.
                  </button>
                )}
                <div className="flex flex-wrap gap-2" role="group" aria-label="Pesas disponibles">
                  {BELL_SIZES.map((kg) => (
                    <ToggleChip key={kg} on={bells.includes(kg)} onToggle={() => setBells((b) => (b.includes(kg) ? b.filter((x) => x !== kg) : [...b, kg].sort((x, y) => x - y)))}>
                      {kg}
                    </ToggleChip>
                  ))}
                </div>
                <Switch checked={pairs} onChange={setPairs} label="Tengo dos pesas iguales" description="Habilita ejercicios de dos pesas, como el acarreo de granjero." />
                {bells.length > 0 && (
                  <div className="rounded-[16px] bg-night-2 p-4">
                    <p className="font-slab text-lg leading-tight">Tu pesa de referencia</p>
                    <p className="mt-1 text-sm text-paper-dim">
                      La más pesada con la que haces 10 swings a dos manos con buena técnica y la última repetición igual que la primera. Si el agarre
                      falla antes de la repetición 10 o se redondea la espalda, es demasiado pesada. Elige una más ligera: se ajusta sola con tu RPE.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Pesa de referencia">
                      {bells.map((kg) => (
                        <button
                          key={kg}
                          type="button"
                          role="radio"
                          aria-checked={referenceKg === kg}
                          onClick={() => {
                            setRefTouched(true);
                            setS({ ...s, referenceKg: kg });
                          }}
                          className={`press h-12 min-w-[64px] rounded-[14px] border-2 px-3 font-num text-[17px] font-bold ${
                            referenceKg === kg ? "border-ink bg-ink text-on-ink" : "border-seam text-paper-dim"
                          }`}
                        >
                          {kg} kg
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {step === "cues" && (
              <>
                <Heading title="Tu acompañante" sub="Cómo quieres que te guíe durante cada serie." mood="fire" />
                <div className="space-y-2.5">
                  <Switch checked={s.sound} onChange={(v) => setS({ ...s, sound: v })} label="Sonidos" description="Pitidos de cuenta atrás y metrónomo de cadencia." />
                  <Switch checked={s.voice} onChange={(v) => setS({ ...s, voice: v })} label="Voz del coach" description="Te dice qué sigue y repite los cues de técnica." />
                  <Switch checked={s.haptics} onChange={(v) => setS({ ...s, haptics: v })} label="Vibración" description="Un toque en cada cambio de serie (en celulares compatibles)." />
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <Sheet open={exitOpen} onClose={() => setExitOpen(false)} title="¿Salir de la configuración?" tone={STEP_FOCUS[step]}>
        <p className="text-[15.5px] text-paper-dim">Tus respuestas se guardan al final. Puedes volver cuando quieras entrando de nuevo con Google.</p>
        <div className="mt-5 grid gap-3">
          <Button size="lg" onClick={() => setExitOpen(false)}>
            Seguir configurando
          </Button>
          <Button variant="secondary" onClick={() => onCancel?.()}>
            Cerrar sesión
          </Button>
        </div>
      </Sheet>

      <footer className="sticky bottom-0 -mx-5 mt-4 bg-gradient-to-t from-night via-night/95 to-transparent px-5 pb-safe pt-6">
        <Button size="lg" className="w-full" disabled={!canNext || saving} onClick={() => (last ? void finish() : go(1))}>
          {last ? (mode === "edit" ? "Guardar cambios" : saving ? "Creando tu Día 1…" : "Crear mi Día 1") : "Siguiente"}
        </Button>
      </footer>
    </main>
  );
}

function Heading({ title, sub, mood }: { title: string; sub: string; mood: "idle" | "wink" | "hype" | "fire" }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="font-slab text-[32px] leading-[1.05] text-balance">{title}</h1>
        <p className="mt-2 text-[16px] text-paper-dim">{sub}</p>
      </div>
      <BroBell mood={mood} size={74} className="shrink-0" />
    </div>
  );
}
