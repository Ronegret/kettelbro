"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExerciseArt } from "@/components/figure/ExerciseArt";
import { ExerciseFigure } from "@/components/figure/ExerciseFigure";
import { BroBell } from "@/components/ui/BroBell";
import { Bean } from "@/components/ui/Bean";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LoteriaCard } from "@/components/ui/LoteriaCard";
import { Tabla } from "@/components/ui/Tabla";
import { APP_NAME } from "@/lib/config";
import { cantoFor } from "@/lib/cantos";
import { GOALS } from "@/lib/engine/goals";
import { rankFor } from "@/lib/engine/progression";
import type { GoalCompletionDoc, ProgramState, SessionLog, SessionPlan, UserSettings } from "@/lib/engine/types";
import { nf } from "@/lib/format";
import { INKS, NIGHT, PAPER } from "@/lib/inks";
import { renderShareCard, shareOrDownload } from "@/lib/shareCard";
import { Embers } from "./Embers";

function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export interface CelebrationResult {
  log: SessionLog;
  next: ProgramState;
  newGoals: GoalCompletionDoc[];
  prs: string[];
  prevXp: number;
  /** Un escudo cubrió el día perdido de ayer. */
  usedShield?: boolean;
  /** La racha completó otra semana y regaló un escudo. */
  earnedShield?: boolean;
}

/**
 * EL CIERRE: la carta del día llega a la mesa, se estampa COMPLETA y recibe su frijol.
 * Debajo, los números en una sola línea y la tabla del mes donde ese frijol queda para siempre.
 */
