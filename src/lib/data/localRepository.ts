/**
 * Implementación de `Repository` sobre localStorage.
 *
 * ⚠️ SOLO PARA DEMO / DESARROLLO (NEXT_PUBLIC_DEMO_MODE=1). Los datos viven en este navegador,
 * no hay sincronización ni seguridad. En producción se usa FirestoreRepository.
 *
 * Se comporta igual que la versión de Firestore (usuario nuevo => Día 1, cierre de sesión
 * atómico, récords solo si mejoran, metas que no se reescriben). Claves: `kb:v1:${uid}:${nombre}`.
 *
 * localStorage puede estar bloqueado (modo privado, políticas del navegador) o llenarse:
 *  - Si no está disponible, se usa un Map en memoria (la app funciona durante la sesión).
 *  - Si una escritura falla a mitad (cuota), `commit` restaura los valores anteriores.
 */
import { SCHEMA_VERSION } from "@/lib/config";
import { createInitialState } from "@/lib/engine/defaults";
import type {
  ActiveSessionDraft,
  AppUser,
  ExerciseId,
  GoalCompletionDoc,
  ProgramState,
  ResumeBundle,
  SessionLog,
  UserProfileDoc,
  UserSettings,
} from "@/lib/engine/types";
import type { PersonalRecord, Repository } from "./repository";
import { bestSetPerExercise, dedupeGoals, improvedRecords, sessionDocId, stripUndefined } from "./shared";

/** Subconjunto de la API Storage que necesitamos (permite inyectar un shim en tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalRepositoryOptions {
  /** Almacenamiento a usar. Por defecto, `localStorage` del navegador (si existe y no está bloqueado). */
  storage?: StorageLike;
  /** Reloj inyectable (tests). Por defecto, `Date.now`. */
  now?: () => number;
}

/** Nombres de los "documentos" guardados por usuario. */
type DocName = "profile" | "settings" | "program" | "draft" | "sessions" | "records" | "goals";

/** Tope de sesiones guardadas localmente: localStorage ronda los 5 MB. */
const MAX_LOCAL_SESSIONS = 300;

const key = (uid: string, name: DocName) => `kb:v1:${uid}:${name}`;

export class LocalRepository implements Repository {
  private readonly memory = new Map<string, string>();
  private readonly now: () => number;
  private readonly injected: StorageLike | undefined;

  constructor(options: LocalRepositoryOptions = {}) {
    this.injected = options.storage;
    this.now = options.now ?? Date.now;
  }

  // ───────────────────────── Acceso a bajo nivel ─────────────────────────

  /** localStorage utilizable, o `null` (acceder a `localStorage` puede lanzar SecurityError). */
  private storage(): StorageLike | null {
    if (this.injected) return this.injected;
    try {
      return typeof localStorage === "undefined" ? null : localStorage;
    } catch {
      return null;
    }
  }

  private getRaw(k: string): string | null {
    try {
      const store = this.storage();
      if (store) return store.getItem(k);
    } catch {
      /* ilegible: tratar como vacío */
      return null;
    }
    return this.memory.get(k) ?? null;
  }

  /** `value === null` borra la clave. Puede lanzar (cuota llena): `commit` lo gestiona. */
  private setRaw(k: string, value: string | null): void {
    const store = this.storage();
    if (!store) {
      if (value === null) this.memory.delete(k);
      else this.memory.set(k, value);
      return;
    }
    if (value === null) store.removeItem(k);
    else store.setItem(k, value);
  }

