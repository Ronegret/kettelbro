"use client";

import { motion, useReducedMotion } from "motion/react";
import { BroBell } from "@/components/ui/BroBell";
import { LoteriaCard } from "@/components/ui/LoteriaCard";

/** Mini pesa dibujada para las cartas de fondo. */
function BellGlyph({ rotate = 0 }: { rotate?: number }) {
  return (
    <svg viewBox="0 0 100 100" width="62%" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
      <path d="M30 42C26 10 74 10 70 42" fill="none" stroke="var(--night)" strokeWidth="14" strokeLinecap="round" />
      <circle cx="53" cy="66" r="29" fill="var(--ink-deep)" />
      <circle cx="50" cy="63" r="29" fill="#f4f6fa" stroke="var(--night)" strokeWidth="4.5" />
      <path d="M31 55a21 21 0 0 1 14-14" fill="none" stroke="var(--ink)" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Mano de tres cartas que se reparten al abrir la pantalla. El contenedor reserva su espacio (sin saltos de diseño). */
export function CardFan() {
  const reduce = useReducedMotion();
  const deal = (delay: number, x: number, rotate: number) => ({
    initial: reduce ? false : { opacity: 0, y: 90, x: 0, rotate: 0, scale: 0.92 },
    animate: { opacity: 1, y: 0, x, rotate, scale: 1 },
    transition: { duration: 0.8, delay, ease: EASE },
  });

  return (
    <div className="relative mx-auto h-[346px] w-[244px]" role="img" aria-label="Tres tarjetas de ejemplo: Potencia, Fuerza y Resistencia">
      <motion.div className="absolute inset-0" {...deal(0.15, -58, -11)}>
        <LoteriaCard day={22} focus="strength" title="EL GET-UP" reveal={false} heat={0.4} art={<BellGlyph rotate={-14} />} />
      </motion.div>
      <motion.div className="absolute inset-0" {...deal(0.3, 58, 10)}>
        <LoteriaCard day={9} focus="endurance" title="EL RELOJ" reveal={false} heat={0.6} art={<BellGlyph rotate={12} />} />
      </motion.div>
      <motion.div className="absolute inset-0" {...deal(0.5, 0, -1.5)}>
        <LoteriaCard
          day={1}
          focus="power"
          title="EL BRO"
          heat={0.8}
          art={
            <motion.div animate={reduce ? undefined : { y: [0, -5, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}>
              <BroBell mood="hype" size={150} />
            </motion.div>
          }
        />
      </motion.div>
    </div>
  );
}
