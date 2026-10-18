import type {
  ActiveSessionDraft,
  AppUser,
  ExerciseId,
  GoalCompletionDoc,
  ProgramState,
  ResumeBundle,
  SessionLog,
  UserSettings,
} from "@/lib/engine/types";

/**
 * Contrato de persistencia. Hay DOS implementaciones intercambiables:
 *  - FirestoreRepository  (producción: Google + Firestore con caché offline)
 *  - LocalRepository      (solo NEXT_PUBLIC_DEMO_MODE=1: localStorage, para previsualizar sin Firebase)
 * La UI solo conoce esta interfaz.
 */
export interface Repository {
  /**
   * "Recuperar última sesión": carga en paralelo perfil, ajustes, estado del programa,
   * última sesión completada, borrador de sesión activa y metas completadas.
   * Si el usuario es nuevo, crea su perfil y un ProgramState inicial (Día 1).
   */
  resume(user: AppUser): Promise<ResumeBundle>;

  saveSettings(uid: string, settings: UserSettings): Promise<void>;

  /**
   * Cierra una sesión de forma ATÓMICA: guarda el SessionLog, actualiza ProgramState (día, racha,
   * memoria de ejercicios, totales), registra récords y borra el borrador. Todo o nada.
   */
  completeSession(uid: string, log: SessionLog, nextState: ProgramState, goalCompletions: GoalCompletionDoc[]): Promise<void>;

  /** Guarda/actualiza el borrador de la sesión activa (tras cada paso). */
  saveDraft(uid: string, draft: ActiveSessionDraft): Promise<void>;
  clearDraft(uid: string): Promise<void>;

  /** Historial reciente (más nuevo primero). */
  listSessions(uid: string, max?: number): Promise<SessionLog[]>;

  /** Récords personales por ejercicio: { bellKg, reps, dayIndex, date }. */
  listPersonalRecords(uid: string): Promise<PersonalRecord[]>;
}

export interface PersonalRecord {
  exerciseId: ExerciseId;
  bellKg: number;
  reps: number;
  dayIndex: number;
  date: string;
}
