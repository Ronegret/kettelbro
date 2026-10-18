"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { useReadyProgram } from "@/components/RequireProgram";
import { FigureAuto } from "@/components/figure3d/FigureAuto";
import { PhaseBeats } from "@/components/figure3d/PhaseBeats";
import { setPhase as setBeatPhase } from "@/components/figure3d/phaseBus";
import { useCharacter } from "@/components/figure3d/prefs";
import { ViewSwitch } from "@/components/figure3d/ViewSwitch";
import { Button } from "@/components/ui/Button";
import { HoldToConfirm } from "@/components/ui/HoldToConfirm";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { countBeep, goBeep, keepAwake, speak, stopSpeaking, tick, vibrate, type CueSettings } from "@/lib/cues";
import { localDateKey } from "@/lib/engine/defaults";
import { EXERCISES } from "@/lib/engine/exercises";
import { newlyCompleted } from "@/lib/engine/goals";
import { finishSession, logFromStep } from "@/lib/engine/progression";
import { compileSteps, stepDurationSec } from "@/lib/engine/steps";
import { planForToday } from "@/lib/engine";
import { ENGINE_VERSION } from "@/lib/config";
import type { Feel, SessionPlan, SetLog, Step, WorkStep } from "@/lib/engine/types";
import { fmtClock } from "@/lib/format";
import { Celebration, type CelebrationResult } from "./Celebration";
import { FinishView } from "./FinishView";
import { InfoSheet } from "./InfoSheet";
import { Timeline } from "./Timeline";
import { useCountdown } from "./useCountdown";

type Phase = "run" | "finish" | "done";
const SIDE_LABEL = { left: "Izquierda", right: "Derecha", both: "" } as const;
const ROLE_ES: Record<Step["role"], string> = {
  warmup: "calentamiento",
  primary: "principal",
  secondary: "complemento",
  finisher: "remate",
  cooldown: "vuelta a la calma",
};

/** ¿Este paso arranca con una cuenta de preparación? La fija el motor (`prepSec`) y cuenta dentro del tiempo de la sesión. */
const hasPrep = (s: Step | undefined): boolean => Boolean(s && s.kind === "work" && (s.prepSec ?? 0) > 0);

/** Índice del ejercicio de un complejo que toca según el tiempo transcurrido de la ronda. */
function sequenceIndex(seq: NonNullable<WorkStep["sequence"]>, elapsedSec: number): number {
  let acc = 0;
  for (let i = 0; i < seq.length; i++) {
    acc += (seq[i]?.reps ?? 0) * Math.max(2, EXERCISES[seq[i]!.exerciseId].secPerRep);
    if (elapsedSec < acc) return i;
  }
  return seq.length - 1;
}

