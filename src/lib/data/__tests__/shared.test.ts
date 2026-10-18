import { describe, expect, it } from "vitest";
import { bestSetPerExercise, dedupeGoals, isBetterRecord, sessionDocId, stripUndefined } from "../shared";
import type { SessionLog } from "@/lib/engine/types";

describe("stripUndefined", () => {
  it("elimina undefined a cualquier profundidad pero conserva null, 0, false y ''", () => {
    const input = { a: 1, b: undefined, c: null, d: { e: undefined, f: 0, g: false, h: "" }, i: [1, undefined, { j: undefined, k: 2 }] };
    expect(stripUndefined(input)).toEqual({ a: 1, c: null, d: { f: 0, g: false, h: "" }, i: [1, { k: 2 }] });
  });

  it("no muta el original", () => {
    const input = { a: undefined, b: { c: 1 } };
    stripUndefined(input);
    expect("a" in input).toBe(true);
  });

  it("deja intactos los objetos no planos (Date, etc.)", () => {
    const date = new Date(0);
    expect(stripUndefined({ date }).date).toBe(date);
  });
});

describe("sessionDocId", () => {
  it("es determinista: mismo día e inicio => mismo id", () => {
    expect(sessionDocId({ dayIndex: 12, startedAt: 1700 })).toBe("s12-1700");
  });
});

describe("isBetterRecord", () => {
  it("compara primero la pesa y después las repeticiones", () => {
    expect(isBetterRecord({ bellKg: 16, reps: 5 }, undefined)).toBe(true);
    expect(isBetterRecord({ bellKg: 20, reps: 1 }, { bellKg: 16, reps: 30 })).toBe(true);
    expect(isBetterRecord({ bellKg: 12, reps: 50 }, { bellKg: 16, reps: 5 })).toBe(false);
    expect(isBetterRecord({ bellKg: 16, reps: 6 }, { bellKg: 16, reps: 5 })).toBe(true);
    expect(isBetterRecord({ bellKg: 16, reps: 5 }, { bellKg: 16, reps: 5 })).toBe(false);
  });
});

describe("bestSetPerExercise / dedupeGoals", () => {
  it("elige la mejor serie por ejercicio e ignora saltadas, sin reps o sin carga", () => {
    const log = {
      dayIndex: 3,
      date: "2026-10-15",
      sets: [
        { exerciseId: "goblet-squat", blockId: "a", setIndex: 0, side: "both", reps: 8, bellKg: 16 },
        { exerciseId: "goblet-squat", blockId: "a", setIndex: 1, side: "both", reps: 10, bellKg: 16 },
        { exerciseId: "goblet-squat", blockId: "a", setIndex: 2, side: "both", reps: 50, bellKg: 24, skipped: true },
        { exerciseId: "farmer-carry", blockId: "b", setIndex: 0, side: "both", reps: 0, bellKg: 24 },
        { exerciseId: "halo", blockId: "c", setIndex: 0, side: "both", reps: 10, bellKg: 0 },
      ],
    } as unknown as SessionLog;
    const best = bestSetPerExercise(log);
    expect([...best.keys()]).toEqual(["goblet-squat"]);
    expect(best.get("goblet-squat")).toMatchObject({ bellKg: 16, reps: 10, dayIndex: 3 });
  });

  it("dedupeGoals conserva la primera aparición", () => {
    expect(dedupeGoals([{ id: "a", completedAt: 1 }, { id: "a", completedAt: 2 }, { id: "b", completedAt: 3 }])).toEqual([
      { id: "a", completedAt: 1 },
      { id: "b", completedAt: 3 },
    ]);
  });
});
