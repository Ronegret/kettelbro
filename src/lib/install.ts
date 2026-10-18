"use client";

import { useSyncExternalStore } from "react";
import { daysBetween } from "@/lib/engine/calendar";

/**
 * Instalación de la PWA. Chrome/Edge/Android avisan con `beforeinstallprompt` (hay que guardarlo al arrancar, porque se
 * dispara una sola vez); iPhone no tiene ese aviso y se instala a mano desde Safari.
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Se llama una vez al arrancar la app (RegisterSW). */
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Estado de instalación: si el navegador deja instalar con un toque (`canPrompt`) o hay que explicarlo (iPhone). */
export function useInstall(): { canPrompt: boolean; ios: boolean; installed: boolean; prompt: () => Promise<"accepted" | "dismissed" | "unavailable"> } {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const done = useSyncExternalStore(subscribe, () => installed || isStandalone(), () => false);
  const ios = useSyncExternalStore(subscribe, () => isIos(), () => false);
  return {
    canPrompt,
    ios,
    installed: done,
    async prompt() {
      if (!deferred) return "unavailable";
      const ev = deferred;
      deferred = null; // el evento solo sirve una vez
      emit();
      await ev.prompt();
      return (await ev.userChoice).outcome;
    },
  };
}

// ───────────────────────── Cuándo mostrar la tarjeta ─────────────────────────

const KEY = "kb:install";
const MAX_DISMISSALS = 3;
const COOLDOWN_DAYS = 14;

interface State {
  dismissed: number;
  last: string | null;
}

function read(): State {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as State | null;
    return v && typeof v.dismissed === "number" ? v : { dismissed: 0, last: null };
  } catch {
    return { dismissed: 0, last: null };
  }
}

/** Se ofrece tras cumplir al menos una carta, nunca más de 3 veces y no antes de 14 días desde que se dijo «Ahora no». */
export function shouldOfferInstall(today: string): boolean {
  const s = read();
  if (s.dismissed >= MAX_DISMISSALS) return false;
  return s.last === null || daysBetween(s.last, today) >= COOLDOWN_DAYS;
}

export function dismissInstall(today: string): void {
  try {
    const s = read();
    window.localStorage.setItem(KEY, JSON.stringify({ dismissed: s.dismissed + 1, last: today }));
  } catch {
    /* sin almacenamiento: la tarjeta puede volver a salir */
  }
}
