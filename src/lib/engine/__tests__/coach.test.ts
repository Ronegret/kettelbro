import { describe, expect, it } from "vitest";
import {
  EXERCISES,
  NOVICE_RPE_CAPS,
  bodyRead,
  coachingFor,
  compileSteps,
  defaultSettings,
  generateSession,
  introPath,
  stepDurationSec,
  type SessionPlan,
  type UserSettings,
} from "..";

const UID = "uid-coach";

function settings(over: Partial<UserSettings> = {}): UserSettings {
  return { ...defaultSettings(), level: "novice", minutes: 20, bells: [6, 8, 12, 16], referenceKg: 8, ...over };
}
const withBody = (kg: number, cm: number): Partial<UserSettings> => ({ body: { heightCm: cm, weights: [{ date: "2026-01-01", kg }] } });
const plan = (day: number, s: UserSettings): SessionPlan =>
  generateSession({ uid: UID, dayIndex: day, settings: s, memory: {}, daysSinceLast: 1, lastRpe: null, lastFeel: null });
const ids = (p: SessionPlan) => p.blocks.map((b) => b.exerciseId);
const isBallistic = (id: keyof typeof EXERCISES) => EXERCISES[id].category === "ballistic";

describe("el preparador: lectura del cuerpo", () => {
  it("clasifica el IMC y no inventa datos si no hay peso", () => {
    expect(bodyRead(settings())).toBeNull();
    expect(bodyRead(settings(withBody(50, 175)))?.band).toBe("low");
    expect(bodyRead(settings(withBody(70, 175)))?.band).toBe("normal");
    expect(bodyRead(settings(withBody(85, 175)))?.band).toBe("over");
    expect(bodyRead(settings(withBody(110, 175)))?.band).toBe("high");
  });
});

describe("el preparador: rampa de iniciación", () => {
  it("el esfuerzo tope sube semana a semana y el volumen y el descanso se normalizan", () => {
    const c = [1, 8, 15, 22].map((d) => coachingFor(settings(), d));
    expect(c.map((x) => x.rpeCap)).toEqual([4.5, 5, 5.5, 5.5]);
    expect(c[0]!.fill).toBeLessThan(c[1]!.fill);
    expect(c[1]!.fill).toBeLessThan(c[2]!.fill);
    expect(c[0]!.restMult).toBeGreaterThan(c[2]!.restMult);
    expect(c[0]!.gentle && c[1]!.gentle).toBe(true);
    expect(c[2]!.gentle).toBe(false);
    expect(NOVICE_RPE_CAPS[0]).toBe(4.5);
  });
  it("quien ya entrena solo calibra la primera semana y el avanzado no tiene rampa", () => {
    expect(coachingFor(settings({ level: "intermediate" }), 3).rpeCap).toBe(6.5);
    expect(coachingFor(settings({ level: "intermediate" }), 10).rpeCap).toBeNull();
    expect(coachingFor(settings({ level: "advanced" }), 1)).toMatchObject({ rpeCap: null, fill: 1, restMult: 1, gentle: false });
  });
  it("el primer día de un principiante NO es un get-up turco y es suave", () => {
    const d1 = plan(1, settings());
    expect(ids(d1)).not.toContain("turkish-get-up");
    expect(d1.rpeTarget).toBeLessThanOrEqual(4.5);
  });
  it("el get-up turco llega después de las 4 semanas de iniciación", () => {
    const early = Array.from({ length: 28 }, (_, i) => plan(i + 1, settings())).filter((p) => p.focus === "skill");
    for (const p of early) expect(ids(p)).not.toContain("turkish-get-up");
    const late = Array.from({ length: 28 }, (_, i) => plan(29 + i, settings())).filter((p) => p.focus === "skill" && p.phase !== "deload");
    expect(late.some((p) => ids(p).includes("turkish-get-up"))).toBe(true);
  });
  it("la semana 1 es más suave que la 3: menos esfuerzo y descansos más largos", () => {
    const strength = (day: number) => plan(day, settings());
    const w1 = strength(2); // fuerza, semana 1
    const w3 = strength(16); // fuerza, semana 3
    expect(w1.focus).toBe("strength");
    expect(w3.focus).toBe("strength");
    expect(w1.rpeTarget).toBeLessThan(w3.rpeTarget);
    const rest = (p: SessionPlan) => {
      const b = p.blocks.find((x) => x.role === "primary")!.protocol;
      return b.kind === "sets" ? b.restSec : 0;
    };
    expect(rest(w1)).toBeGreaterThan(rest(w3));
  });
  it("en la semana 1 el tiempo que sobra se llena con técnica y movilidad, no con más series", () => {
    const p = plan(2, settings());
    expect(p.blocks.filter((b) => b.role === "secondary").length).toBeLessThanOrEqual(1);
    const calm = p.blocks.filter((b) => b.role === "cooldown").reduce((a, b) => a + (b.protocol.kind === "flow" ? b.protocol.seconds : 0), 0);
    expect(calm).toBeGreaterThan(60);
  });
  it("explica a la persona qué se hizo a su medida", () => {
    expect(plan(2, settings()).whyEs.join(" ")).toMatch(/iniciación/);
  });
});