  /** Lee y parsea un documento; JSON corrupto => `null` (se trata como inexistente). */
  private read<T>(uid: string, name: DocName): T | null {
    const raw = this.getRaw(key(uid, name));
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Escribe varios documentos como una unidad lógica: se serializa todo ANTES de tocar el
   * almacenamiento y, si alguna escritura falla, se restauran los valores previos.
   * `null` = borrar el documento.
   */
  private commit(uid: string, writes: Array<[DocName, unknown]>): void {
    const prepared = writes.map(([name, value]) => ({
      k: key(uid, name),
      next: value === null ? null : JSON.stringify(stripUndefined(value)),
    }));
    const previous = prepared.map((w) => ({ k: w.k, raw: this.getRaw(w.k) }));
    try {
      for (const w of prepared) this.setRaw(w.k, w.next);
    } catch (error) {
      for (const p of previous) {
        try {
          this.setRaw(p.k, p.raw);
        } catch {
          /* mejor esfuerzo al deshacer */
        }
      }
      throw error;
    }
  }

  // ───────────────────────── Repository ─────────────────────────

  async resume(user: AppUser): Promise<ResumeBundle> {
    const uid = user.uid;
    const now = this.now();

    const profile = this.read<UserProfileDoc>(uid, "profile");
    const settings = this.read<UserSettings>(uid, "settings");
    const storedState = this.read<ProgramState>(uid, "program");
    const draft = this.read<ActiveSessionDraft>(uid, "draft");
    const sessions = this.read<SessionLog[]>(uid, "sessions") ?? [];
    const goals = this.read<Record<string, GoalCompletionDoc>>(uid, "goals") ?? {};

    const lastSession = sessions[0] ?? null; // se guardan ordenadas, la más nueva primero
    const completedGoalIds = Object.keys(goals);
    const state = storedState ?? createInitialState(now);

    const base = { user, settings, state, lastSession, draft, completedGoalIds };

    if (!profile) {
      // Usuario nuevo: perfil + Día 1 (atómico)
      const newProfile: UserProfileDoc = {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: now,
        lastLoginAt: now,
        schemaVersion: SCHEMA_VERSION,
      };
      this.commit(uid, [
        ["profile", newProfile],
        ["program", state],
      ]);
      return { ...base, isNewUser: true };
    }

    // Usuario existente: lastLoginAt (no crítico) y, si faltaba el program, se recrea.
    try {
      this.commit(uid, [
        ["profile", { ...profile, displayName: user.displayName, email: user.email, photoURL: user.photoURL, lastLoginAt: now }],
        ...(storedState ? [] : ([["program", state]] as Array<[DocName, unknown]>)),
      ]);
    } catch {
      /* no crítico */
    }
    return { ...base, isNewUser: false };
  }

  async saveSettings(uid: string, settings: UserSettings): Promise<void> {
    this.commit(uid, [["settings", settings]]);
  }

  /** Cierre de sesión "atómico": una sola llamada a `commit` con todo (y rollback si falla). */
  async completeSession(
    uid: string,
    log: SessionLog,
    nextState: ProgramState,
    goalCompletions: GoalCompletionDoc[],
  ): Promise<void> {
    const sessionId = sessionDocId(log);
    const sessionLog: SessionLog = { ...log, id: sessionId };

    // Sesiones: idempotente por id (reintentar no duplica), más nueva primero, con tope.
    const sessions = (this.read<SessionLog[]>(uid, "sessions") ?? []).filter((s) => s.id !== sessionId);
    sessions.push(sessionLog);
    sessions.sort((a, b) => b.endedAt - a.endedAt);
    sessions.splice(MAX_LOCAL_SESSIONS);

    // Récords: solo si mejoran (pesa y luego repeticiones), igual que en Firestore.
    const records = this.read<Record<string, PersonalRecord>>(uid, "records") ?? {};
    const existing = new Map<ExerciseId, PersonalRecord>(Object.entries(records) as Array<[ExerciseId, PersonalRecord]>);
    for (const record of improvedRecords(bestSetPerExercise(sessionLog), existing)) {
      records[record.exerciseId] = record;
    }

    // Metas: crear-solo (una meta ya completada conserva su fecha original).
    const goals = this.read<Record<string, GoalCompletionDoc>>(uid, "goals") ?? {};
    for (const goal of dedupeGoals(goalCompletions)) {
      if (!goals[goal.id]) goals[goal.id] = goal;
    }

    this.commit(uid, [
      ["sessions", sessions],
      ["program", nextState],
      ["records", records],
      ["goals", goals],
      ["draft", null],
    ]);
  }

  async saveDraft(uid: string, draft: ActiveSessionDraft): Promise<void> {
    this.commit(uid, [["draft", draft]]);
  }

  async clearDraft(uid: string): Promise<void> {
    this.commit(uid, [["draft", null]]);
  }

  async listSessions(uid: string, max = 60): Promise<SessionLog[]> {
    return (this.read<SessionLog[]>(uid, "sessions") ?? []).slice(0, max);
  }

  async listPersonalRecords(uid: string): Promise<PersonalRecord[]> {
    return Object.values(this.read<Record<string, PersonalRecord>>(uid, "records") ?? {});
  }
}
