export type BroMood = "idle" | "hype" | "fire" | "sleep" | "sweat" | "wink";

/**
 * "El Bro": la pesa rusa con cara. Personaje de la lotería de kettellbro.
 * Dibujado en tinta plana con contorno grueso y sombra de impresión desfasada (como un grabado mal registrado).
 * Hereda la tinta del contenedor (--ink / --ink-deep): cambia de color con el enfoque del día.
 */
export function BroBell({ mood = "idle", size = 120, className = "" }: { mood?: BroMood; size?: number; className?: string }) {
  const closed = mood === "sleep";
  return (
    <svg
      viewBox="0 0 120 124"
      width={size}
      height={(size * 124) / 120}
      className={className}
      role="img"
      aria-label={`El Bro, la pesa rusa mascota (${mood})`}
    >
      {/* suelo */}
      <ellipse cx="60" cy="116" rx="34" ry="5" fill="var(--night)" opacity="0.35" />

      {/* llamas (fire) */}
      {mood === "fire" && (
        <g>
          <path d="M60 4c4 8 12 12 12 22 0 7-5 12-12 12s-12-5-12-12c0-5 3-8 5-11 1 4 3 5 4 5-1-6-1-11 3-16Z" fill="#ffb41f" stroke="var(--night)" strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M60 18c2 4 6 6 6 11 0 4-3 6-6 6s-6-2-6-6c0-3 2-5 3-6 1 2 2 3 3 2Z" fill="#f4f6fa" />
        </g>
      )}

      {/* asa */}
      <path d="M36 52C32 22 88 22 84 52" fill="none" stroke="var(--night)" strokeWidth="19" strokeLinecap="round" />
      <path d="M36 52C32 22 88 22 84 52" fill="none" stroke="var(--ink)" strokeWidth="10" strokeLinecap="round" />

      {/* cuerpo: sombra de impresión + contorno + campo */}
      <circle cx="64" cy="80" r="35" fill="var(--ink-deep)" />
      <circle cx="60" cy="76" r="35" fill="var(--ink)" stroke="var(--night)" strokeWidth="5" />
      {/* brillo plano */}
      <path d="M36 66a26 26 0 0 1 18-20" fill="none" stroke="#f4f6fa" strokeWidth="5" strokeLinecap="round" opacity="0.9" />

      {/* cejas */}
      <path d={mood === "sleep" ? "M37 64h14M69 64h14" : "M36 62l15 5M84 62l-15 5"} stroke="var(--night)" strokeWidth="5" strokeLinecap="round" />

      {/* ojos */}
      <g className="origin-center" style={{ transformBox: "fill-box", transformOrigin: "center", animation: closed ? undefined : "blink 4.2s infinite" }}>
        {closed ? (
          <>
            <path d="M39 76q6 5 12 0M69 76q6 5 12 0" fill="none" stroke="var(--night)" strokeWidth="4.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="45" cy="76" rx="8" ry="9.5" fill="#f4f6fa" stroke="var(--night)" strokeWidth="3.5" />
            <circle cx="47" cy="77" r="4.2" fill="var(--night)" />
            {mood === "wink" ? (
              <path d="M68 76q7 5 14 0" fill="none" stroke="var(--night)" strokeWidth="4.5" strokeLinecap="round" />
            ) : (
              <>
                <ellipse cx="75" cy="76" rx="8" ry="9.5" fill="#f4f6fa" stroke="var(--night)" strokeWidth="3.5" />
                <circle cx="73" cy="77" r="4.2" fill="var(--night)" />
              </>
            )}
          </>
        )}
      </g>

      {/* boca */}
      {mood === "hype" || mood === "fire" ? (
        <g>
          <path d="M44 92q16 18 32 0Z" fill="var(--night)" stroke="var(--night)" strokeWidth="4" strokeLinejoin="round" />
          <path d="M51 98q9 7 18 0q-9-3-18 0Z" fill="#ff5fa2" />
        </g>
      ) : mood === "sweat" ? (
        <path d="M46 96q4-4 7 0t7 0 7 0 7 0" fill="none" stroke="var(--night)" strokeWidth="4.5" strokeLinecap="round" />
      ) : mood === "sleep" ? (
        <ellipse cx="60" cy="96" rx="5" ry="4" fill="var(--night)" />
      ) : (
        <path d="M46 92q14 12 28 0" fill="none" stroke="var(--night)" strokeWidth="5" strokeLinecap="round" />
      )}

      {/* gota de sudor */}
      {mood === "sweat" && <path d="M95 52c5 8 8 12 8 17a8 8 0 0 1-16 0c0-5 3-9 8-17Z" fill="#4fc9e8" stroke="var(--night)" strokeWidth="3" strokeLinejoin="round" />}

      {/* zzz */}
      {mood === "sleep" && (
        <g fill="none" stroke="var(--paper)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M92 28h12l-12 13h12" />
          <path d="M104 12h8l-8 9h8" />
        </g>
      )}
    </svg>
  );
}
