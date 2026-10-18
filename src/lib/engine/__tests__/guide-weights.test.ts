import { describe, expect, it } from "vitest";
import { EXERCISES, recommendBells } from "..";

/**
 * Las cifras de la guía pública «Qué peso de pesa rusa elegir» (docs/SEO-GUIAS/que-peso-de-pesa-rusa-elegir.md) salen
 * de este mismo cálculo. Si el motor cambia, esta prueba obliga a actualizar la guía en vez de dejarla mintiendo.
 */
describe("guía de pesos: sus ejemplos coinciden con el motor", () => {
  const cases = [
    { perfil: "mujer 60 kg 1,65 m principiante", weightKg: 60, heightCm: 165, level: "novice", ref: 10, rango: [8, 12], ligera: 4, sig: 12, basis: 60 },
    { perfil: "hombre 75 kg 1,75 m principiante", weightKg: 75, heightCm: 175, level: "novice", ref: 12, rango: [10, 14], ligera: 6, sig: 14, basis: 75 },
    { perfil: "mujer 65 kg 1,65 m intermedia", weightKg: 65, heightCm: 165, level: "intermediate", ref: 16, rango: [14, 18], ligera: 8, sig: 18, basis: 65 },
    { perfil: "hombre 90 kg 1,80 m intermedio", weightKg: 90, heightCm: 180, level: "intermediate", ref: 24, rango: [20, 24], ligera: 12, sig: 28, basis: 90 },
    { perfil: "hombre 110 kg 1,75 m principiante", weightKg: 110, heightCm: 175, level: "novice", ref: 16, rango: [12, 16], ligera: 8, sig: 18, basis: 92 },
    { perfil: "mujer 52 kg 1,68 m principiante", weightKg: 52, heightCm: 168, level: "novice", ref: 8, rango: [6, 10], ligera: 4, sig: 10, basis: 47 },
  ] as const;

  for (const c of cases) {
    it(c.perfil, () => {
      const r = recommendBells({ weightKg: c.weightKg, heightCm: c.heightCm, level: c.level });
      expect({ ref: r.referenceKg, rango: r.rangeKg, ligera: r.lightKg, sig: r.nextKg, basis: r.basisKg }).toEqual({
        ref: c.ref,
        rango: [...c.rango],
        ligera: c.ligera,
        sig: c.sig,
        basis: c.basis,
      });
    });
  }

  it("las proporciones por ejercicio de la tabla de la guía coinciden con loadFactor", () => {
    expect(EXERCISES["kettlebell-deadlift"].loadFactor).toBe(1.25);
    expect(EXERCISES["two-hand-swing"].loadFactor).toBe(1);
    expect(EXERCISES["goblet-squat"].loadFactor).toBe(0.9);
    expect(EXERCISES["one-arm-row"].loadFactor).toBe(0.7);
    expect(EXERCISES["strict-press"].loadFactor).toBe(0.4);
    expect(EXERCISES["turkish-get-up"].loadFactor).toBe(0.3);
  });
});
