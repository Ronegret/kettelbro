/**
 * Aleatoriedad DETERMINISTA. Misma semilla => misma secuencia, en cualquier dispositivo.
 * Es lo que permite que la rutina del "Día 45" sea idéntica al recargar o cambiar de teléfono,
 * y que cada usuario tenga su propio orden de rotación de ejercicios (semilla = UID).
 */

/** Hash de texto a entero de 32 bits (xmur3). */
export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** PRNG mulberry32: devuelve una función que produce números en [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(...parts: Array<string | number>): () => number {
  return mulberry32(hashString(parts.join("|")));
}

/** Baraja determinista (Fisher-Yates) sin mutar la entrada. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Rotación justa: devuelve el elemento `exposure`-ésimo de un orden barajado POR USUARIO.
 * Garantiza que no se repite ningún elemento hasta haber pasado por todos (variedad sin azar puro).
 */
export function rotate<T>(items: readonly T[], userSeed: string, slotKey: string, exposure: number): T {
  if (items.length === 0) throw new Error(`rotate: pool vacío para ${slotKey}`);
  const order = shuffled(items, makeRng(userSeed, slotKey));
  return order[((exposure % order.length) + order.length) % order.length] as T;
}
