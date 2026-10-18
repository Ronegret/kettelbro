import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/lib/engine/defaults";
import type {
  ActiveSessionDraft,
  AppUser,
  ProgramState,
  SessionLog,
  SessionPlan,
  SetLog,
  UserSettings,
} from "@/lib/engine/types";
import { LocalRepository, type StorageLike } from "../localRepository";

/** Shim mínimo de localStorage para el entorno Node de Vitest. */
class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const T0 = 1_760_000_000_000; // epoch ms fijo
const user: AppUser = { uid: "u1", displayName: "Bro Test", email: "bro@test.dev", photoURL: null };

function makeSet(over: Partial<SetLog> = {}): SetLog {
  return { exerciseId: "two-hand-swing", blockId: "b1", setIndex: 0, side: "both", reps: 10, bellKg: 16, ...over };
}

function makeLog(dayIndex: number, startedAt: number, sets: SetLog[] = [makeSet()]): SessionLog {
  return {
    id: "ignorado-por-el-repo",
    dayIndex,
    date: "2026-10-15",
    focus: "power",
    title: "EL SWING",
    phase: "accumulate",
    mesocycle: 1,
    startedAt,
    endedAt: startedAt + 25 * 60_000,
    durationSec: 25 * 60,
    rpe: 7,
    feel: 2,
    sets,
    totalReps: sets.reduce((n, s) => n + s.reps, 0),
    tonnageKg: sets.reduce((n, s) => n + s.reps * s.bellKg, 0),
    xpEarned: 100,
  };
}

function nextStateAfter(log: SessionLog): ProgramState {
  const base = createInitialState(T0);
  return {
    ...base,
    dayIndex: log.dayIndex + 1,
    lastSessionDate: log.date,
    streak: log.dayIndex,
    bestStreak: log.dayIndex,
    xp: log.dayIndex * 100,
    totals: { ...base.totals, sessions: log.dayIndex, reps: log.totalReps },
  };
}

function makeDraft(): ActiveSessionDraft {
  const plan = { id: "d1", dayIndex: 1, blocks: [] } as unknown as SessionPlan;
  return { plan, startedAt: T0, stepIndex: 3, sets: [makeSet()], updatedAt: T0 + 1000 };
}

const settings: UserSettings = {
  level: "intermediate",
  primaryGoal: "strength",
  minutes: 20,
  bells: [12, 16, 20],
  referenceKg: 16,
  voice: true,
  sound: false,
  haptics: true,
  onboardedAt: T0,
};

let storage: MemoryStorage;
let repo: LocalRepository;

