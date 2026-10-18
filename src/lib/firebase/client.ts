/**
 * Inicialización PEREZOSA y SINGLETON de Firebase (App, Auth y Firestore).
 *
 * Reglas de oro de este módulo:
 *  - Nada se inicializa al importar el archivo: solo cuando alguien llama a un getter.
 *    Así `next build` (que ejecuta el código en Node para pre-renderizar) no revienta.
 *  - Si Firebase no está configurado (faltan las variables NEXT_PUBLIC_FIREBASE_*), los
 *    getters devuelven `null` en lugar de lanzar. Quien los use decide qué hacer
 *    (AuthProvider => status 'misconfigured').
 *  - Auth y la caché persistente de Firestore SOLO existen en el navegador.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/config";

const isBrowser = typeof window !== "undefined";

// Singletons del módulo. Con HMR (recarga en caliente) el módulo se reevalúa pero la app de
// Firebase sigue viva en `getApps()`, por eso cada getter tolera "ya inicializado".
let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

/** App de Firebase, o `null` si el proyecto no está configurado. */
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (!appInstance) {
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return appInstance;
}

/**
 * Auth del navegador, o `null` (servidor / sin configurar).
 *
 * Usamos `initializeAuth` (en vez de `getAuth`) para fijar la persistencia y el resolver de
 * popup/redirect SIN `await` previo: un `await setPersistence()` antes de `signInWithPopup`
 * hace que Safari/iOS bloquee la ventana (pierde el gesto del usuario).
 *
 * Persistencia: sesión local que sobrevive a cerrar el navegador (`browserLocalPersistence`).
 * Ponemos IndexedDB primero porque es más resistente a que Safari purgue localStorage; si no
 * está disponible, cae a `browserLocalPersistence` (localStorage).
 */
export function getFirebaseAuth(): Auth | null {
  if (!isBrowser) return null;
  const app = getFirebaseApp();
  if (!app) return null;
  if (!authInstance) {
    try {
      authInstance = initializeAuth(app, {
        persistence: [indexedDBLocalPersistence, browserLocalPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      // Ya estaba inicializado (HMR u otro módulo): reutilizamos la instancia existente.
      authInstance = getAuth(app);
    }
  }
  return authInstance;
}

/**
 * Firestore, o `null` si Firebase no está configurado.
 *
 * En el navegador activa la caché OFFLINE PERSISTENTE (IndexedDB) y multi-pestaña: la app
 * abre y funciona sin red en el gimnasio, y las escrituras quedan en cola hasta reconectar.
 * Si IndexedDB no está disponible (modo privado antiguo, etc.) el SDK cae solo a caché en
 * memoria: la app sigue funcionando, solo sin persistencia entre sesiones.
 *
 * `ignoreUndefinedProperties` es un cinturón extra: además usamos `stripUndefined` al escribir.
 */
export function getDb(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!dbInstance) {
    if (isBrowser) {
      try {
        dbInstance = initializeFirestore(app, {
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          ignoreUndefinedProperties: true,
        });
      } catch {
        // Firestore ya se inicializó con otra configuración (HMR): reutilizar.
        dbInstance = getFirestore(app);
      }
    } else {
      // Servidor / build: instancia simple, sin caché persistente (no hay IndexedDB en Node).
      dbInstance = getFirestore(app);
    }
  }
  return dbInstance;
}

/** Como `getDb()`, pero lanza un error claro si Firebase no está configurado. */
export function requireDb(): Firestore {
  const db = getDb();
  if (!db) {
    throw new Error(
      "Firebase no está configurado: define las variables NEXT_PUBLIC_FIREBASE_* (ver .env.example).",
    );
  }
  return db;
}