describe("el preparador: peso y estatura", () => {
  const heavy = settings(withBody(110, 172)); // IMC ~37
  it("con IMC alto no hay ejercicios balísticos ni días de potencia las primeras 4 semanas", () => {
    for (let d = 1; d <= 28; d++) {
      const p = plan(d, heavy);
      expect(p.focus === "power" || p.focus === "hybrid", `día ${d}`).toBe(false);
      for (const id of ids(p)) expect(isBallistic(id), `día ${d}: ${id}`).toBe(false);
    }
    expect(coachingFor(heavy, 20).lowImpact).toBe(true);
    expect(coachingFor(heavy, 30).lowImpact).toBe(false);
  });
  it("con IMC alto los swings se retrasan hasta el día 29 y con IMC normal entran el 15", () => {
    expect(coachingFor(heavy, 1).swingFromDay).toBe(29);
    expect(coachingFor(settings(withBody(70, 175)), 1).swingFromDay).toBe(15);
    expect(coachingFor(settings(), 1).swingFromDay).toBe(15);
  });
  it("con carga relativa alta los descansos son más largos y el volumen menor que con IMC normal", () => {
    const heavyC = coachingFor(heavy, 9);
    const normalC = coachingFor(settings(withBody(70, 175)), 9);
    expect(heavyC.restMult).toBeGreaterThan(normalC.restMult);
    expect(heavyC.fill).toBeLessThan(normalC.fill);
    expect(heavyC.notesEs.join(" ")).toMatch(/IMC 37/);
  });
  it("sin peso ni estatura el plan sigue funcionando (el cuerpo es opcional)", () => {
    expect(coachingFor(settings(), 5).band).toBeNull();
    expect(() => plan(5, settings())).not.toThrow();
  });
});

describe("el preparador: el camino de iniciación", () => {
  it("solo existe para principiantes y trae 4 semanas con esfuerzo creciente", () => {
    expect(introPath(settings({ level: "advanced" }))).toBeNull();
    const path = introPath(settings())!;
    expect(path.map((s) => s.week)).toEqual([1, 2, 3, 4]);
    expect(path[0]!.effortEs).toBe("4-4,5 de 10".replace("4-4,5", "4-4,5"));
  });
});

describe("el preparador no rompe la duración exacta", () => {
  it("20 min son 20 min con cualquier perfil corporal, nivel y día de las primeras 6 semanas", () => {
    const bad: string[] = [];
    const bodies: Array<Partial<UserSettings>> = [{}, withBody(50, 175), withBody(75, 175), withBody(95, 170), withBody(120, 165)];
    for (const level of ["novice", "intermediate"] as const) {
      for (const minutes of [10, 20] as const) {
        for (const [bi, b] of bodies.entries()) {
          for (let d = 1; d <= 42; d++) {
            const s = settings({ level, minutes, ...b });
            const p = plan(d, s);
            if (p.focus === "recovery") continue;
            const real = compileSteps(p).reduce((a, st) => a + stepDurationSec(st), 0);
            if (Math.abs(real - minutes * 60) > 10) bad.push(`${level} ${minutes}min cuerpo${bi} día ${d}: ${real}s`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
