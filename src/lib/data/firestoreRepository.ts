/**
 * Implementación de `Repository` sobre Cloud Firestore (producción).
 *
 * Estructura (TODO cuelga del uid del usuario; ver docs/ARQUITECTURA-DATOS-AUTH.md):
 *
 *   users/{uid}                       -> UserProfileDoc
 *   users/{uid}/meta/settings         -> UserSettings
 *   users/{uid}/meta/program          -> ProgramState        (1 doc = lectura barata del "Día N")
 *   users/{uid}/meta/draft            -> ActiveSessionDraft  (sesión en curso, recuperable)
 *   users/{uid}/sessions/{sessionId}  -> SessionLog          (solo se CREA; historial inmutable)
 *   users/{uid}/records/{exerciseId}  -> PersonalRecord
 *   users/{uid}/goals/{goalId}        -> GoalCompletionDoc   (solo se CREA)
 *
 * Todas las fechas son epoch ms (number), nunca Timestamp de Firestore.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
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
import { requireDb } from "@/lib/firebase/client";
import type { PersonalRecord, Repository } from "./repository";
import { bestSetPerExercise, dedupeGoals, improvedRecords, sessionDocId, stripUndefined } from "./shared";

// ───────────────────────── Referencias a documentos ─────────────────────────

const refs = {
  user: (db: Firestore, uid: string) => doc(db, "users", uid),
  settings: (db: Firestore, uid: string) => doc(db, "users", uid, "meta", "settings"),
  program: (db: Firestore, uid: string) => doc(db, "users", uid, "meta", "program"),
  draft: (db: Firestore, uid: string) => doc(db, "users", uid, "meta", "draft"),
  sessions: (db: Firestore, uid: string) => collection(db, "users", uid, "sessions"),
  session: (db: Firestore, uid: string, id: string) => doc(db, "users", uid, "sessions", id),
  records: (db: Firestore, uid: string) => collection(db, "users", uid, "records"),
  record: (db: Firestore, uid: string, id: ExerciseId) => doc(db, "users", uid, "records", id),
  goals: (db: Firestore, uid: string) => collection(db, "users", uid, "goals"),
  goal: (db: Firestore, uid: string, id: string) => doc(db, "users", uid, "goals", id),
};

/** Perfil a partir del usuario de Google (los `null` se guardan tal cual; `undefined` jamás). */
function profileFields(user: AppUser): Pick<UserProfileDoc, "displayName" | "email" | "photoURL"> {
  return { displayName: user.displayName, email: user.email, photoURL: user.photoURL };
}

/** Rechaza si `promise` no resuelve en `ms` (se usa para no quedarse esperando a la red). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Lee el récord existente de un ejercicio ANTES de decidir si se mejora.
 *  - Con red: lee del servidor (dato fresco), con un tope de 2,5 s.
 *  - Sin red / lento: usa la caché local (instantáneo) para no retrasar el guardado de la sesión.
 *  - Sin dato en ninguna parte: `undefined` (se tratará como primer récord).
 */
async function readExistingRecord(ref: DocumentReference): Promise<PersonalRecord | undefined> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!offline) {
    try {
      const snap = await withTimeout(getDoc(ref), 2500);
      return snap.exists() ? (snap.data() as PersonalRecord) : undefined;
    } catch {
      /* sin respuesta a tiempo: probamos la caché */
    }
  }
  try {
    const snap = await getDocFromCache(ref);
    return snap.exists() ? (snap.data() as PersonalRecord) : undefined;
  } catch {
    return undefined; // no está en caché
  }
}

