"use client";

import { useSyncExternalStore } from "react";
import { has3DClip } from "./clips";
import { CHARACTER_KEY, figViewKey, isCharacterId, parseView, saveCharacter, saveFigView, type CharacterId, type FigureViewInput } from "./types";
import type { ExerciseId } from "@/lib/engine/types";

/**
 * Preferencias de los instructores en este dispositivo (localStorage): personaje, vista por ejercicio y 3D sí/no.
 * Lecturas con useSyncExternalStore: el servidor y el primer pintado del cliente usan los valores por defecto, así que
 * no hay desajuste de hidratación, y cualquier cambio se refleja a la vez en todas las figuras de la pantalla.
 */
const EVENT = "kb:figprefs";
const ENABLED_KEY = "kb:fig3d";

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return ""; // acceder a localStorage puede lanzar SecurityError
  }
}
const notify = () => window.dispatchEvent(new Event(EVENT));

export function useCharacter(): CharacterId {
  const v = useSyncExternalStore(subscribe, () => read(CHARACTER_KEY), () => "");
  return isCharacterId(v) ? v : "bro";
}
export function setCharacter(c: CharacterId): void {
  saveCharacter(c);
  notify();
}

/** Vista elegida para un ejercicio, o undefined (= la mejor vista de ese ejercicio). */
export function useFigureView(id: ExerciseId): FigureViewInput | undefined {
  const raw = useSyncExternalStore(subscribe, () => read(figViewKey(id)), () => "");
  return parseView(raw) ?? undefined;
}
export function setFigureView(id: ExerciseId, v: FigureViewInput): void {
  saveFigView(id, v);
  notify();
}

/** ¿Instructores en 3D activados? Por defecto sí; «Figuras en 3D» en Perfil lo apaga y vuelve la figura 2D de siempre. */
export function use3dEnabled(): boolean {
  return useSyncExternalStore(subscribe, () => read(ENABLED_KEY) !== "0", () => true);
}
export function set3dEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* sin almacenamiento: vale solo hasta recargar */
  }
  notify();
}

/** ¿Este ejercicio se dibuja en 3D ahora mismo? (activado + tiene clip) */
export function useIs3d(id: ExerciseId): boolean {
  return use3dEnabled() && has3DClip(id);
}
