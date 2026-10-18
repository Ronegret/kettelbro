import type { CSSProperties, ReactNode } from "react";
import { FOCUS_LABEL_ES } from "@/lib/engine/calendar";
import type { Focus } from "@/lib/engine/types";

/**
 * LA TARJETA DEL DÍA. Cada sesión es una tarjeta de entrenamiento: campo de la tinta del enfoque con franjas de velocidad,
 * el número del día en grande, la etiqueta del enfoque y el nombre sobre una barra oscura que se lee en cualquier tinta.
 * (El nombre del componente se conserva por sus usos; ya no es una carta de lotería.)
 */
export function LoteriaCard({
  day,
  focus,
  title,
  art,
  heat = 0.5,
  reveal = true,
  compact = false,
  className = "",
  footer,
  badge,
  numberLabel,
  subtitle,
}: {
  day: number;
  focus: Focus;
  title: string;
  art?: ReactNode;
  /** 0..1: esfuerzo objetivo; engrosa el número del día (tipografía variable). */
  heat?: number;
  reveal?: boolean;
  /** Versión pequeña (cierre de sesión, mazo): tipografía reducida para que el nombre quepa. */
  compact?: boolean;
  className?: string;
  footer?: ReactNode;
  /** Texto de la etiqueta de arriba a la derecha (por defecto, el enfoque del día). */
  badge?: string;
  /** Lectura accesible del número grande (por defecto «Día N»). */
  numberLabel?: string;
  /** Segunda línea bajo el nombre (por ejemplo, «4 × 8 · 12 kg»); deja más sitio al banner. */
  subtitle?: string;
}) {
  const style = { "--heat": heat } as CSSProperties;
  // El nombre cabe siempre en una línea: la condensada en mayúsculas mide ≈0,5 em por letra y el banner es 48 px más estrecho que la tarjeta.
  const titleSize = `min(${compact ? 22 : 30}px, max(13px, calc((100cqw - 48px) / ${(title.length * 0.52).toFixed(2)})))`;
  return (
    <div
      data-focus={focus}
      className={`@container relative mx-auto aspect-[5/7] w-full max-w-[320px] overflow-hidden rounded-[24px] border border-white/15 bg-ink text-on-ink shadow-[0_26px_46px_-22px_rgba(0,0,0,0.85)] ${className}`}
      style={{ ...style, ...(reveal ? { animation: "deal-in 0.7s var(--ease-out) both" } : {}) }}
    >
      {/* campo de tinta con profundidad y franjas de velocidad */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(165deg, var(--ink-lift) -15%, var(--ink) 40%, var(--ink-deep) 135%)" }} />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g fill="var(--ink-deep)" opacity="0.38">
          <polygon points="-12,104 42,-8 66,-8 12,104" />
          <polygon points="38,152 100,28 118,28 56,152" />
        </g>
        <g fill="#fff" opacity="0.1">
          <polygon points="26,150 88,18 96,18 34,150" />
        </g>
      </svg>

      {/* número del día */}
      <div className="absolute left-4 top-3 leading-none">
        <span
          className={`heat-num block tracking-[-0.02em] ${compact ? "text-[46px]" : "text-[68px]"}`}
          style={{ transform: "skewX(-8deg)", transformOrigin: "left bottom" }}
          aria-label={numberLabel ?? `Día ${day}`}
        >
          {day}
        </span>
      </div>
      <div className={`absolute inline-flex items-center gap-1.5 rounded-full bg-night/75 font-slab text-paper ${compact ? "right-2.5 top-3 px-2.5 py-1 text-[12px]" : "right-3.5 top-4 px-3 py-1.5 text-[14px]"}`}>
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ink-lift" />
        {badge ?? FOCUS_LABEL_ES[focus]}
      </div>

      {/* arte */}
      <div className={`absolute inset-x-0 top-[17%] flex items-center justify-center ${subtitle ? "bottom-[29%]" : "bottom-[23%]"}`}>
        <div aria-hidden="true" className="absolute inset-x-[8%] inset-y-[4%] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(255 255 255 / 0.2), transparent)" }} />
        <div className="relative">{art}</div>
      </div>

      {/* banner del nombre */}
      <div className="absolute inset-x-3 bottom-3 rounded-[14px] bg-night/80 px-3 py-2.5 text-center text-paper backdrop-blur-sm">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap font-slab" style={{ fontSize: titleSize }}>
          {title}
        </div>
        {subtitle && <div className="mt-1.5 truncate font-num text-[13.5px] font-bold leading-none text-paper-dim">{subtitle}</div>}
      </div>
      {footer}
    </div>
  );
}