export function SessionPlayer() {
  const p = useReadyProgram();
  const router = useRouter();

  // El plan se congela al entrar: si el usuario cambia ajustes a mitad, la sesión no cambia.
  // Un borrador de una versión anterior del motor (pasos sin tiempo) no se puede retomar con fidelidad: se descarta.
  const init = useMemo(() => {
    const d = p.draft;
    const draft = d && d.plan.dayIndex === p.state.dayIndex && (d.plan.engineVersion ?? 0) >= ENGINE_VERSION ? d : null;
    const plan: SessionPlan = draft ? draft.plan : planForToday(p.user.uid, p.state, p.settings, localDateKey());
    return { plan, startedAt: draft?.startedAt ?? Date.now(), idx: draft?.stepIndex ?? 0, sets: draft?.sets ?? [], resumed: Boolean(draft) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { plan } = init;
  const steps = useMemo(() => compileSteps(plan), [plan]);
  const startedAt = init.startedAt;
  const startIdx = Math.min(init.idx, steps.length - 1);

  const [phase, setPhase] = useState<Phase>("run");
  const [idx, setIdx] = useState(startIdx);
  const [stage, setStage] = useState<"prep" | "main">(() => (hasPrep(steps[startIdx]) && !init.resumed ? "prep" : "main"));
  const [sets, setSets] = useState<SetLog[]>(init.sets);
  const [paused, setPaused] = useState(init.resumed);
  const [sheet, setSheet] = useState<"exit" | "info" | "evidence" | null>(null);
  const [muted, setMuted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CelebrationResult | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [awakeOk, setAwakeOk] = useState(true);

  const step = (steps[Math.min(idx, steps.length - 1)] ?? steps[0]) as Step;
  const block = plan.blocks.find((b) => b.id === step.blockId);
  const ex = EXERCISES[step.exerciseId];
  const isRest = step.kind === "rest";
  const work = step.kind === "work" ? (step as WorkStep) : null;
  // El instructor elegido pone la voz: mujer con Princess, hombre con Bro.
  const character = useCharacter();
  const cs: CueSettings = useMemo(
    () => ({ sound: p.settings.sound && !muted, voice: p.settings.voice && !muted, haptics: p.settings.haptics && !muted, gender: character === "princess" ? "female" : "male" }),
    [p.settings.sound, p.settings.voice, p.settings.haptics, muted, character],
  );

  // Segundos añadidos con «+10 s» en el paso actual (se suman a lo que queda de la sesión y al registro de la serie).
  const addedRef = useRef(0);

  // Mantener la pantalla encendida durante la sesión
  useEffect(() => {
    let release = () => {};
    let cancelled = false;
    void keepAwake().then((r) => {
      if (cancelled) r.release();
      else {
        release = r.release;
        setAwakeOk(r.ok);
      }
    });
    return () => {
      cancelled = true;
      release();
      stopSpeaking();
    };
  }, []);

  // Guardar borrador tras cada paso (si cierran la app, «Continuar sesión» retoma exactamente aquí)
  useEffect(() => {
    if (phase !== "run") return;
    p.saveDraft({ plan, startedAt, stepIndex: idx, sets, updatedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, sets, phase]);

  // ───────────── Avance ─────────────
  const goNext = useCallback(
    (log?: SetLog) => {
      if (log) setSets((s) => [...s, log]);
      const n = idx + 1;
      addedRef.current = 0;
      if (n >= steps.length) {
        setEndedAt(Date.now());
        setPhase("finish");
        return;
      }
      setIdx(n);
      setStage(hasPrep(steps[n]) ? "prep" : "main");
    },
    [idx, steps],
  );

  const onTimerDone = useCallback(() => {
    if (stage === "prep") {
      setStage("main");
      goBeep(cs);
      vibrate(cs, 60);
      return;
    }
    // El tiempo manda: al llegar a cero el paso está hecho tal como se prescribió. Nadie tiene que confirmarlo.
    if (work) goNext(logFromStep(work, work.targetReps ?? 0, (work.durationSec ?? 0) + addedRef.current));
    else goNext();
  }, [stage, work, goNext, cs]);

  const timerDuration = stage === "prep" ? (work?.prepSec ?? 0) : isRest ? (step as { durationSec: number }).durationSec : (work?.durationSec ?? 0);
  const timerOn = phase === "run" && !paused && timerDuration > 0;
  const cd = useCountdown({
    key: `${idx}-${stage}`,
    durationSec: timerDuration,
    running: timerOn,
    onDone: onTimerDone,
    onSecond: (s) => {
      if (s >= 1 && s <= 3) {
        countBeep(cs);
        vibrate(cs, 15);
      }
    },
  });

  // Tiempo transcurrido del trabajo (incluye los segundos añadidos): de aquí salen las repeticiones y las etapas.
  const elapsed = work && stage === "main" ? Math.max(0, (work.durationSec ?? 0) + addedRef.current - cd.remaining) : 0;

  // Repeticiones guiadas por el reloj: cada una dura lo que dura en ese ejercicio (cadencia), sin contador manual.
  const repLen = work && work.countReps && !work.sequence && work.targetReps && work.secPerRep ? Math.max(2, work.secPerRep) : 0;
  const targetReps = work?.targetReps ?? 0;
  const repsDone = repLen ? Math.min(targetReps, Math.floor(elapsed / repLen)) : 0;
  const repsFinished = repLen > 0 && repsDone >= targetReps;
  const repShown = repLen ? Math.min(targetReps, repsDone + 1) : 0;

  // Etapas del get-up (y de cualquier ejercicio lento con etapas): cambian solas según el reloj.
  const stages = repLen > 12 ? ex.stagesEs : undefined;
  const stageI = stages && !repsFinished ? Math.min(stages.length - 1, Math.floor(((elapsed % repLen) / repLen) * stages.length)) : -1;

  // Voz y vibración al empezar cada paso
  useEffect(() => {
    if (phase !== "run" || paused) return;
    if (stage === "prep") {
      if (work?.prepLabelEs === "Cambia de lado") speak(cs, `Cambia de lado. ${SIDE_LABEL[work.side].toLowerCase()}`);
      else if ((work?.prepSec ?? 0) >= 5) speak(cs, `Prepárate. ${EXERCISES[step.exerciseId].nameEs}`);
      return;
    }
    if (isRest) {
      speak(cs, `Descansa. Siguiente: ${(step as { nextTitleEs: string }).nextTitleEs.toLowerCase()}`);
      vibrate(cs, [25, 45, 25]);
    } else if (work) {
      const side = SIDE_LABEL[work.side];
      speak(cs, `${work.titleEs.toLowerCase()}. ${work.bellKg} kilos${side ? `. ${side}` : ""}`);
      vibrate(cs, 45);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, stage, phase, paused]);

  // Cue de técnica a mitad de los pasos largos
  useEffect(() => {
    if (!work || stage !== "main" || paused || !work.durationSec || work.durationSec < 40) return;
    const t = window.setTimeout(() => speak(cs, ex.cues[idx % ex.cues.length] ?? "", { interrupt: false }), work.durationSec * 0.45 * 1000);
    return () => window.clearTimeout(t);
  }, [idx, stage, paused, work, ex, cs]);

  // Metrónomo: un toque por cada repetición que termina (solo si el ejercicio tiene cadencia marcable)
  const ticks = Boolean(work?.repEverySec && repLen);
  useEffect(() => {
    if (!ticks || stage !== "main" || paused || phase !== "run" || repsDone === 0 || repsDone > targetReps) return;
    tick(cs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repsDone]);

  // El nombre de la etapa del get-up se dice al cambiar
  useEffect(() => {
    if (!stages || stageI < 0 || stage !== "main" || paused || phase !== "run") return;
    speak(cs, (stages[stageI] ?? "").split(":")[0] ?? "", { interrupt: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageI]);

  // Rotación de cues en pantalla
  const [cueI, setCueI] = useState(0);
  useEffect(() => {
    setCueI(0);
    const id = window.setInterval(() => setCueI((c) => c + 1), 7000);
    return () => window.clearInterval(id);
  }, [idx]);

  // Figura del complejo: recorre los ejercicios de la ronda según el reloj
  const seqIdx = work?.sequence ? sequenceIndex(work.sequence, elapsed) : 0;
  const figureId = work?.sequence ? (work.sequence[seqIdx]?.exerciseId ?? step.exerciseId) : step.exerciseId;
  // En descanso se muestra el ejercicio que viene
  const nextWork = isRest ? (steps.slice(idx + 1).find((s) => s.kind === "work") as WorkStep | undefined) : undefined;
  const shownExercise = isRest ? (nextWork?.exerciseId ?? step.exerciseId) : figureId;

  // ───────────── Acciones ─────────────
  const skip = () => {
    if (work) goNext(logFromStep(work, 0, undefined, true));
    else goNext();
  };
  const addTime = (n: number) => {
    addedRef.current += n;
    cd.addSeconds(n);
  };

  const finishEarly = () => {
    setSheet(null);
    setEndedAt(Date.now());
    setPhase("finish");
  };

  const discard = async () => {
    setSheet(null);
    stopSpeaking();
    await p.clearDraft();
    router.replace("/hoy");
  };

  const tonnage = useMemo(() => Math.round(sets.reduce((a, s) => a + (s.skipped ? 0 : s.reps * s.bellKg * EXERCISES[s.exerciseId].bells), 0)), [sets]);
  const durationSec = Math.max(60, Math.round(((endedAt ?? Date.now()) - startedAt) / 1000));

  async function save(rpe: number, feel: Feel) {
    setSaving(true);
    try {
      const now = endedAt ?? Date.now();
      const prevState = p.state;
      const { log, next, streak: st } = finishSession({ state: prevState, settings: p.settings, plan, sets, rpe, feel, startedAt, endedAt: now, date: localDateKey() });
      const newGoals = newlyCompleted(next, p.completedGoalIds, now);
      // Récords personales: pesa más alta, o más repeticiones con la misma pesa
      const prs: string[] = [];
      for (const [id, mem] of Object.entries(next.memory)) {
        const before = prevState.memory[id as keyof typeof prevState.memory];
        if (!mem || mem.bestReps === 0) continue;
        const improved = !before || mem.bestBellKg > before.bestBellKg || (mem.bestBellKg === before.bestBellKg && mem.bestReps > before.bestReps);
        if (improved && before) prs.push(`${EXERCISES[id as keyof typeof EXERCISES].nameEs}: ${mem.bestReps} reps con ${mem.bestBellKg} kg.`);
      }
      await p.completeSession(log, next, newGoals);
      stopSpeaking();
      speak(cs, "Sesión completa. Buen trabajo.");
      setResult({ log, next, newGoals, prs: prs.slice(0, 3), prevXp: prevState.xp, usedShield: st.usedShield, earnedShield: st.earnedShield });
      setPhase("done");
    } finally {
      setSaving(false);
    }
  }

  // Lo que falta de la sesión, al segundo: el paso en curso (con su preparación si aún no empezó) + todos los siguientes.
  const remainingTotal = useMemo(() => {
    const after = steps.slice(idx + 1).reduce((a, s) => a + stepDurationSec(s), 0);
    const mainLeft = stage === "prep" && work ? (work.durationSec ?? 0) : 0;
    return after + mainLeft + cd.remaining;
  }, [steps, idx, stage, work, cd.remaining]);

  // ───────────── Render ─────────────
  if (phase === "finish") {
    return (
      <FinishView
        plan={plan}
        sets={sets}
        durationSec={durationSec}
        tonnageKg={tonnage}
        saving={saving}
        onSave={(r, f) => void save(r, f)}
        onBack={() => {
          setEndedAt(null);
          setPaused(true);
          setPhase("run");
        }}
      />
    );
  }
  if (phase === "done" && result) {
    return <Celebration plan={plan} settings={p.settings} result={result} onClose={() => router.replace("/hoy")} />;
  }

  const bg = isRest ? "bg-ink-deep" : "bg-ink";
  const fg = isRest ? "text-paper" : "text-on-ink";
  const remainingWhole = Math.ceil(cd.remaining);
  const frac = Math.min(1, Math.max(0, cd.fraction));
  const cue = ex.cues[cueI % ex.cues.length];
  // Todo escala con el alto disponible: en un teléfono de 640 px de alto la pantalla debe seguir cabiendo.
  const figureSize = "var(--fig)";
  const nextExercise = isRest ? EXERCISES[shownExercise] : null;
  const restOfEmom = Boolean(work?.emom && repsFinished);
  const blockNo = Math.max(1, plan.blocks.findIndex((b) => b.id === step.blockId) + 1);

  return (
    <main data-focus={plan.focus} className={`${bg} ${fg} fixed inset-0 flex flex-col overflow-hidden pt-safe transition-colors duration-500`}>
      {/* ───── Cabecera ───── */}
      <header className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-3">
        <button type="button" onClick={() => { setPaused(true); setSheet("exit"); }} aria-label="Salir de la sesión" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-night/35">
          <Icon name="x" size={22} />
        </button>
        <Timeline plan={plan} steps={steps} index={idx} />
        <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Activar sonido" : "Silenciar"} aria-pressed={muted} className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-night/35">
          <Icon name={muted ? "mute" : "volume"} size={22} />
        </button>
      </header>
      {!awakeOk && (
        <p role="note" className="mx-auto mt-2 w-[calc(100%-2.5rem)] max-w-md rounded-xl bg-night/45 px-4 py-2 text-center text-[13.5px] leading-snug text-paper">
          Tu pantalla puede apagarse. Pon el bloqueo automático en «Nunca» durante la sesión.
        </p>
      )}
      <p className="mx-auto flex w-full max-w-md flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-5 pt-2 text-center text-[14px] font-medium opacity-95" aria-live="off">
        <span>
          Bloque {blockNo} de {plan.blocks.length} · {ROLE_ES[step.role]}
        </span>
        <span className="font-num font-bold tabular-nums">Quedan {fmtClock(Math.ceil(remainingTotal))}</span>
      </p>

      {/* ───── Cuerpo: un solo mensaje monumental ───── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={`${idx}-${stage}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center gap-2 overflow-y-auto px-5 text-center [&>:first-child]:mt-auto [&>:last-child]:mb-auto"
        >
          {stage === "prep" && work ? (
            <>
              <p className="font-slab text-2xl">{work.prepLabelEs ?? "Prepárate"}</p>
              <p key={remainingWhole} className="heat-num num-pop text-[clamp(72px,13dvh,120px)] leading-none" style={{ ["--heat" as string]: 1 }} aria-live="assertive">
                {Math.max(1, remainingWhole)}
              </p>
              <div className="relative min-h-[170px] w-full flex-[1_1_240px] overflow-hidden rounded-[26px] bg-night/25">
                <div className="absolute inset-x-0 bottom-11 top-0">
                  <FigureAuto exerciseId={shownExercise} size="100%" playing={!paused} repSec={ex.secPerRep > 0 ? ex.secPerRep : undefined} showGround ghosts side={work.side} onPhase={setBeatPhase} />
                </div>
                <div className="absolute inset-x-2 bottom-2 flex justify-center">
                  <PhaseBeats exerciseId={shownExercise} active={!paused} />
                </div>
              </div>
              <p className="text-lg opacity-95">
                {ex.nameEs} · {work.bellKg} kg{SIDE_LABEL[work.side] ? ` · ${SIDE_LABEL[work.side]}` : ""}
              </p>
            </>
          ) : isRest ? (
            <>
              <p className="font-slab text-[30px] caps">Descansa</p>
              <p key={remainingWhole <= 3 ? remainingWhole : "steady"} className={`heat-num text-[clamp(64px,13dvh,104px)] leading-none ${remainingWhole <= 3 ? "tick-pulse" : ""}`} style={{ ["--heat" as string]: 0.35 }} aria-live="off">
                {fmtClock(remainingWhole)}
              </p>
              <div className="mt-1" style={{ width: figureSize, height: figureSize }}>
                <FigureAuto exerciseId={shownExercise} size="100%" playing={false} showGround={false} tone="light" />
              </div>
              <p className="font-slab text-[26px] leading-tight">Sigue: {nextExercise?.nameEs}</p>
              <p className="text-[17px] opacity-90">{(step as { nextTitleEs: string }).nextTitleEs.replace(`${nextExercise?.nameEs ?? ""} · `, "")}</p>
            </>
          ) : (
            work && (
              <>
                {/* ESCENARIO: la demostración es lo primero que se ve y se lleva todo el alto que sobra */}
                <div className="relative min-h-[190px] w-full flex-[1_1_270px] overflow-hidden rounded-[26px] bg-night/25">
                  <div className="absolute inset-x-0 bottom-11 top-0" style={{ animation: ticks && !repsFinished && !paused ? `pulse-beat ${repLen}s ease-out infinite` : undefined }}>
                    <FigureAuto exerciseId={figureId} size="100%" playing={!paused && !repsFinished} repSec={ex.secPerRep > 0 ? ex.secPerRep : undefined} showGround ghosts side={work.side} onPhase={setBeatPhase} />
                  </div>
                  {SIDE_LABEL[work.side] ? (
                    <span className="absolute left-3 top-3 rounded-full bg-night/60 px-3 py-1 font-num text-[13px] font-extrabold caps text-paper">{SIDE_LABEL[work.side]}</span>
                  ) : null}
                  {/* cambio de ángulo: columna dentro del escenario (solo cuando se dibuja en 3D y hay alto de sobra) */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 [@media(max-height:700px)]:hidden">
                    <ViewSwitch exerciseId={figureId} orientation="rail" />
                  </div>
                  {/* las tres fases de la repetición, sincronizadas con la figura: para llevar el ritmo al imitar */}
                  {!restOfEmom && (
                    <div className="absolute inset-x-2 bottom-2 flex justify-center">
                      <PhaseBeats exerciseId={figureId} active={!paused && !repsFinished} />
                    </div>
                  )}
                </div>
                <h1 className="font-slab text-[clamp(22px,min(7vw,4dvh),30px)] leading-none text-balance">{restOfEmom ? "DESCANSA" : work.titleEs}</h1>
                <p className="text-[16px] font-medium opacity-95">{work.subtitleEs}</p>

                {/* Repeticiones (las cuenta el reloj, no el usuario) y tiempo, en una sola fila */}
                <div className={`flex w-full max-w-sm items-end gap-3 ${repLen > 0 && !restOfEmom ? "justify-between" : "justify-center"}`} aria-live="off">
                  {repLen > 0 && !restOfEmom ? (
                    <p className="flex items-baseline gap-1.5">
                      <span key={repShown} className="heat-num num-pop text-[clamp(40px,7dvh,56px)] leading-none" style={{ ["--heat" as string]: 0.85 }}>
                        {repShown}
                      </span>
                      <span className="font-num text-[18px] font-bold opacity-90">de {targetReps}</span>
                    </p>
                  ) : null}
                  <p className="heat-num text-[clamp(48px,9dvh,72px)] leading-none" style={{ ["--heat" as string]: Math.min(1, frac + 0.2) }}>
                    {fmtClock(remainingWhole)}
                  </p>
                </div>
                {stages && stageI >= 0 && (
                  <p className="max-w-xs text-[16px] leading-snug" aria-live="off">
                    <span className="font-num font-extrabold">
                      Etapa {stageI + 1} de {stages.length}.
                    </span>{" "}
                    {stages[stageI]}
                  </p>
                )}
                <div className="w-full max-w-sm" aria-live="off">
                  <div className="mx-auto h-3 w-full overflow-hidden rounded-full bg-night/35">
                    <div className="h-full rounded-full bg-paper" style={{ width: `${frac * 100}%`, transition: "width 120ms linear" }} />
                  </div>
                  {restOfEmom && <p className="mt-2 text-[17px] leading-snug">Listo. Respira: el próximo minuto empieza cuando el reloj llegue a cero.</p>}
                </div>

                {!stages && !restOfEmom && cue && <p className="max-w-xs text-[17px] leading-snug opacity-95">{cue}</p>}
                {work.sequence && (
                  <ul className="flex flex-wrap justify-center gap-2">
                    {work.sequence.map((it, k) => (
                      <li key={`${it.exerciseId}-${k}`} className={`rounded-full px-3 py-1 font-num text-[14px] font-bold ${k === seqIdx ? "bg-paper text-night" : "bg-night/35 text-paper"}`}>
                        {it.reps} {EXERCISES[it.exerciseId].shortEs}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )
          )}
        </motion.section>
      </AnimatePresence>

      {/* ───── Controles: zona del pulgar ───── */}
      <footer className="mx-auto w-full max-w-md px-5 pb-safe">
        <div className="space-y-3 pb-4">
          {paused ? (
            <Button variant="paper" size="lg" className="w-full" onClick={() => setPaused(false)} icon={<Icon name="play" size={22} />}>
              {init.resumed && idx === init.idx && sets.length === init.sets.length ? "Continuar" : "Seguir"}
            </Button>
          ) : isRest ? (
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Button variant="paper" size="lg" onClick={() => goNext()} icon={<Icon name="skip" size={22} />}>
                Saltar
              </Button>
              <button type="button" onClick={() => addTime(15)} className="press h-16 rounded-[18px] bg-night/45 px-5 font-num text-lg font-bold text-paper">
                +15 s
              </button>
            </div>
          ) : (
            <Button variant="secondary" size="lg" className="w-full !bg-night/35 !text-inherit" onClick={() => setPaused(true)} icon={<Icon name="pause" size={22} />}>
              Pausa
            </Button>
          )}

          <div className="flex items-center justify-between gap-2 text-[15px]">
            <button type="button" onClick={() => { setPaused(true); setSheet("info"); }} className="press inline-flex h-11 items-center gap-2 rounded-full bg-night/30 px-4 font-medium">
              <Icon name="info" size={18} /> Técnica
            </button>
            {!isRest && (
              <div className="flex items-center gap-1">
                {stage === "main" && (
                  <button type="button" onClick={() => addTime(10)} className="press inline-flex h-11 items-center rounded-full bg-night/30 px-4 font-num font-bold">
                    +10 s
                  </button>
                )}
                <button type="button" onClick={skip} className="press inline-flex h-11 items-center px-3 font-medium opacity-90">
                  Saltar
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* ───── Hojas ───── */}
      <InfoSheet open={sheet === "info"} onClose={() => setSheet(null)} exerciseId={step.exerciseId} block={block} focus={plan.focus} onEvidence={() => setSheet("evidence")} />
      <EvidenceSheet open={sheet === "evidence"} onClose={() => setSheet(null)} ids={block?.evidence ?? plan.evidence} title="Respaldo de este bloque" />
      <Sheet open={sheet === "exit"} onClose={() => setSheet(null)} title="¿Salir de la sesión?" tone={plan.focus}>
        <p className="text-[15.5px] text-paper-dim">Tu avance se guarda automáticamente. Puedes retomar justo donde vas desde Hoy.</p>
        <div className="mt-5 grid gap-3">
          <Button size="lg" onClick={() => { setSheet(null); router.replace("/hoy"); }}>
            Guardar y salir
          </Button>
          {sets.length > 0 && (
            <Button variant="secondary" onClick={finishEarly}>
              Terminar ahora y registrar lo hecho
            </Button>
          )}
          <Button variant="ghost" onClick={() => setSheet(null)}>
            Seguir entrenando
          </Button>
          <HoldToConfirm onConfirm={() => void discard()} hint="Mantén pulsado para confirmar">
            Descartar esta sesión
          </HoldToConfirm>
        </div>
      </Sheet>
    </main>
  );
}
