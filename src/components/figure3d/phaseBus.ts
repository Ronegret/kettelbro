"use client";

import { useSyncExternalStore } from "react";

/**
 * Fase (0..1) del movimiento que se está dibujando en la figura principal de la pantalla. La escribe el visor y la leen
 * las fichas de fases. Solo hay una figura «principal» por pantalla (la del reproductor o la de la ficha técnica).
 */
let phase = 0;
const subs = new Set<() => void>();

export function setPhase(p: number): void {
  phase = p;
  subs.forEach((f) => f());
}

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};

/** Paso (0..n-1) en el que va el movimiento. Solo provoca un nuevo pintado cuando cambia de paso, no en cada fotograma. */
export function usePhaseStep(n: number): number {
  return useSyncExternalStore(subscribe, () => Math.min(n - 1, Math.floor(phase * n)), () => 0);
}
