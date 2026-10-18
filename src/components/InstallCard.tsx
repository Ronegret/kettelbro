"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { dismissInstall, shouldOfferInstall, useInstall } from "@/lib/install";
import { isInAppBrowser } from "@/lib/inAppBrowser";

/**
 * Invitación a instalar la app (pantalla completa, un toque desde el inicio). Aparece después de cumplir una carta, no
 * en la primera visita, y respeta el «Ahora no». En iPhone explica los pasos; en un navegador integrado pide abrirlo antes.
 */
export function InstallCard({ today }: { today: string }) {
  const { canPrompt, ios, installed, prompt } = useInstall();
  const [hidden, setHidden] = useState(() => (typeof window === "undefined" ? true : !shouldOfferInstall(today)));
  const [help, setHelp] = useState(false);
  const inApp = typeof navigator !== "undefined" && isInAppBrowser(navigator.userAgent);

  if (hidden || installed || (!canPrompt && !ios)) return null;

  const later = () => {
    dismissInstall(today);
    setHidden(true);
  };

  return (
    <section aria-labelledby="inst-h" className="rounded-[20px] bg-night-2 p-5">
      <h2 id="inst-h" className="font-slab text-2xl">
        Ten kettellbro en tu pantalla de inicio
      </h2>
      <p className="mt-1 text-[14.5px] leading-snug text-paper-dim">Se abre a pantalla completa, sin la barra del navegador, y tu sesión siempre a un toque.</p>
      {inApp && <p className="mt-2 text-[14.5px] leading-snug text-paper">Primero ábrelo en Safari o Chrome: desde este navegador integrado no se puede instalar.</p>}
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        <Button
          onClick={async () => {
            if (canPrompt) {
              if ((await prompt()) === "dismissed") later();
            } else setHelp(true);
          }}
        >
          {canPrompt ? "Instalar" : "Cómo instalarla"}
        </Button>
        <Button variant="ghost" onClick={later}>
          Ahora no
        </Button>
      </div>

      <Sheet open={help} onClose={() => setHelp(false)} title="Instalar en tu iPhone">
        <ol className="list-decimal space-y-2.5 pl-5 text-[16px] leading-snug text-paper-dim marker:font-bold marker:text-paper">
          <li>Abre kettellbro en Safari.</li>
          <li>Toca el botón Compartir (el cuadrado con una flecha hacia arriba).</li>
          <li>Desliza y elige «Agregar a pantalla de inicio». En algunos idiomas aparece como «Añadir a pantalla de inicio».</li>
          <li>Toca «Agregar» y abre el ícono nuevo.</li>
        </ol>
        <p className="mt-4 text-[14.5px] leading-snug text-paper-mute">Instálala desde Safari: desde otros navegadores las opciones pueden variar.</p>
        <Button variant="secondary" className="mt-5 w-full" onClick={() => setHelp(false)}>
          Entendido
        </Button>
      </Sheet>
    </section>
  );
}