export class FirestoreRepository implements Repository {
  /**
   * Arranque tras el login. UNA ronda de lecturas en PARALELO:
   *   perfil + settings + program + draft + última sesión + metas  (5 + nº de metas lecturas)
   * Usuario nuevo => crea perfil + program inicial (Día 1) en un writeBatch.
   */
  async resume(user: AppUser): Promise<ResumeBundle> {
    const db = requireDb();
    const uid = user.uid;

    const [profileSnap, settingsSnap, programSnap, draftSnap, lastSessionSnap, goalsSnap] = await Promise.all([
      getDoc(refs.user(db, uid)),
      getDoc(refs.settings(db, uid)),
      getDoc(refs.program(db, uid)),
      getDoc(refs.draft(db, uid)),
      getDocs(query(refs.sessions(db, uid), orderBy("endedAt", "desc"), limit(1))),
      getDocs(refs.goals(db, uid)),
    ]);

    const now = Date.now();
    const settings = settingsSnap.exists() ? (settingsSnap.data() as UserSettings) : null;
    const draft = draftSnap.exists() ? (draftSnap.data() as ActiveSessionDraft) : null;
    const lastSession = (lastSessionSnap.docs[0]?.data() as SessionLog | undefined) ?? null;
    const completedGoalIds = goalsSnap.docs.map((d) => d.id);

    // ── Usuario nuevo: crear perfil + estado inicial de forma atómica ──
    if (!profileSnap.exists()) {
      const profile: UserProfileDoc = {
        ...profileFields(user),
        createdAt: now,
        lastLoginAt: now,
        schemaVersion: SCHEMA_VERSION,
      };
      const state = programSnap.exists() ? (programSnap.data() as ProgramState) : createInitialState(now);
      const batch = writeBatch(db);
      batch.set(refs.user(db, uid), stripUndefined(profile));
      if (!programSnap.exists()) batch.set(refs.program(db, uid), stripUndefined(state));
      await batch.commit();
      return { user, isNewUser: true, settings, state, lastSession, draft, completedGoalIds };
    }

    // ── Usuario existente: refrescar lastLoginAt SIN bloquear la UI ──
    void updateDoc(refs.user(db, uid), stripUndefined({ ...profileFields(user), lastLoginAt: now })).catch(() => {
      /* no crítico: si falla (offline), no afecta al arranque */
    });

    // Defensa: perfil sin program (documento borrado a mano) => se recrea en Día 1.
    let state: ProgramState;
    if (programSnap.exists()) {
      state = programSnap.data() as ProgramState;
    } else {
      state = createInitialState(now);
      void setDoc(refs.program(db, uid), stripUndefined(state)).catch(() => {});
    }

    return { user, isNewUser: false, settings, state, lastSession, draft, completedGoalIds };
  }

  async saveSettings(uid: string, settings: UserSettings): Promise<void> {
    await setDoc(refs.settings(requireDb(), uid), stripUndefined(settings));
  }

  /**
   * Cierre de sesión ATÓMICO con un único `writeBatch`:
   *   crea sesión + reemplaza program + sube récords mejorados + crea metas + borra draft.
   *
   * ¿Por qué writeBatch y no runTransaction? Una transacción exige conexión (lee del servidor y
   * falla sin red), y el usuario entrena en gimnasios con mala cobertura. El batch se encola en
   * la caché persistente y se envía al reconectar, siempre completo o nada. El único coste:
   * los récords se leen ANTES del batch (no dentro), así que dos dispositivos terminando una
   * sesión a la vez podrían pisarse un récord; para un usuario individual es aceptable.
   */
  async completeSession(
    uid: string,
    log: SessionLog,
    nextState: ProgramState,
    goalCompletions: GoalCompletionDoc[],
  ): Promise<void> {
    const db = requireDb();
    const sessionId = sessionDocId(log);
    const sessionLog: SessionLog = { ...log, id: sessionId };

    // 1) Récords: leer el existente de cada ejercicio de la sesión (normalmente 3-6 lecturas).
    const candidates = bestSetPerExercise(sessionLog);
    const existingEntries = await Promise.all(
      [...candidates.keys()].map(async (id) => [id, await readExistingRecord(refs.record(db, uid, id))] as const),
    );
    const existing = new Map<ExerciseId, PersonalRecord>();
    for (const [id, record] of existingEntries) if (record) existing.set(id, record);
    const newRecords = improvedRecords(candidates, existing);

    // 2) Todas las escrituras en un solo batch.
    const batch = writeBatch(db);
    batch.set(refs.session(db, uid, sessionId), stripUndefined(sessionLog));
    batch.set(refs.program(db, uid), stripUndefined(nextState));
    for (const record of newRecords) {
      batch.set(refs.record(db, uid, record.exerciseId), stripUndefined(record));
    }
    for (const goal of dedupeGoals(goalCompletions)) {
      batch.set(refs.goal(db, uid, goal.id), stripUndefined(goal));
    }
    batch.delete(refs.draft(db, uid));
    await batch.commit();
  }

  async saveDraft(uid: string, draft: ActiveSessionDraft): Promise<void> {
    await setDoc(refs.draft(requireDb(), uid), stripUndefined(draft));
  }

  async clearDraft(uid: string): Promise<void> {
    await deleteDoc(refs.draft(requireDb(), uid));
  }

  async listSessions(uid: string, max = 60): Promise<SessionLog[]> {
    const snap = await getDocs(query(refs.sessions(requireDb(), uid), orderBy("endedAt", "desc"), limit(max)));
    return snap.docs.map((d) => d.data() as SessionLog);
  }

  async listPersonalRecords(uid: string): Promise<PersonalRecord[]> {
    const snap = await getDocs(refs.records(requireDb(), uid));
    return snap.docs.map((d) => d.data() as PersonalRecord);
  }
}
