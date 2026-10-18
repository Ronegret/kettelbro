"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { PlanList } from "@/components/PlanList";
import { InstallCard } from "@/components/InstallCard";
import { ReminderCard } from "@/components/ReminderCard";
import { useReadyProgram } from "@/components/RequireProgram";
import { DayDeck } from "@/components/DayDeck";
import { FigureAuto } from "@/components/figure3d/FigureAuto";
import { InfoSheet } from "@/components/session/InfoSheet";
import type { WorkBlock } from "@/lib/engine/types";
import { useCharacter } from "@/components/figure3d/prefs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CardBack } from "@/components/ui/CardBack";
import { LoteriaCard } from "@/components/ui/LoteriaCard";
import { Sheet } from "@/components/ui/Sheet";
import { Tabla } from "@/components/ui/Tabla";
import { THEME_LABEL_ES, PHASE_LABEL_ES } from "@/lib/engine/calendar";
import { addWeight, daysBetween, dueCheckIns, finishRestDay, liveStreak, newlyCompleted, rankFor } from "@/lib/engine";
import { parseBody } from "@/components/BodyPanel";
import Link from "next/link";
import { cantoFor } from "@/lib/cantos";
import { firstName, nf, planHeadline } from "@/lib/format";
import { countBeep, goBeep, primeAudio, speak } from "@/lib/cues";
import { useTodayPlan } from "@/lib/useToday";

