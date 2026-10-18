import { BroBell, type BroMood } from "@/components/ui/BroBell";
import { Wordmark } from "@/components/ui/Wordmark";
import { SlowHint } from "./SlowHint";

/** Franjas de velocidad en diagonal detrás de la mascota: formas planas de la tinta del día. */
function Speed() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="100" height="100" fill="var(--night)" />
      <rect width="100" height="100" fill="var(--ink-deep)" opacity="0.45" />
      <g fill="var(--ink)" opacity="0.5">
        <polygon points="-20,92 38,-10 58,-10 0,102" />
        <polygon points="46,112 112,-4 126,-4 60,112" />
      </g>
      <g fill="#fff" opacity="0.06">
        <polygon points="20,112 84,-6 92,-6 28,112" />
      </g>
    </svg>
  );
}

/**
 * Pantalla de carga con la marca grande: El Bro, el nombre de la app en una placa de su tinta y una barra de carga.
 * Se ve mientras se resuelve la sesión y se recupera el historial.
 */
export function Splash({
  message = "Cargando tu historial…",
  mood = "hype",
  children,
  showLoader = true,
}: {
  message?: string;
  mood?: BroMood;
  /** Acciones (reintentar, salir) cuando algo falló. */
  children?: React.ReactNode;
  showLoader?: boolean;
}) {
  return (
    <main data-focus="power" className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center" aria-busy="true" aria-live="polite">
      <Speed />
      <div className="relative z-10 flex flex-col items-center gap-7">
        <div style={{ animation: "pulse-beat 1.6s var(--ease-out) infinite" }}>
          <BroBell mood={mood} size={196} />
        </div>
        <Wordmark size="xl" plate />
        <p className="font-slab text-[24px] text-paper">Una sesión nueva cada día.</p>
        {showLoader && (
          <div className="h-2.5 w-44 overflow-hidden rounded-full bg-night-3" role="presentation">
            <div className="h-full w-1/3 rounded-full bg-ink" style={{ animation: "load-slide 1.3s var(--ease-out) infinite" }} />
          </div>
        )}
        <p className="text-[15px] text-paper-dim">{message}</p>
        {children ?? <SlowHint />}
      </div>
    </main>
  );
}