beforeEach(() => {
  storage = new MemoryStorage();
  // Se instala como `localStorage` global: así se prueba la ruta por defecto del repositorio.
  vi.stubGlobal("localStorage", storage);
  repo = new LocalRepository({ now: () => T0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalRepository.resume", () => {
  it("usuario nuevo => perfil creado, isNewUser y Día 1", async () => {
    const bundle = await repo.resume(user);

    expect(bundle.isNewUser).toBe(true);
    expect(bundle.state.dayIndex).toBe(1);
    expect(bundle.state.streak).toBe(0);
    expect(bundle.settings).toBeNull(); // falta onboarding
    expect(bundle.lastSession).toBeNull();
    expect(bundle.draft).toBeNull();
    expect(bundle.completedGoalIds).toEqual([]);
    // Persistido con el esquema de claves acordado
    expect(storage.data.has("kb:v1:u1:profile")).toBe(true);
    expect(storage.data.has("kb:v1:u1:program")).toBe(true);
  });

  it("segundo login => no es nuevo, conserva el estado y actualiza lastLoginAt", async () => {
    await repo.resume(user);
    const later = new LocalRepository({ now: () => T0 + 5000 });
    const bundle = await later.resume(user);

    expect(bundle.isNewUser).toBe(false);
    expect(bundle.state.dayIndex).toBe(1);
    const profile = JSON.parse(storage.data.get("kb:v1:u1:profile") ?? "{}") as { createdAt: number; lastLoginAt: number };
    expect(profile.createdAt).toBe(T0);
    expect(profile.lastLoginAt).toBe(T0 + 5000);
  });

  it("los usuarios están aislados por uid", async () => {
    await repo.resume(user);
    const log = makeLog(1, T0);
    await repo.completeSession("u1", log, nextStateAfter(log), []);

    const other = await repo.resume({ ...user, uid: "u2" });
    expect(other.isNewUser).toBe(true);
    expect(other.state.dayIndex).toBe(1);
    expect(other.lastSession).toBeNull();
  });

  it("JSON corrupto se trata como dato inexistente (no revienta)", async () => {
    await repo.resume(user);
    storage.data.set("kb:v1:u1:program", "{no es json");
    const bundle = await repo.resume(user);
    expect(bundle.state.dayIndex).toBe(1);
  });
});

describe("LocalRepository.completeSession", () => {
  it("avanza el estado (Día 2), borra el borrador y guarda la sesión", async () => {
    await repo.resume(user);
    await repo.saveDraft("u1", makeDraft());
    expect((await repo.resume(user)).draft).not.toBeNull();

    const log = makeLog(1, T0);
    await repo.completeSession("u1", log, nextStateAfter(log), [{ id: "first-session", completedAt: log.endedAt }]);

    const bundle = await repo.resume(user);
    expect(bundle.state.dayIndex).toBe(2);
    expect(bundle.state.streak).toBe(1);
    expect(bundle.draft).toBeNull();
    expect(bundle.completedGoalIds).toEqual(["first-session"]);
    expect(storage.data.has("kb:v1:u1:draft")).toBe(false);
  });

  it("resume tras completeSession devuelve la última sesión correcta", async () => {
    await repo.resume(user);
    const first = makeLog(1, T0);
    const second = makeLog(2, T0 + 24 * 3_600_000);
    await repo.completeSession("u1", first, nextStateAfter(first), []);
    await repo.completeSession("u1", second, nextStateAfter(second), []);

    const bundle = await repo.resume(user);
    expect(bundle.lastSession?.dayIndex).toBe(2);
    expect(bundle.lastSession?.id).toBe(`s2-${second.startedAt}`); // id idempotente derivado
    expect(bundle.state.dayIndex).toBe(3);

    const list = await repo.listSessions("u1");
    expect(list.map((s) => s.dayIndex)).toEqual([2, 1]); // más nueva primero
    expect(await repo.listSessions("u1", 1)).toHaveLength(1);
  });

  it("es idempotente: reintentar el mismo log no duplica la sesión", async () => {
    await repo.resume(user);
    const log = makeLog(1, T0);
    await repo.completeSession("u1", log, nextStateAfter(log), []);
    await repo.completeSession("u1", log, nextStateAfter(log), []);
    expect(await repo.listSessions("u1")).toHaveLength(1);
  });

  it("récords: solo se actualizan si mejoran (pesa primero, luego repeticiones)", async () => {
    await repo.resume(user);

    const a = makeLog(1, T0, [makeSet({ reps: 10, bellKg: 16 })]);
    await repo.completeSession("u1", a, nextStateAfter(a), []);
    let records = await repo.listPersonalRecords("u1");
    expect(records).toEqual([{ exerciseId: "two-hand-swing", bellKg: 16, reps: 10, dayIndex: 1, date: a.date }]);

    // Más repeticiones con MENOS peso: no es récord
    const b = makeLog(2, T0 + 1000, [makeSet({ reps: 30, bellKg: 12 })]);
    await repo.completeSession("u1", b, nextStateAfter(b), []);
    records = await repo.listPersonalRecords("u1");
    expect(records[0]).toMatchObject({ bellKg: 16, reps: 10, dayIndex: 1 });

    // Misma pesa, más repeticiones: sí
    const c = makeLog(3, T0 + 2000, [makeSet({ reps: 12, bellKg: 16 })]);
    await repo.completeSession("u1", c, nextStateAfter(c), []);
    records = await repo.listPersonalRecords("u1");
    expect(records[0]).toMatchObject({ bellKg: 16, reps: 12, dayIndex: 3 });

    // Más peso: sí, aunque con menos repeticiones. Las series saltadas no cuentan.
    const d = makeLog(4, T0 + 3000, [
      makeSet({ reps: 5, bellKg: 20 }),
      makeSet({ reps: 99, bellKg: 32, skipped: true }),
    ]);
    await repo.completeSession("u1", d, nextStateAfter(d), []);
    records = await repo.listPersonalRecords("u1");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ bellKg: 20, reps: 5, dayIndex: 4 });
  });

  it("las metas completadas conservan su fecha original (solo se crean)", async () => {
    await repo.resume(user);
    const a = makeLog(1, T0);
    await repo.completeSession("u1", a, nextStateAfter(a), [{ id: "g1", completedAt: 111 }]);
    const b = makeLog(2, T0 + 1000);
    await repo.completeSession("u1", b, nextStateAfter(b), [
      { id: "g1", completedAt: 999 },
      { id: "g2", completedAt: 222 },
    ]);
    const bundle = await repo.resume(user);
    expect(bundle.completedGoalIds.sort()).toEqual(["g1", "g2"]);
    const goals = JSON.parse(storage.data.get("kb:v1:u1:goals") ?? "{}") as Record<string, { completedAt: number }>;
    expect(goals.g1?.completedAt).toBe(111);
  });

  it("es atómico: si una escritura falla se restaura todo (rollback)", async () => {
    await repo.resume(user);
    await repo.saveDraft("u1", makeDraft());
    const before = new Map(storage.data);

    // Cuota llena: la 3.ª escritura lanza
    let writes = 0;
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      writes += 1;
      if (writes === 3) throw new Error("QuotaExceededError");
      realSet(k, v);
    };

    const log = makeLog(1, T0);
    await expect(repo.completeSession("u1", log, nextStateAfter(log), [{ id: "g1", completedAt: 1 }])).rejects.toThrow(
      "QuotaExceededError",
    );

    expect(new Map(storage.data)).toEqual(before); // nada cambió
    storage.setItem = realSet;
    const bundle = await repo.resume(user);
    expect(bundle.state.dayIndex).toBe(1);
    expect(bundle.lastSession).toBeNull();
    expect(bundle.draft).not.toBeNull(); // el borrador sigue ahí
  });
});

describe("LocalRepository: ajustes y borrador", () => {
  it("saveSettings se refleja en resume; clearDraft borra el borrador", async () => {
    await repo.resume(user);
    await repo.saveSettings("u1", settings);
    await repo.saveDraft("u1", makeDraft());

    let bundle = await repo.resume(user);
    expect(bundle.settings).toEqual(settings);
    expect(bundle.draft?.stepIndex).toBe(3);

    await repo.clearDraft("u1");
    bundle = await repo.resume(user);
    expect(bundle.draft).toBeNull();
  });
});

describe("LocalRepository sin localStorage", () => {
  it("si localStorage está bloqueado, funciona en memoria durante la sesión", async () => {
    // Acceder a `localStorage` lanza SecurityError (p. ej. cookies bloqueadas)
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    const blocked = new LocalRepository({ now: () => T0 });

    const first = await blocked.resume(user);
    expect(first.isNewUser).toBe(true);
    const log = makeLog(1, T0);
    await blocked.completeSession("u1", log, nextStateAfter(log), []);
    const again = await blocked.resume(user);
    expect(again.isNewUser).toBe(false);
    expect(again.state.dayIndex).toBe(2);
  });
});
