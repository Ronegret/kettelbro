"use client";

/**
 * `useResume()`: carga inicial del usuario ("Bienvenido de vuelta, hoy toca el Día N").
 *
 * Cuando hay sesión (`useAuth().status === 'signedIn'`) llama a `repo.resume(user)` UNA sola vez
 * por uid (aguanta el doble efecto de React StrictMode) y expone el `ResumeBundle`.
 *
 * ⚠️ Úsalo UNA vez en toda la app: ya lo hace <ProgramProvider>. Los componentes deben leer el
 * estado con `useProgram()`; llamar a `useResume()` en otro sitio dispararía una segunda carga.
 *
 * Mientras no hay sesión, `status` se queda en 'loading' y `bundle` en null: la UI decide primero
 * con `useAuth()`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeSettings } from "@/lib/engine/defaults";
import { useAuth } from "@/components/auth/AuthProvider";
import type { AppUser, ResumeBundle } from "@/lib/engine/types";
import { getRepository } from "./index";
import { describeDataError } from "./shared";

export type ResumeStatus = "loading" | "ready" | "error";

export interface UseResumeResult {
  status: ResumeStatus;
  bundle: ResumeBundle | null;
  /** Mensaje en español del último fallo de carga (con `bundle` presente = fallo al refrescar). */
  error: string | null;
  /** Vuelve a pedir `resume()` al repositorio y reemplaza el bundle (sin parpadeo de 'loading'). */
  refresh(): Promise<void>;
  /** Actualiza el bundle en memoria (lo usan las acciones optimistas de ProgramProvider). */
  setBundle(updater: (prev: ResumeBundle) => ResumeBundle): void;
}

interface Snapshot {
  /** Usuario al que pertenece este snapshot (evita enseñar datos del usuario anterior). */
  uid: string | null;
  status: ResumeStatus;
  bundle: ResumeBundle | null;
  error: string | null;
}

const EMPTY: Snapshot = { uid: null, status: "loading", bundle: null, error: null };

export function useResume(): UseResumeResult {
  const { status: authStatus, user } = useAuth();
  const uid = authStatus === "signedIn" && user ? user.uid : null;

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  /** uid para el que ya se lanzó resume() (garantiza "una vez por uid"). */
  const loadedUid = useRef<string | null>(null);
  const userRef = useRef<AppUser | null>(null);

  const load = useCallback(async (target: AppUser, keepBundle: boolean) => {
    try {
      const raw = await getRepository().resume(target);
      // Ajustes de versiones anteriores (35/45 min) se normalizan al cargar para que los guardados posteriores sean válidos.
      const bundle = raw.settings ? { ...raw, settings: normalizeSettings(raw.settings) } : raw;
      if (loadedUid.current !== target.uid) return; // llegó tarde: ya cambió el usuario
      setSnapshot({ uid: target.uid, status: "ready", bundle, error: null });
    } catch (e) {
      if (loadedUid.current !== target.uid) return;
      const message = describeDataError(e);
      setSnapshot((prev) =>
        keepBundle && prev.bundle
          ? { ...prev, error: message } // fallo al refrescar: conservamos lo que ya se ve
          : { uid: target.uid, status: "error", bundle: null, error: message },
      );
    }
  }, []);

  useEffect(() => {
    if (!uid || !user) {
      // Sin sesión (o cerrando): olvidar todo para no filtrar datos al siguiente usuario.
      loadedUid.current = null;
      userRef.current = null;
      setSnapshot((prev) => (prev === EMPTY ? prev : EMPTY));
      return;
    }
    userRef.current = user;
    if (loadedUid.current === uid) return; // ya cargado (o cargando) para este uid
    loadedUid.current = uid;
    setSnapshot({ uid, status: "loading", bundle: null, error: null });
    void load(user, false);
    // Solo depende del uid: `user` cambia de identidad sin cambiar de persona.
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    const current = userRef.current;
    if (current) await load(current, true);
  }, [load]);

  const setBundle = useCallback((updater: (prev: ResumeBundle) => ResumeBundle) => {
    setSnapshot((prev) => (prev.bundle ? { ...prev, bundle: updater(prev.bundle) } : prev));
  }, []);

  // Durante la transición entre usuarios, no exponer el snapshot del anterior.
  const visible = uid !== null && snapshot.uid === uid ? snapshot : EMPTY;

  return {
    status: visible.status,
    bundle: visible.bundle,
    error: visible.error,
    refresh,
    setBundle,
  };
}
