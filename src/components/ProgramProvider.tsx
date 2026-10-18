"use client";

/**
 * ProgramProvider: store ligero y compartido con el estado del usuario en memoria
 * (ajustes, estado del programa, última sesión, borrador, metas completadas).
 *
 * Flujo:  AuthProvider (uid) -> useResume() -> ResumeBundle -> este contexto -> useProgram() en la UI.
 *
 * Las acciones (`saveSettings`, `saveDraft`, `clearDraft`, `completeSession`) son OPTIMISTAS:
 *  1. actualizan el estado local al instante (la UI nunca espera a la red),
 *  2. persisten en el repositorio,
 *  3. si falla, avisan en `syncError` y reconcilian recargando desde el repositorio.
 *
 * OFFLINE: con la caché persistente de Firestore las escrituras quedan en cola y su promesa no se
 * resuelve hasta reconectar. Por eso `persist()` espera como máximo `QUEUE_GRACE_MS`: pasado ese
 * tiempo da la escritura por "en cola" y devuelve el control a la UI (sigue contando en `pending`).
 *
 * Montaje:  <AuthProvider><ProgramProvider>{children}</ProgramProvider></AuthProvider>
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getRepository } from "@/lib/data";
import type { PersonalRecord } from "@/lib/data/repository";
import { describeDataError, sessionDocId } from "@/lib/data/shared";
import { useResume, type ResumeStatus } from "@/lib/data/useResume";
import type {
  ActiveSessionDraft,
  AppUser,
  GoalCompletionDoc,
  ProgramState,
  ResumeBundle,
  SessionLog,
  UserSettings,
} from "@/lib/engine/types";

/** Tiempo máximo que una acción hace esperar a la UI antes de considerarse "en cola" (offline). */
const QUEUE_GRACE_MS = 3000;
/** El borrador se escribe como mucho una vez cada tanto (ahorra escrituras y batería). */
const DRAFT_WRITE_INTERVAL_MS = 1500;

export interface ProgramContextValue {
  /** Estado de la carga inicial (resume). Mientras no haya sesión permanece en 'loading'. */
  status: ResumeStatus;
  /** Error de la carga inicial (mensaje en español) o null. */
  error: string | null;
  user: AppUser | null;
  /** true si es la primera vez que entra este usuario (se acaba de crear su perfil). */
  isNewUser: boolean;
  /** null => falta onboarding. */
  settings: UserSettings | null;
  /** null hasta que status === 'ready'. */
  state: ProgramState | null;
  lastSession: SessionLog | null;
  /** Borrador de una sesión interrumpida (para "Continuar sesión"). */
  draft: ActiveSessionDraft | null;
  completedGoalIds: string[];

  /** Escrituras pendientes de confirmar por el servidor (>0 mientras se sincroniza / sin red). */
  pending: number;
  /** Último error de sincronización (se limpia solo al siguiente guardado correcto). */
  syncError: string | null;

  refresh(): Promise<void>;
  saveSettings(settings: UserSettings): Promise<void>;
  /** Guarda el borrador (optimista, con limitación de frecuencia). */
  saveDraft(draft: ActiveSessionDraft): void;
  clearDraft(): Promise<void>;
  /** Cierra la sesión de forma atómica (log + estado + récords + metas + borra borrador). */
  completeSession(log: SessionLog, nextState: ProgramState, goalCompletions: GoalCompletionDoc[]): Promise<void>;
  /** Historial reciente (más nuevo primero). Lectura directa, no se guarda en el store. */
  listSessions(max?: number): Promise<SessionLog[]>;
  listPersonalRecords(): Promise<PersonalRecord[]>;
}

const ProgramContext = createContext<ProgramContextValue | null>(null);

