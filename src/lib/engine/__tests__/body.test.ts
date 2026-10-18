import { describe, expect, it } from "vitest";
import {
  BELL_CHECK_EVERY_DAYS,
  STANDARD_BELLS,
  WEIGH_EVERY_DAYS,
  addWeight,
  bmi,
  clampMinutes,
  defaultSettings,
  dueCheckIns,
  generateSession,
  nearestStandardBell,
  recommendBells,
  weightTrend,
  type BodyProfile,
  type UserSettings,
} from "..";

const body = (over: Partial<BodyProfile> = {}): BodyProfile => ({ heightCm: 175, weights: [{ date: "2026-01-01", kg: 75 }], ...over });
const settings = (over: Partial<UserSettings> = {}): UserSettings => ({ ...defaultSettings(), onboardedAt: Date.UTC(2026, 0, 1, 12), body: body(), ...over });

describe("recomendación de pesas por peso y estatura", () => {
  it("devuelve siempre tallas reales y un set ordenado con la referencia dentro", () => {
    for (const level of ["novice", "intermediate", "advanced"] as const) {
      for (const w of [48, 60, 72, 85, 100, 130]) {
        for (const h of [150, 165, 178, 192]) {
          const r = recommendBells({ weightKg: w, heightCm: h, level });
          expect(STANDARD_BELLS).toContain(r.referenceKg);
          expect(r.starterSet).toContain(r.referenceKg);
          expect([...r.starterSet].sort((a, b) => a - b)).toEqual(r.starterSet);
          expect(r.rangeKg[0]).toBeLessThanOrEqual(r.referenceKg);
          expect(r.rangeKg[1]).toBeGreaterThanOrEqual(r.referenceKg);
          expect(r.nextKg).toBeGreaterThan(r.referenceKg);
          expect(r.lightKg).toBeLessThanOrEqual(r.referenceKg);
        }
      }
    }
  });
  it("un principiante nunca arranca con más de 16 kg, ni uno intermedio con más de 24", () => {
    expect(recommendBells({ weightKg: 140, heightCm: 190, level: "novice" }).referenceKg).toBeLessThanOrEqual(16);
    expect(recommendBells({ weightKg: 140, heightCm: 190, level: "intermediate" }).referenceKg).toBeLessThanOrEqual(24);
  });
  it("más peso (a igual estatura y nivel) no baja la recomendación y más nivel la sube", () => {
    const l = recommendBells({ weightKg: 60, heightCm: 170, level: "intermediate" }).referenceKg;
    const h = recommendBells({ weightKg: 80, heightCm: 170, level: "intermediate" }).referenceKg;
    expect(h).toBeGreaterThanOrEqual(l);
    const n = recommendBells({ weightKg: 75, heightCm: 175, level: "novice" }).referenceKg;
    const a = recommendBells({ weightKg: 75, heightCm: 175, level: "advanced" }).referenceKg;
    expect(a).toBeGreaterThan(n);
  });
  it("la estatura frena la carga con IMC alto: 130 kg a 165 cm no recomienda más que 95 kg a 165 cm", () => {
    const heavy = recommendBells({ weightKg: 130, heightCm: 165, level: "intermediate" });
    expect(heavy.basisKg).toBeLessThan(130);
    expect(heavy.bmi).toBeGreaterThan(30);
    expect(heavy.notesEs.join(" ")).toMatch(/conservadora/);
  });
  it("nearestStandardBell redondea a la talla más cercana", () => {
    expect(nearestStandardBell(13)).toBe(12);
    expect(nearestStandardBell(21.5)).toBe(20);
    expect(bmi(70, 175)).toBeCloseTo(22.9, 1);
  });
});

describe("pesajes y revisiones dentro del plan", () => {
  it("pide pesarse cada 7 días y no antes", () => {
    const s = settings();
    expect(dueCheckIns(s, "2026-01-05").find((c) => c.id === "weigh-in")).toBeUndefined();
    expect(dueCheckIns(s, "2026-01-08").find((c) => c.id === "weigh-in")).toBeDefined();
    expect(WEIGH_EVERY_DAYS).toBe(7);
  });
  it("sin datos de cuerpo no pide pesaje (se puede entrenar sin darlos)", () => {
    const s = settings({ body: undefined });
    expect(dueCheckIns(s, "2026-03-01").find((c) => c.id === "weigh-in")).toBeUndefined();
  });
  it("pide revisar las pesas cada 28 días y se apaga al marcarla", () => {
    const s = settings();
    expect(dueCheckIns(s, "2026-01-20").find((c) => c.id === "bell-check")).toBeUndefined();
    expect(dueCheckIns(s, "2026-01-29").find((c) => c.id === "bell-check")).toBeDefined();
    const done = settings({ body: body({ bellsCheckedAt: "2026-01-29" }) });
    expect(dueCheckIns(done, "2026-02-10").find((c) => c.id === "bell-check")).toBeUndefined();
    expect(BELL_CHECK_EVERY_DAYS).toBe(28);
  });
  it("addWeight reemplaza el pesaje del mismo día, ordena y acota", () => {
    let b = body({ weights: [] });
    b = addWeight(b, "2026-01-08", 74.84);
    b = addWeight(b, "2026-01-01", 75);
    b = addWeight(b, "2026-01-08", 74.5);
    expect(b.weights).toEqual([
      { date: "2026-01-01", kg: 75 },
      { date: "2026-01-08", kg: 74.5 },
    ]);
  });
  it("weightTrend compara con un pesaje de hace al menos 3 semanas", () => {
    expect(weightTrend([{ date: "2026-01-01", kg: 75 }, { date: "2026-01-08", kg: 74 }])).toBeNull();
    expect(weightTrend([{ date: "2026-01-01", kg: 75 }, { date: "2026-01-29", kg: 73.5 }])).toEqual({ deltaKg: -1.5, days: 28 });
  });
});

describe("sesiones de máximo 25 minutos", () => {
  it("clampMinutes lleva ajustes antiguos (35, 45) a 25 y respeta las opciones válidas", () => {
    expect(clampMinutes(45)).toBe(25);
    expect(clampMinutes(35)).toBe(25);
    expect(clampMinutes(25)).toBe(25);
    expect(clampMinutes(20)).toBe(20);
    expect(clampMinutes(12)).toBe(10);
    expect(clampMinutes(Number.NaN)).toBe(20);
  });
  it("ninguna sesión generada pasa de ~29 minutos aunque el ajuste guardado diga 45", () => {
    const s = { ...defaultSettings(), level: "intermediate" as const, bells: [8, 12, 16, 20], referenceKg: 16, minutes: 45 as never };
    for (let d = 1; d <= 120; d++) {
      const p = generateSession({ uid: "u", dayIndex: d, settings: s, memory: {}, daysSinceLast: 1, lastRpe: null, lastFeel: null });
      expect(p.durationMin).toBeLessThanOrEqual(31);
    }
  });
});
