"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { FigureAuto } from "@/components/figure3d/FigureAuto";
import { useCharacter } from "@/components/figure3d/prefs";
import { Icon } from "@/components/ui/Icon";
import { LoteriaCard } from "@/components/ui/LoteriaCard";
import { EXERCISES } from "@/lib/engine/exercises";
import { blockEstimateSec } from "@/lib/engine/steps";
import type { BlockRole, SessionPlan, WorkBlock } from "@/lib/engine/types";
import { bellLabelLong, protocolLabel } from "@/lib/format";

const ROLE_ES: Record<BlockRole, string> = {
  warmup: "Calentamiento",
  primary: "Principal",
  secondary: "Complemento",
  finisher: "Remate",
  cooldown: "Calma",
};

type Slide =
  | { key: string; kind: "day" }
  | { key: string; kind: "group"; role: "warmup" | "cooldown"; blocks: WorkBlock[] }
  | { key: string; kind: "exercise"; block: WorkBlock; n: number };

// Los % de estos anchos se refieren al ancho del propio carrusel (los separadores y las cartas son hijos suyos).
const SLIDE_W = "min(312px, 80%)";
const GAP = 16;
const EDGE = `calc(50% - min(156px, 40%) - ${GAP}px)`; // deja la primera y la última carta centradas
const mins = (b: WorkBlock) => Math.max(1, Math.round(blockEstimateSec(b) / 60));

/** Las cartas del día: la carta principal, el calentamiento, cada ejercicio y la vuelta a la calma. */
function buildSlides(plan: SessionPlan): { slides: Slide[]; work: number } {
  const warm = plan.blocks.filter((b) => b.role === "warmup");
  const cool = plan.blocks.filter((b) => b.role === "cooldown");
  const work = plan.blocks.filter((b) => b.role !== "warmup" && b.role !== "cooldown");
  return {
    work: work.length,
    slides: [
      { key: "day", kind: "day" },
      ...(warm.length ? [{ key: "warm", kind: "group", role: "warmup", blocks: warm } as Slide] : []),
      ...work.map((block, i) => ({ key: block.id, kind: "exercise", block, n: i + 1 }) as Slide),
      ...(cool.length ? [{ key: "cool", kind: "group", role: "cooldown", blocks: cool } as Slide] : []),
    ],
  };
}

/**
 * LA BARAJA DE HOY. La carta del día es la primera; al deslizar (o con las flechas) se reparten las demás: el calentamiento,
 * una carta por ejercicio con el instructor haciéndolo, y la vuelta a la calma. Las vecinas giran en 3D al pasar.
 * Tocar una carta de ejercicio abre su ficha técnica.
 */