export function ProgramProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const { status, bundle, error, refresh, setBundle } = useResume();

  const [pending, setPending] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const uid = bundle?.user.uid ?? null;
  const repo = getRepository();

  // "Último valor" accesible desde callbacks estables sin recrearlos en cada render.
  const bundleRef = useRef(bundle);
  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  /** Aplica un cambio optimista al estado en memoria (y a la ref, para llamadas seguidas). */
  const apply = useCallback(
    (updater: (prev: ResumeBundle) => ResumeBundle) => {
      const prev = bundleRef.current;
      if (!prev) return;
      const next = updater(prev);
      bundleRef.current = next;
      setBundle(() => next);
    },
    [setBundle],
  );

  /**
   * Ejecuta una escritura contando `pending`. Si falla: registra `syncError`, reconcilia con el
   * repositorio y relanza el error (solo llega al llamador si falla ANTES de QUEUE_GRACE_MS).
   */
  const persist = useCallback((work: Promise<void>): Promise<void> => {
    setPending((n) => n + 1);
    const tracked = work.then(
      () => {
        setPending((n) => n - 1);
        setSyncError(null);
      },
      (e: unknown) => {
        setPending((n) => n - 1);
        setSyncError(describeDataError(e));
        void refreshRef.current(); // volver a la verdad del repositorio
        throw e;
      },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const grace = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, QUEUE_GRACE_MS);
    });
    const clear = () => clearTimeout(timer);
    tracked.then(clear, clear);
    return Promise.race([tracked, grace]);
  }, []);

  // ───────────────────────── Borrador con limitación de frecuencia ─────────────────────────

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftQueued = useRef<{ uid: string; draft: ActiveSessionDraft } | null>(null);

  /** Escribe ya el último borrador pendiente (si lo hay). */
  const flushDraft = useCallback(() => {
    if (draftTimer.current) {
      clearTimeout(draftTimer.current);
      draftTimer.current = null;
    }
    const queued = draftQueued.current;
    draftQueued.current = null;
    if (queued) persist(repo.saveDraft(queued.uid, queued.draft)).catch(() => {});
  }, [persist, repo]);

  /** Descarta el borrador pendiente (al cerrar la sesión ya no tiene sentido escribirlo). */
  const discardQueuedDraft = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    draftQueued.current = null;
  }, []);

  // Si la app pasa a segundo plano o se cierra, no perder el último paso.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushDraft);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushDraft);
    };
  }, [flushDraft]);

  // Al cambiar de usuario (o cerrar sesión) no escribir un borrador pendiente con credenciales ajenas.
  useEffect(() => discardQueuedDraft, [uid, discardQueuedDraft]);

  // ───────────────────────── Acciones ─────────────────────────

  const saveSettings = useCallback(
    async (settings: UserSettings) => {
      if (!uid) throw new Error("No hay sesión activa.");
      apply((b) => ({ ...b, settings }));
      await persist(repo.saveSettings(uid, settings));
    },
    [uid, apply, persist, repo],
  );

  const saveDraft = useCallback(
    (draft: ActiveSessionDraft) => {
      if (!uid) return;
      apply((b) => ({ ...b, draft }));
      draftQueued.current = { uid, draft };
      draftTimer.current ??= setTimeout(flushDraft, DRAFT_WRITE_INTERVAL_MS);
    },
    [uid, apply, flushDraft],
  );

  const clearDraft = useCallback(async () => {
    if (!uid) return;
    discardQueuedDraft();
    apply((b) => ({ ...b, draft: null }));
    await persist(repo.clearDraft(uid));
  }, [uid, apply, discardQueuedDraft, persist, repo]);

  const completeSession = useCallback(
    async (log: SessionLog, nextState: ProgramState, goalCompletions: GoalCompletionDoc[]) => {
      const current = bundleRef.current;
      if (!uid || !current) throw new Error("No hay sesión activa.");

      // El id del log es el mismo que usará el repositorio (idempotente ante reintentos).
      const sessionLog: SessionLog = { ...log, id: sessionDocId(log) };
      // Las metas ya completadas no se vuelven a enviar (en Firestore solo se pueden CREAR).
      const known = new Set(current.completedGoalIds);
      const newGoals = goalCompletions.filter((g) => !known.has(g.id));

      discardQueuedDraft();
      apply((b) => ({
        ...b,
        state: nextState,
        lastSession: sessionLog,
        draft: null,
        completedGoalIds: [...b.completedGoalIds, ...newGoals.map((g) => g.id)],
      }));
      await persist(repo.completeSession(uid, sessionLog, nextState, newGoals));
    },
    [uid, apply, discardQueuedDraft, persist, repo],
  );

  const listSessions = useCallback(
    async (max?: number) => (uid ? repo.listSessions(uid, max) : []),
    [uid, repo],
  );
  const listPersonalRecords = useCallback(async () => (uid ? repo.listPersonalRecords(uid) : []), [uid, repo]);

  const value = useMemo<ProgramContextValue>(
    () => ({
      status,
      error,
      user: bundle?.user ?? authUser,
      isNewUser: bundle?.isNewUser ?? false,
      settings: bundle?.settings ?? null,
      state: bundle?.state ?? null,
      lastSession: bundle?.lastSession ?? null,
      draft: bundle?.draft ?? null,
      completedGoalIds: bundle?.completedGoalIds ?? [],
      pending,
      syncError,
      refresh,
      saveSettings,
      saveDraft,
      clearDraft,
      completeSession,
      listSessions,
      listPersonalRecords,
    }),
    [
      status,
      error,
      bundle,
      authUser,
      pending,
      syncError,
      refresh,
      saveSettings,
      saveDraft,
      clearDraft,
      completeSession,
      listSessions,
      listPersonalRecords,
    ],
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

/** Acceso al estado del usuario y a sus acciones. Debe usarse dentro de <ProgramProvider>. */
export function useProgram(): ProgramContextValue {
  const ctx = useContext(ProgramContext);
  if (!ctx) throw new Error("useProgram debe usarse dentro de <ProgramProvider>.");
  return ctx;
}