export function Celebration({
  plan,
  settings,
  result,
  onClose,
}: {
  plan: SessionPlan;
  settings: UserSettings;
  result: CelebrationResult;
  onClose: () => void;
}) {
  const { log, next, newGoals, prs, prevXp } = result;
  const xp = useCountUp(log.xpEarned);
  const rankBefore = rankFor(prevXp);
  const rankAfter = rankFor(next.xp);
  const weekDone = !log.restDay && log.dayIndex % 7 === 0;
  const figRef = useRef<HTMLDivElement>(null);
  const beanRef = useRef<HTMLSpanElement>(null);
  const [landed, setLanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lead = (plan.blocks.find((b) => b.role === "primary") ?? plan.blocks[0])!.exerciseId;
  const inks = INKS[plan.focus];
  const embers = useMemo(() => [inks.lift, "#ffb41f", PAPER, inks.deep], [inks]);
  const minutes = Math.max(1, Math.round(log.durationSec / 60));
  const strength = plan.focus === "strength";

  // Logros: récords y metas en una lista compacta (máx. 4 visibles)
  const achievements = [
    ...prs.map((p) => ({ key: `pr-${p}`, icon: "flame" as const, label: "Récord", text: p })),
    ...newGoals.map((g) => ({ key: g.id, icon: "flag" as const, label: "Meta", text: GOALS.find((x) => x.id === g.id)?.titleEs ?? g.id })),
  ];
  const shown = achievements.slice(0, 4);

  // El frijol de la carta VUELA hasta su casilla en la tabla (consistencia espacial: de dónde viene y adónde va).
  useEffect(() => {
    const instant = () => setLanded(true);
    if (log.restDay || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      instant();
      return;
    }
    let fly: HTMLElement | null = null;
    const t = window.setTimeout(() => {
      const src = beanRef.current;
      const cell = document.querySelector<HTMLElement>(`[data-day="${log.dayIndex}"]`);
      if (!src || !cell) return instant();
      const a = src.getBoundingClientRect();
      const b = cell.getBoundingClientRect();
      // Si la casilla queda fuera de la vista (o bajo la barra fija), el frijol simplemente aparece en ella.
      if (b.bottom > window.innerHeight - 96 || b.top < 0) return instant();
      fly = src.cloneNode(true) as HTMLElement;
      fly.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:60;pointer-events:none;`;
      document.body.appendChild(fly);
      src.style.visibility = "hidden";
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const anim = fly.animate(
        [
          { transform: "translate(0px,0px) scale(1) rotate(0deg)" },
          { transform: `translate(${dx}px,${dy}px) scale(${Math.min(1, 26 / a.width)}) rotate(-24deg)` },
        ],
        { duration: 650, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" },
      );
      anim.onfinish = () => {
        fly?.remove();
        setLanded(true);
      };
    }, 1500);
    return () => {
      window.clearTimeout(t);
      fly?.remove();
    };
  }, [log.dayIndex, log.restDay]);

  async function share() {
    setSharing(true);
    setNote(null);
    try {
      const svgEl = figRef.current?.querySelector("svg");
      const figureSvg = svgEl ? new XMLSerializer().serializeToString(svgEl) : undefined;
      const blob = await renderShareCard({
        day: log.dayIndex,
        focus: plan.focus,
        title: plan.title,
        streak: next.streak,
        tonnageKg: log.tonnageKg,
        minutes,
        rank: rankAfter.name,
        appName: APP_NAME,
        figureSvg,
      });
      const r = await shareOrDownload(blob, `${APP_NAME}-dia-${log.dayIndex}.png`, `Día ${log.dayIndex} en ${APP_NAME}: ${plan.title}`);
      setNote(r === "downloaded" ? "Imagen guardada en tus descargas." : null);
    } catch {
      setNote("No pudimos crear la imagen. Inténtalo otra vez.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div data-focus={plan.focus} className="bg-ink text-on-ink">
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-32 pt-safe">
        <Embers colors={embers} />
        {/* figura oculta con colores en hex para exportarla a la imagen de compartir */}
        <div ref={figRef} aria-hidden="true" className="pointer-events-none fixed -left-[9999px] top-0 h-[600px] w-[600px]">
          <ExerciseFigure exerciseId={lead} ink={strength ? PAPER : NIGHT} accent={strength ? NIGHT : PAPER} paper={inks.deep} phase={0.5} playing={false} />
        </div>

        <header className="flex items-center gap-3 pt-6">
          <BroBell mood="fire" size={64} />
          <h1 className="min-w-0 font-slab text-[32px] leading-[1.02] text-balance">{log.restDay ? "Descanso registrado" : `¡Día ${log.dayIndex} completo!`}</h1>
        </header>

        {/* La tarjeta llega, se sella y recibe su visto */}
        {!log.restDay && (
          <div className="relative mx-auto mt-5 w-[212px]">
            <LoteriaCard day={log.dayIndex} focus={plan.focus} title={plan.title} heat={0.9} compact art={<ExerciseArt exerciseId={lead} size={150} playing={false} showGround={false} />} />
            <span
              className="absolute left-1/2 top-[44%] whitespace-nowrap rounded-lg bg-paper px-3 py-1.5 font-slab text-[24px] leading-none text-night shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)]"
              style={{ animation: "stamp 0.6s var(--ease-out) 0.55s both", transform: "translateX(-50%) rotate(-8deg)" }}
            >
              ¡COMPLETA!
            </span>
            <span ref={beanRef} className="absolute -bottom-4 -right-3">
              <Bean size={58} drop />
            </span>
          </div>
        )}
        {weekDone && (
          <p className="mt-6 text-center font-slab text-[52px] leading-none" style={{ animation: "stamp 0.6s var(--ease-out) 0.9s both" }}>
            ¡Semana completa!
          </p>
        )}

        <p className="mx-auto mt-6 max-w-[22rem] text-center font-slab text-[17px] leading-snug">{cantoFor(plan.title)}</p>

        {/* una sola línea de datos */}
        <p className="mt-5 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1 font-num text-[19px] font-bold" style={{ ["--heat" as string]: 0.9 }}>
          <span>{nf(log.tonnageKg)} kg</span>
          <span>{minutes} min</span>
          <span>racha {next.streak}</span>
          <span>+{xp} XP</span>
        </p>
        <p className="mt-1 text-center text-[15px]">
          {rankAfter.index > rankBefore.index ? `¡Subiste a ${rankAfter.name}!` : rankAfter.next ? `${rankAfter.name} · siguiente: ${rankAfter.next}` : rankAfter.name}
        </p>
        {(result.usedShield || result.earnedShield) && (
          <div role="status" className="mx-auto mt-4 max-w-[22rem] space-y-2 rounded-2xl bg-night/35 px-4 py-3 text-[15px] leading-snug">
            {result.usedShield && (
              <p className="flex items-start gap-2.5">
                <Icon name="shield" size={20} className="mt-0.5 shrink-0" />
                <span>
                  Un escudo cubrió tu día de ayer. Tu racha sigue en {next.streak}. Te quedan {next.shields - (result.earnedShield ? 1 : 0)}.
                </span>
              </p>
            )}
            {result.earnedShield && (
              <p className="flex items-start gap-2.5">
                <Icon name="shield" size={20} className="mt-0.5 shrink-0" />
                <span>Escudo ganado. Cubre un día perdido. Tienes {next.shields} de 2.</span>
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-paper">
          <Tabla dayIndex={next.dayIndex} settings={settings} justDone={log.restDay ? undefined : log.dayIndex} holdBean={!landed} />
        </div>

        {shown.length > 0 && (
          <section aria-label="Logros" className="mt-6">
            <h2 className="font-slab text-xl">Logros de hoy</h2>
            <ul className="mt-2 divide-y divide-on-ink/25">
              {shown.map((a) => (
                <li key={a.key} className="flex items-center gap-3 py-3 text-[16px]">
                  <Icon name={a.icon} size={22} className="shrink-0" />
                  <span>
                    <span className="font-slab">{a.label}: </span>
                    {a.text}
                  </span>
                </li>
              ))}
            </ul>
            {achievements.length > shown.length && <p className="mt-1 text-[14px]">y {achievements.length - shown.length} más en Metas.</p>}
          </section>
        )}
      </main>

      {/* Botones fijos en la zona del pulgar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-night/30 bg-ink pb-safe">
        <div className="mx-auto grid max-w-md grid-cols-[1fr_auto] gap-3 px-5 py-3">
          <Button variant="paper" size="lg" onClick={() => void share()} disabled={sharing} icon={<Icon name="share" size={22} />}>
            {sharing ? "Creando…" : "Compartir"}
          </Button>
          <Button variant="secondary" size="lg" className="!bg-night/80 !text-paper" onClick={onClose}>
            Hoy
          </Button>
        </div>
        {note && (
          <p role="status" className="pb-2 text-center text-[14px]">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
