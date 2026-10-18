"use client";

import { GoogleCta } from "@/components/landing/GoogleCta";
import { CardFan } from "@/components/landing/CardFan";
import { Wordmark } from "@/components/ui/Wordmark";
import { APP_NAME_DISPLAY } from "@/lib/config";

/**
 * Acceso a pantalla completa. Se ve en la app instalada (donde la portada pública no tiene sentido) y es el respaldo
 * de la portada: mismas cartas y mismo botón de Google.
 */
export function LoginScreen() {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-safe">
      <header className="flex items-center justify-center pt-6">
        <h1 aria-label={APP_NAME_DISPLAY}>
          <Wordmark size="lg" plate />
        </h1>
      </header>

      {/* mano de cartas */}
      <section className="relative mt-4 flex flex-1 items-center justify-center" aria-label="Vista previa de tus cartas diarias">
        <CardFan />
      </section>

      <section className="pb-1 pt-5 text-center">
        <h2 className="font-slab text-[28px] leading-[1.08] text-balance">Una carta nueva cada día.</h2>
        <ul className="mx-auto mt-3 max-w-[22rem] space-y-1.5 text-left text-[14.5px] text-paper-dim">
          <li className="flex gap-2.5">
            <Dot /> Rutinas con pesa rusa basadas en estudios.
          </li>
          <li className="flex gap-2.5">
            <Dot /> Te guía en cada serie, descanso y repetición.
          </li>
          <li className="flex gap-2.5">
            <Dot /> Tu historial te espera con tu cuenta de Google.
          </li>
        </ul>
      </section>

      <div className="mt-5">
        <GoogleCta />
        <p className="mt-3 text-center text-[14px] text-paper-mute">Solo con Google: así tu progreso viaja contigo a cualquier teléfono.</p>
      </div>
    </main>
  );
}

function Dot() {
  return <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-ink-lift" aria-hidden="true" />;
}