export function DayDeck({ plan, first, onOpenBlock }: { plan: SessionPlan; first: ReactNode; onOpenBlock: (b: WorkBlock) => void }) {
  const { slides, work } = buildSlides(plan);
  const reduce = useReducedMotion();
  const character = useCharacter();
  const scroller = useRef<HTMLDivElement>(null);
  const items = useRef<Array<HTMLDivElement | null>>([]);
  const frame = useRef(0);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  // Giro y desvanecido de las vecinas según su distancia al centro, y carta activa. Sin re-render por fotograma: se escribe en el estilo.
  const update = useCallback(() => {
    const sc = scroller.current;
    if (!sc) return;
    const mid = sc.scrollLeft + sc.clientWidth / 2;
    let best = 0;
    let bestD = Infinity;
    items.current.forEach((el, i) => {
      if (!el) return;
      const d = (el.offsetLeft + el.offsetWidth / 2 - mid) / (el.offsetWidth + GAP);
      if (Math.abs(d) < bestD) {
        best = i;
        bestD = Math.abs(d);
      }
      if (!reduce) {
        const k = Math.max(-1.6, Math.min(1.6, d));
        el.style.transform = `rotateY(${(-k * 24).toFixed(1)}deg) scale(${(1 - Math.abs(k) * 0.07).toFixed(3)})`;
        el.style.opacity = String(1 - Math.min(0.5, Math.abs(k) * 0.3));
      }
    });
    setActive(best);
  }, [reduce]);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, slides.length]);

  const go = (i: number) => {
    const sc = scroller.current;
    const el = items.current[Math.max(0, Math.min(slides.length - 1, i))];
    if (!sc || !el) return;
    setTouched(true);
    sc.scrollTo({ left: el.offsetLeft - (sc.clientWidth - el.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  };

  const cur = slides[active] as Slide;
  const now =
    cur.kind === "day"
      ? `${work} ejercicios · ${plan.durationMin} min · contigo, ${character === "princess" ? "Princess" : "Bro"}`
      : cur.kind === "group"
        ? `${cur.role === "warmup" ? "Calentamiento" : "Vuelta a la calma"} · ${cur.blocks.reduce((a, b) => a + mins(b), 0)} min`
        : `${EXERCISES[cur.block.exerciseId].nameEs} · ${ROLE_ES[cur.block.role]} · ≈ ${mins(cur.block)} min`;

  return (
    <div>
      <div
        ref={scroller}
        role="group"
        aria-roledescription="carrusel"
        aria-label="Las tarjetas de tu día. Desliza para ver cada ejercicio."
        tabIndex={0}
        onScroll={() => {
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(update);
        }}
        onPointerDown={() => setTouched(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") (e.preventDefault(), go(active + 1));
          if (e.key === "ArrowLeft") (e.preventDefault(), go(active - 1));
        }}
        className="relative -mx-5 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-6 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
        style={{ gap: GAP, perspective: "1100px", touchAction: "pan-x pan-y" }}
      >
        <div aria-hidden="true" className="shrink-0" style={{ width: EDGE }} />
        {slides.map((s, i) => (
          <div
            key={s.key}
            ref={(el) => {
              items.current[i] = el;
            }}
            role="group"
            aria-roledescription="carta"
            aria-label={`${i + 1} de ${slides.length}`}
            inert={Math.abs(i - active) > 1}
            className="shrink-0 snap-center will-change-transform"
            style={{ width: SLIDE_W }}
          >
            {s.kind === "day" ? (
              first
            ) : s.kind === "group" ? (
              <GroupCard plan={plan} slide={s} />
            ) : (
              <ExerciseCard plan={plan} block={s.block} n={s.n} total={work} active={i === active} onOpen={onOpenBlock} />
            )}
          </div>
        ))}
        <div aria-hidden="true" className="shrink-0" style={{ width: EDGE }} />
      </div>

      {/* controles: flechas, puntos y qué carta es */}
      <div className="mt-1 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Tarjeta anterior" className="press grid h-11 w-11 place-items-center rounded-full bg-night/45 disabled:opacity-30">
          <Icon name="back" size={22} />
        </button>
        <div className="flex items-center gap-1.5" role="presentation">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(i)}
              aria-label={`Ir a la tarjeta ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              className="grid h-6 place-items-center px-0.5"
            >
              <span className={`block h-2 rounded-full transition-all duration-300 ${i === active ? "w-6 bg-paper" : "w-2 bg-paper/40"}`} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(active + 1)} disabled={active === slides.length - 1} aria-label="Tarjeta siguiente" className="press grid h-11 w-11 place-items-center rounded-full bg-night/45 disabled:opacity-30">
          <Icon name="back" size={22} className="rotate-180" />
        </button>
      </div>
      <p className="mt-2 min-h-[22px] text-center text-[14.5px] font-medium text-paper/90" aria-live="polite">
        {active === 0 && !touched ? "Desliza para ver qué te toca →" : now}
      </p>
    </div>
  );
}

function ExerciseCard({ plan, block, n, total, active, onOpen }: { plan: SessionPlan; block: WorkBlock; n: number; total: number; active: boolean; onOpen: (b: WorkBlock) => void }) {
  const ex = EXERCISES[block.exerciseId];
  const heat = Math.min(1, Math.max(0, (plan.rpeTarget - 3) / 6));
  return (
    <button type="button" onClick={() => onOpen(block)} className="block w-full text-left" aria-label={`${ex.nameEs}. ${protocolLabel(block.protocol, block.exerciseId)}, ${bellLabelLong(block)}. Toca para ver la técnica.`}>
      <LoteriaCard
        day={n}
        numberLabel={`Ejercicio ${n} de ${total}`}
        focus={plan.focus}
        title={ex.cardEs}
        subtitle={`${protocolLabel(block.protocol, block.exerciseId)} · ${bellLabelLong(block)}`}
        badge={ROLE_ES[block.role]}
        heat={heat}
        reveal={false}
        art={<FigureAuto exerciseId={block.exerciseId} size={196} playing={active} repSec={ex.secPerRep > 0 ? ex.secPerRep : undefined} view="three-quarter" />}
        footer={
          <span className="absolute bottom-[calc(29%+0.2rem)] left-3 inline-flex items-center gap-1 rounded-full bg-night/45 px-2.5 py-1 font-num text-[12.5px] font-bold text-paper">
            <Icon name="clock" size={13} /> ≈ {mins(block)} min
          </span>
        }
      />
    </button>
  );
}

function GroupCard({ plan, slide }: { plan: SessionPlan; slide: Extract<Slide, { kind: "group" }> }) {
  const warm = slide.role === "warmup";
  const total = slide.blocks.reduce((a, b) => a + mins(b), 0);
  return (
    <div data-focus={plan.focus} className="@container relative mx-auto aspect-[5/7] w-full max-w-[320px] overflow-hidden rounded-[24px] border border-white/15 bg-ink-deep shadow-[0_26px_46px_-22px_rgba(0,0,0,0.85)]">
      <div className="absolute inset-0" style={{ background: "linear-gradient(165deg, var(--ink) -40%, var(--ink-deep) 55%, var(--night) 140%)" }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="#fff" opacity="0.07">
          <polygon points="-12,104 42,-8 66,-8 12,104" />
          <polygon points="38,152 100,28 118,28 56,152" />
        </g>
      </svg>
      <div className="relative flex h-full w-full flex-col px-4 pb-4 pt-5 text-paper @[270px]:px-5 @[270px]:pb-5">
        <h3 className="font-slab text-[28px] @[270px]:text-[34px] @[300px]:text-[38px]">{warm ? "Calentamiento" : "Vuelta a la calma"}</h3>
        <p className="mt-1.5 hidden text-[15px] leading-snug opacity-90 @[270px]:block">{warm ? "Despierta caderas y hombros antes de cargar." : "Baja las pulsaciones y suelta lo trabajado."}</p>
        <ul className="mt-3 flex-1 space-y-1.5 overflow-hidden @[270px]:mt-4 @[270px]:space-y-2.5">
          {slide.blocks.map((b) => {
            const ex = EXERCISES[b.exerciseId];
            return (
              <li key={b.id} className="flex items-center gap-2.5 rounded-[14px] bg-night/55 px-2.5 py-1.5 @[270px]:gap-3 @[270px]:px-3 @[270px]:py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink-lift" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium leading-tight @[270px]:text-[15.5px]">{ex.nameEs}</span>
                  <span className="block truncate text-[12.5px] opacity-80 @[270px]:text-[13.5px]">{protocolLabel(b.protocol, b.exerciseId)}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-paper px-3 py-1 font-num text-[13.5px] font-bold text-night">
          <Icon name="clock" size={14} /> ≈ {total} min
        </p>
      </div>
    </div>
  );
}