export default function Hoy() {
  const p = useReadyProgram();
  const router = useRouter();
  const { plan, resuming, today } = useTodayPlan(p.user.uid, p.state, p.settings, p.draft);
  const [sheet, setSheet] = useState<"evidence" | "rest" | "streak" | "handsfree" | "info" | null>(null);
  const [infoBlock, setInfoBlock] = useState<WorkBlock | null>(null);
  const [busy, setBusy] = useState(false);
  const character = useCharacter();
  const [flipped, setFlipped] = useState(false);
  const due = dueCheckIns(p.settings, today);
  const lastKg = p.settings.body?.weights[p.settings.body.weights.length - 1]?.kg;
  const [kgStr, setKgStr] = useState(lastKg ? String(lastKg) : "");
  const kgOk = p.settings.body ? parseBody(String(p.settings.body.heightCm), kgStr) : null;

  function saveWeighIn() {
    if (!p.settings.body || !kgOk) return;
    void p.saveSettings({ ...p.settings, body: addWeight(p.settings.body, today, kgOk.weightKg) });
  }
  function keepBells() {
    if (!p.settings.body) return;
    void p.saveSettings({ ...p.settings, body: { ...p.settings.body, bellsCheckedAt: today } });
  }

  const streak = liveStreak(p.state, today);
  const rank = rankFor(p.state.xp);
  const first = p.state.totals.sessions + p.state.totals.restDays === 0;
  const doneToday = p.state.lastSessionDate === today;
  const lead = plan.blocks.find((b) => b.role === "primary") ?? plan.blocks[0]!;
  const heat = Math.min(1, Math.max(0, (plan.rpeTarget - 3) / 6));
  // Escudos: se dice con todas las letras qué pasa hoy si entrenas (y qué pasa si la racha se cortó)
  const gap = p.state.lastSessionDate ? daysBetween(p.state.lastSessionDate, today) : 0;
  const shieldNote = !doneToday && gap === 2 && p.state.shields > 0;
  const freshStreakNote = !doneToday && !shieldNote && streak === 0 && p.state.bestStreak > 0 && p.state.lastSessionDate !== null;

  function go() {
    primeAudio(); // el navegador exige un gesto para permitir sonido y voz
    router.push("/sesion");
  }
  // La primera sesión empieza con la hoja de «manos libres»: el teléfono se apoya a un par de metros y hay que oírlo.
  function start() {
    let seen = true;
    try {
      seen = window.localStorage.getItem("kb:handsfree") === "1";
    } catch {
      /* sin almacenamiento: no se insiste */
    }
    if (!seen && p.state.totals.sessions === 0 && !resuming) setSheet("handsfree");
    else go();
  }
  function testSound() {
    primeAudio();
    const cs = { sound: p.settings.sound, voice: p.settings.voice, haptics: false, gender: character === "princess" ? ("female" as const) : ("male" as const) };
    countBeep(cs);
    window.setTimeout(() => goBeep(cs), 350);
    window.setTimeout(() => speak(cs, `Hola, soy ${character === "princess" ? "Princess" : "Bro"}. Vamos.`), 750);
  }
  function startHandsfree() {
    try {
      window.localStorage.setItem("kb:handsfree", "1");
    } catch {
      /* noop */
    }
    setSheet(null);
    go();
  }

  async function markRest() {
    setBusy(true);
    try {
      const { log, next } = finishRestDay(p.state, plan, Date.now(), today);
      await p.completeSession(log, next, newlyCompleted(next, p.completedGoalIds, Date.now()));
      setSheet(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-focus={plan.focus}>
      {/* ───── Hero: la pantalla se tiñe con la tinta del día ───── */}
      <section className="rounded-b-[36px] bg-ink-deep pb-7 pt-safe text-paper">
        <div className="mx-auto max-w-md px-5">
        <header className="flex items-start justify-between gap-4 pt-5">
          <div className="min-w-0">
            <h1 className="font-slab text-[30px] leading-[1.05] text-balance">
              {doneToday ? `Día ${plan.dayIndex - 1} cumplido` : first ? `Hoy empieza tu Día ${plan.dayIndex}` : `Hoy toca el Día ${plan.dayIndex}`}
            </h1>
            <p className="mt-1 text-[15px] text-paper/85">
              {doneToday
                ? `Mañana te toca el Día ${plan.dayIndex}, ${firstName(p.user.displayName)}.`
                : first
                  ? `Bienvenido, ${firstName(p.user.displayName)}.`
                  : `Bienvenido de vuelta, ${firstName(p.user.displayName)}.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSheet("streak")}
            className="press flex min-h-11 shrink-0 items-center gap-2.5 rounded-full bg-night/55 py-1.5 pl-3 pr-3.5"
            aria-label={`Racha de ${streak} ${streak === 1 ? "día" : "días"} y ${p.state.shields} ${p.state.shields === 1 ? "escudo" : "escudos"}. Toca para ver cómo funcionan.`}
          >
            <span className="flex items-center gap-1.5">
              <Icon name="flame" size={20} className={streak > 0 ? "text-[#ffb41f]" : "text-paper-mute"} />
              <span className="heat-num text-xl leading-none" style={{ ["--heat" as string]: Math.min(1, streak / 30) }}>
                {streak}
              </span>
            </span>
            <span className="flex items-center gap-1" aria-hidden="true">
              <Icon name="shield" size={18} className={p.state.shields > 0 ? "text-paper" : "text-paper-mute/70"} />
              <span className={`font-num text-[17px] font-bold leading-none ${p.state.shields > 0 ? "" : "text-paper-mute/70"}`}>{p.state.shields}</span>
            </span>
          </button>
        </header>

        <div className="mt-5">
          <DayDeck
            plan={plan}
            onOpenBlock={(b) => {
              setInfoBlock(b);
              setSheet("info");
            }}
            first={
          <div className="flip relative mx-auto aspect-[5/7.1] w-full max-w-[320px]" data-flipped={flipped}>
            <div className="flip-inner">
              <div className="flip-face flip-front" aria-hidden={flipped} inert={flipped}>
                <LoteriaCard day={plan.dayIndex} focus={plan.focus} title={plan.title} heat={heat} art={<FigureAuto exerciseId={lead.exerciseId} playing={!flipped} size={236} view="three-quarter" />} />
              </div>
              <div className="flip-face flip-back" aria-hidden={!flipped} inert={!flipped}>
                <CardBack plan={plan}>
                  <button
                    type="button"
                    onClick={() => { setInfoBlock(null); setSheet("evidence"); }}
                    className="press mx-auto inline-flex h-11 items-center gap-2 rounded-full border-2 border-paper/50 px-4 text-[14.5px] font-medium"
                  >
                    <Icon name="book" size={18} />
                    Respaldo científico · {plan.evidence.length}
                  </button>
                </CardBack>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-pressed={flipped}
              aria-label={flipped ? "Ver el frente de la carta" : "Girar la carta: de dónde sale esta sesión"}
              className="press absolute -bottom-3 -right-2 z-10 grid h-12 w-12 place-items-center rounded-full bg-night text-paper shadow-[0_10px_22px_-8px_rgba(0,0,0,0.7)]"
            >
              <Icon name="refresh" size={22} />
            </button>
          </div>
            }
          />
        </div>

        <div className="mt-6 text-center">
          <p className="font-num text-[19px] font-semibold leading-snug">{planHeadline(plan)}</p>
          <p className="mx-auto mt-1 max-w-[22rem] text-[15px] leading-snug text-paper/85">{cantoFor(plan.title)}</p>
        </div>

        <div className="mt-6 space-y-3">
          <Button variant="paper" size="lg" className="w-full" onClick={start} icon={<Icon name="play" size={22} />}>
            {resuming ? "Continuar sesión" : doneToday ? `Adelantar el Día ${plan.dayIndex}` : "Empezar"}
          </Button>
          {plan.restDayAllowed && (
            <Button variant="ghost" className="w-full text-paper/90" onClick={() => setSheet("rest")}>
              Hoy descanso
            </Button>
          )}
          {shieldNote && (
            <p role="note" className="rounded-xl bg-night/45 px-4 py-3 text-center text-[14px] text-paper">
              Ayer fue día libre. Si entrenas hoy, un escudo cubre ese día y tu racha sigue.
            </p>
          )}
          {freshStreakNote && (
            <p role="note" className="rounded-xl bg-night/45 px-4 py-3 text-center text-[14px] text-paper">
              Empieza una racha nueva hoy. Tu mejor racha ({p.state.bestStreak}) y tu tabla siguen aquí.
            </p>
          )}
          {plan.readiness === "reentry" && (
            <p role="note" className="rounded-xl bg-night/45 px-4 py-3 text-center text-[14px] text-paper">
              Volviste tras unos días: hoy el volumen es menor para retomar sin riesgo.
            </p>
          )}
        </div>
        </div>
      </section>

      {/* ───── Cuerpo ───── */}
      <div className="mx-auto max-w-md space-y-9 px-5 pb-6 pt-8 [&>*]:rise [&>*:nth-child(1)]:[--i:0] [&>*:nth-child(2)]:[--i:1] [&>*:nth-child(3)]:[--i:2] [&>*:nth-child(4)]:[--i:3] [&>*:nth-child(5)]:[--i:4] [&>*:nth-child(6)]:[--i:5]">
        {doneToday && <ReminderCard nextDayNumber={plan.dayIndex} minutes={p.settings.minutes} today={today} />}
        {!doneToday && p.state.totals.sessions >= 1 && <InstallCard today={today} />}

        {due.length > 0 && (
          <section aria-labelledby="pend">
            <h2 id="pend" className="font-slab text-2xl">
              Pendiente en tu plan
            </h2>
            <ul className="mt-3 space-y-6">
              {due.map((c) => (
                <li key={c.id}>
                  <p className="text-[17px] font-medium leading-snug">{c.titleEs}</p>
                  <p className="mt-1 text-[14.5px] leading-snug text-paper-dim">{c.textEs}</p>
                  {c.id === "weigh-in" ? (
                    <div className="mt-3 flex gap-3">
                      <label className="flex-1">
                        <span className="sr-only">Peso en kilos</span>
                        <input
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="kg"
                          value={kgStr}
                          onChange={(e) => setKgStr(e.target.value)}
                          className="h-12 w-full rounded-[14px] border-2 border-seam bg-night-2 px-4 font-num text-[20px] font-bold text-paper placeholder:text-paper-mute focus:border-ink-lift focus:outline-none"
                        />
                      </label>
                      <Button onClick={saveWeighIn} disabled={!kgOk}>
                        Guardar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button variant="secondary" onClick={keepBells}>
                        Sigo con las mismas
                      </Button>
                      <Link href="/pesas" className="press inline-flex h-12 items-center rounded-[14px] px-4 text-[15px] font-medium text-ink-lift underline underline-offset-4">
                        Cambiar mis pesas
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="why">
          <h2 id="why" className="font-slab text-2xl">
            Por qué hoy toca esto
          </h2>
          <p className="mt-1 text-sm text-paper-mute">
            {THEME_LABEL_ES[plan.theme]} · {PHASE_LABEL_ES[plan.phase]} · semana {plan.week}/4 · esfuerzo objetivo {plan.rpeTarget.toString().replace(".", ",")}/10
          </p>
          <ul className="mt-3 space-y-2.5">
            {plan.whyEs.map((w) => (
              <li key={w} className="flex gap-3 text-[15.5px] leading-snug text-paper-dim">
                <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-ink-lift" aria-hidden="true" />
                {w}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => { setInfoBlock(null); setSheet("evidence"); }}
            className="press mt-4 inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink-lift/60 px-4 text-[14.5px] font-medium text-ink-lift"
          >
            <Icon name="book" size={18} />
            Respaldo científico · {plan.evidence.length} {plan.evidence.length === 1 ? "estudio" : "estudios"}
          </button>
        </section>

        <section aria-labelledby="routine">
          <h2 id="routine" className="mb-4 font-slab text-2xl">
            Tu rutina
          </h2>
          <PlanList plan={plan} />
        </section>

        <Tabla dayIndex={p.state.dayIndex} settings={p.settings} />

        <section aria-label="Rango" className="rounded-[20px] bg-night-2 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-slab text-xl">{rank.name}</h2>
            <p className="font-num text-sm text-paper-dim">
              {nf(p.state.xp)}
              {rank.nextAt ? ` / ${nf(rank.nextAt)} XP` : " XP"}
            </p>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-night-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rank.pct * 100)} aria-label="Progreso de rango">
            <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${Math.max(4, rank.pct * 100)}%` }} />
          </div>
          {rank.next && <p className="mt-2 text-sm text-paper-mute">Siguiente rango: {rank.next}</p>}
        </section>

        {p.pending > 0 && (
          <p role="status" className="text-center text-sm text-paper-mute">
            Sincronizando tu progreso…
          </p>
        )}
        {p.syncError && (
          <p role="alert" className="rounded-xl bg-[#3a1424] px-4 py-3 text-sm text-[#ffb3c8]">
            {p.syncError}
          </p>
        )}
      </div>

      <EvidenceSheet open={sheet === "evidence"} onClose={() => setSheet(null)} ids={infoBlock && sheet === "evidence" && infoBlock.evidence.length ? infoBlock.evidence : plan.evidence} />
      {infoBlock && (
        <InfoSheet open={sheet === "info"} onClose={() => setSheet(null)} exerciseId={infoBlock.exerciseId} block={infoBlock} focus={plan.focus} onEvidence={() => setSheet("evidence")} />
      )}
      <Sheet open={sheet === "handsfree"} onClose={() => setSheet(null)} title="Sesión manos libres" tone={plan.focus}>
        <p className="text-[15.5px] leading-snug text-paper-dim">
          La app lleva el reloj y te cuenta cada serie: tú solo levantas. Apoya el teléfono a un par de metros y sube el volumen.
        </p>
        <p className="mt-3 text-[14.5px] leading-snug text-paper-mute">Durante la sesión la pantalla se mantiene encendida. La vibración depende de tu teléfono.</p>
        <div className="mt-5 grid gap-3">
          <Button variant="secondary" onClick={testSound} icon={<Icon name="volume" size={20} />}>
            Probar sonido
          </Button>
          <Button size="lg" onClick={startHandsfree} icon={<Icon name="play" size={22} />}>
            Empezar
          </Button>
        </div>
      </Sheet>
      <Sheet open={sheet === "streak"} onClose={() => setSheet(null)} title="Racha y escudos" tone={plan.focus}>
        <p className="text-[15.5px] leading-snug text-paper-dim">
          Tu racha cuenta los días seguidos con una carta cumplida. El descanso que marcas también cuenta.
        </p>
        <p className="mt-3 flex items-start gap-3 text-[15.5px] leading-snug text-paper-dim">
          <Icon name="shield" size={22} className="mt-0.5 shrink-0 text-paper" />
          <span>
            Cada 7 días de racha ganas un escudo (máximo 2). Si un día no entrenas, un escudo cubre ese día de forma automática. No cubre dos días seguidos.
          </span>
        </p>
        <p className="mt-3 font-num text-[17px] font-bold">
          Hoy: racha {streak} · {p.state.shields} {p.state.shields === 1 ? "escudo" : "escudos"} · mejor racha {p.state.bestStreak}
        </p>
        <div className="mt-5">
          <Button variant="secondary" className="w-full" onClick={() => setSheet(null)}>
            Entendido
          </Button>
        </div>
      </Sheet>
      <Sheet open={sheet === "rest"} onClose={() => setSheet(null)} title="Marcar descanso" tone={plan.focus}>
        <p className="text-[15.5px] text-paper-dim">
          El descanso también es parte del plan: se registra como un día cumplido, mantiene tu racha y pasas al Día {plan.dayIndex + 1}.
        </p>
        <div className="mt-5 grid gap-3">
          <Button size="lg" onClick={() => void markRest()} disabled={busy}>
            {busy ? "Guardando…" : "Sí, hoy descanso"}
          </Button>
          <Button variant="secondary" onClick={() => setSheet(null)}>
            Prefiero entrenar suave
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
