"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/config";
import { copyText, externalOpenUrl, isInAppBrowser } from "@/lib/inAppBrowser";

/**
 * Aviso para quien llega desde el visor interno de una red social: Google no deja iniciar sesión ahí.
 * No se ve en navegadores normales; el botón de Google sigue disponible debajo («Intentar de todos modos»).
 */
export function InAppBrowserNote() {
  // El navegador integrado solo se puede saber en el cliente (user agent); en el servidor no se renderiza.
  const [inApp, setInApp] = useState(false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setInApp(isInAppBrowser(navigator.userAgent));
  }, []);
  if (!inApp || dismissed) return null;
  return (
    <div role="note" className="mb-3 rounded-2xl border border-paper/25 bg-paper/10 p-4 text-left">
      <p className="font-slab text-[19px] leading-tight">Abre {APP_NAME} en tu navegador</p>
      <p className="mt-1.5 text-[14.5px] leading-snug text-paper-dim">
        Google no permite iniciar sesión dentro de este navegador integrado. Toca ••• o el menú y elige «Abrir en Safari» o «Abrir en Chrome».
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => setCopied((await copyText(externalOpenUrl(window.location.origin))) ? "ok" : "fail")}
          className="press inline-flex h-11 items-center rounded-full bg-paper px-5 text-[15px] font-semibold text-night"
        >
          {copied === "ok" ? "Enlace copiado" : "Copiar enlace"}
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="press inline-flex h-11 items-center rounded-full px-4 text-[15px] font-medium text-paper-dim">
          Intentar de todos modos
        </button>
      </div>
      <p className="mt-2 text-[14px] text-paper-mute" role="status">
        {copied === "ok" ? "Pégalo en Safari o Chrome." : copied === "fail" ? "No se pudo copiar. Mantén pulsada la barra de direcciones para copiarla." : ""}
      </p>
    </div>
  );
}
