/** Nombre del producto. Constante única: cámbiala aquí y se refleja en toda la app. */
export const APP_NAME = "kettellbro";
export const APP_NAME_DISPLAY = "KETTELLBRO";

/** Versión del esquema de documentos en Firestore (para migraciones futuras). */
export const SCHEMA_VERSION = 1;

/** Versión del algoritmo de rutinas; se guarda en cada plan. */
export const ENGINE_VERSION = 2;

/**
 * Modo demo: SOLO desarrollo/preview. Salta Google y persiste en localStorage.
 * En producción debe estar vacío para que el acceso sea únicamente con Google.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
