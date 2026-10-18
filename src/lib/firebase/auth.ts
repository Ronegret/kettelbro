/**
 * Autenticación con Google (ÚNICO método de acceso: sin email/contraseña, sin anónimo).
 *
 * Este módulo es una capa fina sobre `firebase/auth`; el estado de React vive en
 * `components/auth/AuthProvider.tsx`. Aquí solo hay funciones.
 */
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import type { AppUser } from "@/lib/engine/types";
import { getFirebaseAuth } from "./client";

/** Convierte el `User` de Firebase al `AppUser` mínimo que usa la app. */
export function toAppUser(user: User): AppUser {
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || user.email?.split("@")[0] || "Bro",
    email: user.email,
    photoURL: user.photoURL,
  };
}

function requireAuth() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase Auth no está disponible (¿faltan las variables NEXT_PUBLIC_FIREBASE_*?).");
  return auth;
}

// ───────────────────────── Errores ─────────────────────────

/** Extrae `error.code` (p. ej. "auth/popup-blocked") de cualquier valor lanzado. */
export function authErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

/** Códigos que significan "el usuario se arrepintió": NO son un error, no se muestra nada. */
const CANCELLED_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
  "auth/redirect-cancelled-by-user",
  "auth/redirect-operation-pending",
]);

/**
 * Mensaje en español para el usuario, o `null` si fue una cancelación voluntaria
 * (cerrar la ventana de Google no debe mostrar un error).
 */
export function authErrorMessage(error: unknown): string | null {
  const code = authErrorCode(error);
  if (code && CANCELLED_CODES.has(code)) return null;

  switch (code) {
    case "auth/popup-blocked":
      return "Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.";
    case "auth/operation-not-supported-in-this-environment":
      return "Este navegador no permite abrir la ventana de Google. Prueba abrir la app en Safari o Chrome.";
    case "auth/network-request-failed":
      return "No hay conexión. Revisa tu internet e inténtalo otra vez.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado para iniciar sesión. Falta añadirlo en Firebase > Authentication > Configuración > Dominios autorizados.";
    case "auth/operation-not-allowed":
      return "El acceso con Google no está habilitado en el proyecto de Firebase.";
    case "auth/user-disabled":
      return "Esta cuenta de Google está deshabilitada en kettellbro.";
    case "auth/too-many-requests":
      return "Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.";
    case "auth/web-storage-unsupported":
      return "Tu navegador bloquea el almacenamiento local. Activa las cookies/almacenamiento o sal del modo privado.";
    case "auth/account-exists-with-different-credential":
      return "Ya existe una cuenta con ese correo usando otro método de acceso.";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "La configuración de Firebase no es válida (API key). Avisa al administrador.";
    case "auth/internal-error":
    case "auth/timeout":
      return "Google tardó demasiado en responder. Inténtalo de nuevo.";
    default:
      return "No pudimos iniciar sesión con Google. Inténtalo de nuevo.";
  }
}

// ───────────────────────── Inicio de sesión ─────────────────────────

/** Proveedor de Google que SIEMPRE muestra el selector de cuenta (útil en dispositivos compartidos). */
function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

/** Errores de popup que en móvil se resuelven pasando a redirección de página completa. */
function shouldFallbackToRedirect(code: string | null): boolean {
  return code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment";
}

/**
 * "Continuar con Google".
 *
 *  1. Intenta `signInWithPopup` (rápido en escritorio, mantiene el estado de la app).
 *  2. Si el navegador (típico en móvil / PWA instalada) bloquea o no soporta el popup,
 *     cae a `signInWithRedirect`: la página navega a Google y vuelve a la app. Al volver,
 *     `completeRedirectSignIn()` recoge el resultado/errores y `onAuthStateChanged` entrega el usuario.
 *  3. Si el usuario cierra el popup, se lanza el error original y `authErrorMessage` lo
 *     reconoce como cancelación (sin mensaje). NO se redirige: sería molesto.
 *
 * IMPORTANTE: no hay `await` antes de `signInWithPopup` para conservar el gesto del usuario.
 */
export async function signInWithGoogle(): Promise<void> {
  const auth = requireAuth();
  const provider = createGoogleProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (shouldFallbackToRedirect(authErrorCode(error))) {
      // La promesa de signInWithRedirect nunca se resuelve "normalmente": la página se descarga.
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

/**
 * Debe llamarse al montar la app. Si volvemos de una redirección de Google, procesa el
 * resultado (o lanza su error). Si no hubo redirección, no hace nada.
 * El usuario en sí llega por `watchAuth` (onAuthStateChanged).
 */
export async function completeRedirectSignIn(): Promise<void> {
  const auth = requireAuth();
  await getRedirectResult(auth);
}

/**
 * Suscripción al estado de sesión. Se invoca una vez al inicio (sesión restaurada o `null`)
 * y después en cada login/logout. Devuelve la función para cancelar la suscripción.
 */
export function watchAuth(onUser: (user: AppUser | null) => void, onError: (error: unknown) => void): () => void {
  const auth = requireAuth();
  return onAuthStateChanged(auth, (user) => onUser(user ? toAppUser(user) : null), onError);
}

/** Cierra la sesión de Firebase en este dispositivo. */
export async function signOutGoogle(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await firebaseSignOut(auth);
}
