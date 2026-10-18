import type { ReactNode } from "react";
import { FOCUS_LABEL_ES, PHASE_LABEL_ES, THEME_LABEL_ES } from "@/lib/engine/calendar";
import type { SessionPlan } from "@/lib/engine/types";
import { cantoFor } from "@/lib/cantos";

/** El reverso de la tarjeta: la frase del día, de dónde sale la sesión y el acceso a su respaldo científico. */
export function CardBack({ plan, children }: { plan: SessionPlan; children?: ReactNode }) {
  return (
    <div data-focus={plan.focus} className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/15 bg-ink-deep text-paper shadow-[0_26px_46px_-22px_rgba(0,0,0,0.85)]">
      <div className="absolute inset-0" style={{ background: "linear-gradient(165deg, var(--ink) -40%, var(--ink-deep) 55%, var(--night) 140%)" }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="#fff" opacity="0.07">
          <polygon points="-12,104 42,-8 66,-8 12,104" />
          <polygon points="38,152 100,28 118,28 56,152" />
        </g>
      </svg>
      <div className="relative flex h-full w-full flex-col items-center justify-between px-5 py-6 text-center">
        <p className="font-slab text-[17px] opacity-90">
          Día {plan.dayIndex} · {FOCUS_LABEL_ES[plan.focus]}
        </p>
        <p className="font-slab text-[26px] leading-[1.08] text-balance">{cantoFor(plan.title)}</p>
        <div className="w-full space-y-2.5">
          <p className="text-[15px] leading-snug">
            {THEME_LABEL_ES[plan.theme]} · {PHASE_LABEL_ES[plan.phase]} · semana {plan.week} de 4
            <br />
            Esfuerzo objetivo {plan.rpeTarget.toString().replace(".", ",")} de 10
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
