/**
 * Punto de entrada de la capa de datos. La UI NO importa Firestore ni localStorage directamente:
 * pide el repositorio aquí (o, mejor, usa `useProgram()` de components/ProgramProvider).
 */
import { DEMO_MODE } from "@/lib/config";
import { FirestoreRepository } from "./firestoreRepository";
import { LocalRepository } from "./localRepository";
import type { Repository } from "./repository";

let instance: Repository | null = null;

/**
 * Repositorio activo (singleton):
 *  - DEMO_MODE  => LocalRepository (localStorage; SOLO desarrollo/preview, nunca producción).
 *  - Si no      => FirestoreRepository (Google + Firestore con caché offline).
 */
export function getRepository(): Repository {
  instance ??= DEMO_MODE ? new LocalRepository() : new FirestoreRepository();
  return instance;
}

export type { PersonalRecord, Repository } from "./repository";
