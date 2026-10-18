"use client";

/**
 * Contexto de autenticación de kettellbro.
 *
 * Estados (`status`):
 *  - 'loading'       : resolviendo si hay sesión (restaurar sesión / volver de la redirección de Google).
 *  - 'signedOut'     : sin sesión => la UI muestra "Continuar con Google".
 *  - 'signedIn'      : hay `user`.
 *  - 'misconfigured' : no es modo demo y faltan las variables NEXT_PUBLIC_FIREBASE_*.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *  ⚠️  DEMO_MODE (NEXT_PUBLIC_DEMO_MODE=1) JAMÁS DEBE USARSE EN PRODUCCIÓN  ⚠️
 *  En modo demo NO se usa Firebase ni Google: cualquiera "inicia sesión" con un usuario
 *  ficticio y los datos viven solo en el localStorage de este navegador. Es únicamente para
 *  desarrollar y previsualizar la UI sin proyecto de Firebase. En producción la variable
 *  debe estar VACÍA (el acceso real es SOLO con Google). El contexto expone `isDemo` para
 *  que la UI muestre un aviso visible, y en builds de producción se registra una advertencia.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_MODE, isFirebaseConfigured } from "@/lib/config";
import type { AppUser } from "@/lib/engine/types";
import {
  authErrorMessage,
  completeRedirectSignIn,
  signInWithGoogle as googleSignIn,
  signOutGoogle,
  watchAuth,
} from "@/lib/firebase/auth";

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "misconfigured";

export interface AuthContextValue {
  status: AuthStatus;
  user: AppUser | null;
  /** Mensaje en español listo para mostrar; `null` si no hay error (cancelar NO es error). */
  error: string | null;
  /** Abre Google (popup con fallback a redirección). Nunca lanza: los fallos quedan en `error`. */
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  /** true mientras hay un inicio de sesión en curso (para deshabilitar el botón / mostrar spinner). */
  busy: boolean;
  /** true si la app corre en DEMO_MODE (la UI debe mostrar un aviso "MODO DEMO"). */
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ───────────────────────── Modo demo (solo desarrollo) ─────────────────────────

/**
 * Pista de que este navegador ya tuvo sesión. La portada pública la lee antes del primer pintado para no mostrar un
 * destello de portada a quien ya entró. No es una credencial: solo un "1".
 */
const AUTH_HINT_KEY = "kb:auth-hint";

function setAuthHint(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(AUTH_HINT_KEY, "1");
    else window.localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    /* localStorage bloqueado: sin pista, solo se ve la portada un instante */
  }
}

/** Clave de localStorage donde persiste la "sesión" ficticia del modo demo. */
const DEMO_USER_KEY = "kb:v1:demo:user";

/** Usuario ficticio del modo demo. Su uid determina las claves `kb:v1:demo-user:*` del LocalRepository. */
export const DEMO_USER: AppUser = {
  uid: "demo-user",
  displayName: "Bro Demo",
  email: null,
  photoURL: null,
};

function readDemoUser(): AppUser | null {
  try {
    return window.localStorage.getItem(DEMO_USER_KEY) ? DEMO_USER : null;
  } catch {
    return null; // localStorage bloqueado: sin sesión persistida
  }
}

function writeDemoUser(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(DEMO_USER_KEY, JSON.stringify(DEMO_USER));
    else window.localStorage.removeItem(DEMO_USER_KEY);
  } catch {
    /* localStorage bloqueado: la sesión demo vive solo en memoria */
  }
}

// ───────────────────────── Proveedor ─────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  // "misconfigured" se conoce ya en el primer render (las variables NEXT_PUBLIC_* se inyectan en
  // el build), así servidor y cliente coinciden y no hay desajuste de hidratación.
  const [status, setStatus] = useState<AuthStatus>(
    !DEMO_MODE && !isFirebaseConfigured ? "misconfigured" : "loading",
  );
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // ── Modo demo: sin Firebase. Restaura la sesión ficticia desde localStorage. ──
    if (DEMO_MODE) {
      if (process.env.NODE_ENV === "production") {
        console.warn("[kettellbro] DEMO_MODE está ACTIVO en un build de producción. Desactívalo: el acceso real es solo con Google.");
      }
      const demoUser = readDemoUser();
      setUser(demoUser);
      setStatus(demoUser ? "signedIn" : "signedOut");
      return;
    }

    // ── Sin configuración: el estado 'misconfigured' ya está puesto. ──
    if (!isFirebaseConfigured) return;

    // ── Firebase real ──
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      // onAuthStateChanged entrega la sesión restaurada (o null) y, si volvemos de una
      // redirección de Google, el usuario ya autenticado.
      unsubscribe = watchAuth(
        (next) => {
          if (!active) return;
          setUser(next);
          setStatus(next ? "signedIn" : "signedOut");
          setAuthHint(Boolean(next));
          if (next) setError(null);
        },
        (e) => {
          if (!active) return;
          setError(authErrorMessage(e));
          setStatus("signedOut");
        },
      );
    } catch {
      setStatus("misconfigured");
      return;
    }

    // Procesa el resultado de signInWithRedirect (fallback móvil). Solo nos interesa el error:
    // el usuario ya llega por onAuthStateChanged.
    completeRedirectSignIn().catch((e: unknown) => {
      const message = authErrorMessage(e);
      if (active && message) setError(message);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setError(null);

    if (DEMO_MODE) {
      writeDemoUser(true);
      setUser(DEMO_USER);
      setStatus("signedIn");
      return;
    }
    if (!isFirebaseConfigured) {
      setStatus("misconfigured");
      return;
    }

    setBusy(true);
    try {
      await googleSignIn(); // el estado se actualiza solo vía onAuthStateChanged
    } catch (e) {
      const message = authErrorMessage(e); // null => el usuario canceló: silencio
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (DEMO_MODE) {
      writeDemoUser(false);
      setUser(null);
      setStatus("signedOut");
      return;
    }
    try {
      await signOutGoogle(); // onAuthStateChanged pasará a 'signedOut'
    } catch (e) {
      const message = authErrorMessage(e);
      if (message) setError(message);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, signInWithGoogle, signOut, busy, isDemo: DEMO_MODE }),
    [status, user, error, signInWithGoogle, signOut, busy],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Acceso al contexto de autenticación. Debe usarse dentro de <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}
