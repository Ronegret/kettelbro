/**
 * Señales del acompañante: pitidos (WebAudio), voz (SpeechSynthesis) y vibración.
 * Todo es opcional y se respeta lo que el usuario apague en ajustes. Sin dependencias.
 * Los navegadores exigen un gesto del usuario antes de sonar: se inicializa en el primer toque (EMPEZAR).
 */

import { chooseVoice, type VoiceGender } from "@/lib/voice";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Debe llamarse dentro de un gesto del usuario (p. ej. el toque en EMPEZAR). */
export function primeAudio() {
  audio();
  try {
    // Algunos iOS solo habilitan la voz tras un primer speak() disparado por un gesto.
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* sin voz */
  }
}

export interface CueSettings {
  sound: boolean;
  voice: boolean;
  haptics: boolean;
  /** Género de la voz del instructor: mujer con Princess, hombre con Bro (ver lib/voice.ts). */
  gender?: VoiceGender;
}

export function beep(s: CueSettings, freq = 880, ms = 90, gain = 0.12) {
  if (!s.sound) return;
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

/** Tictac de metrónomo: grave y corto. */
export const tick = (s: CueSettings) => beep(s, 520, 45, 0.07);
/** Cuenta atrás 3-2-1. */
export const countBeep = (s: CueSettings) => beep(s, 740, 110, 0.14);
/** Inicio de trabajo: agudo y largo. */
export const goBeep = (s: CueSettings) => beep(s, 1180, 280, 0.16);

export function vibrate(s: CueSettings, pattern: number | number[]) {
  if (!s.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin vibración */
  }
}

let lastSpoken = "";
export function speak(s: CueSettings, text: string, opts?: { interrupt?: boolean }) {
  if (!s.voice || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const synth = window.speechSynthesis;
    if (opts?.interrupt !== false) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // El español del dispositivo si lo es (es-ES, es-AR...); si no, es-MX.
    const deviceEs = typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es") ? navigator.language : "es-MX";
    u.lang = deviceEs;
    u.rate = 1.02;
    const { voice, pitch } = chooseVoice(synth.getVoices(), deviceEs, s.gender);
    u.pitch = pitch;
    if (voice) u.voice = voice;
    lastSpoken = text;
    synth.speak(u);
  } catch {
    /* sin voz */
  }
}

export function stopSpeaking() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {
    /* noop */
  }
  lastSpoken = "";
}

export const _lastSpoken = () => lastSpoken;

/**
 * Mantiene la pantalla encendida durante la sesión (Wake Lock API). Devuelve cómo liberar y si el bloqueo funcionó:
 * `ok` es false sin la API o si el sistema lo rechaza (p. ej. ahorro de batería), y la interfaz lo avisa.
 */
export async function keepAwake(): Promise<{ release: () => void; ok: boolean }> {
  const none = { release: () => {}, ok: false };
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    if (!nav.wakeLock) return none;
    let lock = await nav.wakeLock.request("screen");
    const onVis = async () => {
      if (document.visibilityState === "visible") {
        try {
          lock = await nav.wakeLock!.request("screen");
        } catch {
          /* noop */
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return {
      ok: true,
      release: () => {
        document.removeEventListener("visibilitychange", onVis);
        void lock.release().catch(() => {});
      },
    };
  } catch {
    return none;
  }
}
