"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Acción destructiva con "mantén pulsado": un relleno lineal de 1,6 s evita descartar una sesión por un toque accidental.
 * Al soltar antes, el relleno vuelve en 200 ms (asimétrico: lento mientras decides, rápido cuando el sistema responde).
 * Teclado: Enter o Espacio confirman directamente (mantener pulsada una tecla no es práctico y ya es deliberado).
 */
export function HoldToConfirm({ children, hint, onConfirm, holdMs = 1600, className = "" }: { children: ReactNode; hint?: string; onConfirm: () => void; holdMs?: number; className?: string }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onConfirm();
    }, holdMs);
  };
  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onClick={(e) => {
        if (e.detail === 0) onConfirm(); // activado con teclado
      }}
      className={`relative h-14 w-full select-none overflow-hidden rounded-[14px] border-2 border-[#ff5f6d]/60 text-[#ffb3c8] ${className}`}
      style={{ touchAction: "none" }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[#ff5f6d]/45"
        style={{ clipPath: holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)", transition: holding ? `clip-path ${holdMs}ms linear` : "clip-path 200ms var(--ease-out)" }}
      />
      <span className="relative flex flex-col items-center justify-center leading-tight">
        <span className="font-slab text-[16px]">{children}</span>
        {hint && <span className="text-[13px] opacity-90">{hint}</span>}
      </span>
    </button>
  );
}
