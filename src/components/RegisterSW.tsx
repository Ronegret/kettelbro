"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/install";

/** Registra el service worker solo en producción (en desarrollo estorba al hot reload). */
export function RegisterSW() {
  useEffect(() => {
    captureInstallPrompt(); // el aviso de instalación se dispara una sola vez: hay que guardarlo al arrancar
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
