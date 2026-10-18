// Pruebas de las reglas de seguridad (firestore.rules) contra el emulador de Firestore.
// Incluye la forma REAL de los batch de la app (usuario nuevo y completeSession).
//
// Requisitos (a propósito NO están en package.json): Java 11+ y
//   npm i -D @firebase/rules-unit-testing firebase-tools
// Ejecutar:
//   npx firebase emulators:exec --only firestore --project demo-kb "node scripts/test-firestore-rules.mjs"
// Los avisos "PERMISSION_DENIED" que imprime el SDK son esperados: son las pruebas de denegación.
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, writeBatch, query, orderBy, limit } from "firebase/firestore";

const RULES = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
// El host/puerto los toma de FIRESTORE_EMULATOR_HOST (lo define `firebase emulators:exec`).
const env = await initializeTestEnvironment({ projectId: "demo-kb", firestore: { rules: RULES } });

let pass = 0;
let fail = 0;
async function check(name, expectOk, fn) {
  try {
    if (expectOk) await assertSucceeds(fn());
    else await assertFails(fn());
    pass++;
    console.log("ok   ", name);
  } catch (e) {
    fail++;
    console.log("FAIL ", name, "->", String(e.message).split("\n")[0]);
  }
}

const T0 = 1760000000000;
const profile = { displayName: "Bro", email: "a@b.c", photoURL: null, createdAt: T0, lastLoginAt: T0, schemaVersion: 1 };
const program = (over = {}) => ({
  schemaVersion: 1, dayIndex: 1, startedAt: T0, lastSessionDate: null, streak: 0, bestStreak: 0, shields: 0, xp: 0,
  totals: { sessions: 0, restDays: 0, reps: 0, tonnageKg: 0, minutes: 0 }, memory: {}, lastRpe: null, lastFeel: null, ...over,
});
const settings = (over = {}) => ({
  level: "novice", primaryGoal: "balanced", minutes: 25, bells: [8, 12, 16], referenceKg: 12,
  voice: true, sound: true, haptics: true, onboardedAt: null, ...over,
});
const session = (dayIndex = 1, over = {}) => ({
  id: `s${dayIndex}-${T0}`, dayIndex, date: "2026-10-15", focus: "power", title: "EL SWING", phase: "accumulate", mesocycle: 1,
  startedAt: T0, endedAt: T0 + 1500000, durationSec: 1500, rpe: 7, feel: 2,
  sets: [{ exerciseId: "two-hand-swing", blockId: "b1", setIndex: 0, side: "both", reps: 10, bellKg: 16 }],
  totalReps: 10, tonnageKg: 160, xpEarned: 100, ...over,
});
const record = { exerciseId: "two-hand-swing", bellKg: 16, reps: 10, dayIndex: 1, date: "2026-10-15" };
const draft = { plan: { id: "d1", blocks: [] }, startedAt: T0, stepIndex: 3, sets: [], updatedAt: T0 };

const alice = env.authenticatedContext("alice").firestore();
const bob = env.authenticatedContext("bob").firestore();
const anon = env.unauthenticatedContext().firestore();
const U = (db, ...p) => doc(db, "users", "alice", ...p);

// ── Perfil / usuario nuevo ──
await check("alice crea su perfil + program (batch usuario nuevo)", true, async () => {
  const b = writeBatch(alice);
  b.set(doc(alice, "users/alice"), profile);
  b.set(doc(alice, "users/alice/meta/program"), program());
  return b.commit();
});
await check("bob NO puede crear en users/alice", false, () => setDoc(doc(bob, "users/alice/meta/program"), program()));
await check("anónimo NO puede leer users/alice", false, () => getDoc(doc(anon, "users/alice")));
await check("bob NO puede leer users/alice", false, () => getDoc(doc(bob, "users/alice")));
await check("alice lee su perfil", true, () => getDoc(U(alice)));
await check("alice lee settings/draft inexistentes (get de doc vacío)", true, () => getDoc(U(alice, "meta", "draft")));
await check("alice actualiza lastLoginAt + displayName", true, () => updateDoc(U(alice), { lastLoginAt: T0 + 1, displayName: "Nuevo", email: null, photoURL: "https://x/y.png" }));
await check("alice NO puede cambiar createdAt", false, () => updateDoc(U(alice), { createdAt: 5 }));
await check("alice NO puede borrar su perfil", false, () => deleteDoc(U(alice)));
const { email: _e, ...profileNoEmail } = profile;
await check("perfil sin campo email NO válido", false, () => setDoc(doc(alice, "users/alice2"), profileNoEmail));

// ── Settings ──
await check("settings válidos", true, () => setDoc(U(alice, "meta", "settings"), settings()));
await check("settings con onboardedAt int", true, () => setDoc(U(alice, "meta", "settings"), settings({ onboardedAt: T0 })));
await check("settings minutes=20 aceptado", true, () => setDoc(U(alice, "meta", "settings"), settings({ minutes: 20 })));
await check("settings minutes=35 rechazado (máximo 25)", false, () => setDoc(U(alice, "meta", "settings"), settings({ minutes: 35 })));
await check("settings con cuerpo válido aceptado", true, () => setDoc(U(alice, "meta", "settings"), settings({ body: { heightCm: 175, weights: [{ date: "2026-01-01", kg: 75 }] } })));
await check("settings con estatura imposible rechazado", false, () => setDoc(U(alice, "meta", "settings"), settings({ body: { heightCm: 20, weights: [] } })));
await check("settings level inválido", false, () => setDoc(U(alice, "meta", "settings"), settings({ level: "pro" })));
await check("settings bells con 1 kg", false, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [1, 12] })));
await check("settings bells con 65 kg al final", false, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [8, 12, 65] })));
await check("settings bells vacío", false, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [] })));
await check("settings bells de 13", false, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [2,4,6,8,10,12,14,16,18,20,22,24,26] })));
await check("settings bells con 12 válidos", true, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [2,4,6,8,10,12,14,16,18,20,22,24] })));
await check("settings bells con string", false, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [8, "12"] })));
await check("settings bells decimal 7.5", true, () => setDoc(U(alice, "meta", "settings"), settings({ bells: [7.5, 12] })));
await check("settings voice no booleano", false, () => setDoc(U(alice, "meta", "settings"), settings({ voice: "si" })));
await check("settings con campo extra permitido", true, () => setDoc(U(alice, "meta", "settings"), settings({ theme: "dark" })));
await check("bob no escribe settings de alice", false, () => setDoc(U(bob, "meta", "settings"), settings()));

// ── Program ──
await check("program dayIndex=0 rechazado", false, () => setDoc(U(alice, "meta", "program"), program({ dayIndex: 0 })));
await check("program streak=-1 rechazado", false, () => setDoc(U(alice, "meta", "program"), program({ streak: -1 })));
await check("program dayIndex decimal rechazado", false, () => setDoc(U(alice, "meta", "program"), program({ dayIndex: 1.5 })));
await check("program día 45 con memoria, lastRpe y lastFeel", true, () => setDoc(U(alice, "meta", "program"), program({ dayIndex: 45, streak: 6, bestStreak: 9, xp: 4200.5, lastRpe: 7.5, lastFeel: 2, lastSessionDate: "2026-10-14", memory: { "two-hand-swing": { bellKg: 16, stage: 1, lastReps: 10, lastRpe: 7, lastDayIndex: 44, bestBellKg: 16, bestReps: 12 } } })));
await check("program fecha mal formada", false, () => setDoc(U(alice, "meta", "program"), program({ lastSessionDate: "14/10/2026" })));

// ── Draft ──
await check("draft válido", true, () => setDoc(U(alice, "meta", "draft"), draft));
await check("draft inválido (stepIndex negativo)", false, () => setDoc(U(alice, "meta", "draft"), { ...draft, stepIndex: -1 }));
await check("alice borra draft", true, () => deleteDoc(U(alice, "meta", "draft")));
await check("alice borra draft inexistente", true, () => deleteDoc(U(alice, "meta", "draft")));

// ── Sesiones / completeSession atómico ──
await check("completeSession (batch real)", true, async () => {
  await setDoc(U(alice, "meta", "draft"), draft);
  const b = writeBatch(alice);
  b.set(U(alice, "sessions", `s1-${T0}`), session(1));
  b.set(U(alice, "meta", "program"), program({ dayIndex: 2, streak: 1, bestStreak: 1, xp: 100, lastSessionDate: "2026-10-15" }));
  b.set(U(alice, "records", "two-hand-swing"), record);
  b.set(U(alice, "goals", "first-session"), { id: "first-session", completedAt: T0 });
  b.delete(U(alice, "meta", "draft"));
  return b.commit();
});
await check("sesión no se puede actualizar", false, () => setDoc(U(alice, "sessions", `s1-${T0}`), session(1, { rpe: 9 })));
await check("sesión no se puede borrar", false, () => deleteDoc(U(alice, "sessions", `s1-${T0}`)));
await check("sesión con id distinto al del doc", false, () => setDoc(U(alice, "sessions", "s9-9"), session(1)));
await check("sesión con endedAt < startedAt", false, () => setDoc(U(alice, "sessions", `s3-${T0}`), session(3, { endedAt: T0 - 1 })));
await check("sesión con rpe 11", false, () => setDoc(U(alice, "sessions", `s4-${T0}`), session(4, { rpe: 11 })));
await check("sesión con feel 4", false, () => setDoc(U(alice, "sessions", `s5-${T0}`), session(5, { feel: 4 })));
await check("sesión restDay booleano", true, () => setDoc(U(alice, "sessions", `s6-${T0}`), session(6, { restDay: true })));
await check("sesión restDay no booleano", false, () => setDoc(U(alice, "sessions", `s7-${T0}`), session(7, { restDay: "x" })));
await check("batch con program inválido falla ENTERO (nada se escribe)", false, async () => {
  const b = writeBatch(alice);
  b.set(U(alice, "sessions", `s8-${T0}`), session(8));
  b.set(U(alice, "meta", "program"), program({ dayIndex: 0 }));
  return b.commit();
});
await check("la sesión del batch fallido no existe", true, async () => {
  const s = await getDoc(U(alice, "sessions", `s8-${T0}`));
  if (s.exists()) throw new Error("existe");
});
await check("lista de sesiones orderBy endedAt desc limit 1", true, () => getDocs(query(collection(alice, "users/alice/sessions"), orderBy("endedAt", "desc"), limit(1))));
await check("bob no lista sesiones de alice", false, () => getDocs(query(collection(bob, "users/alice/sessions"), orderBy("endedAt", "desc"), limit(1))));

// ── Records ──
await check("record se puede actualizar (mejora)", true, () => setDoc(U(alice, "records", "two-hand-swing"), { ...record, reps: 12 }));
await check("record id distinto al doc", false, () => setDoc(U(alice, "records", "goblet-squat"), record));
await check("record reps 0", false, () => setDoc(U(alice, "records", "two-hand-swing"), { ...record, reps: 0 }));
await check("record bellKg 12.5 decimal", true, () => setDoc(U(alice, "records", "two-hand-swing"), { ...record, bellKg: 12.5 }));

// ── Goals ──
await check("meta no se puede actualizar", false, () => setDoc(U(alice, "goals", "first-session"), { id: "first-session", completedAt: T0 + 5 }));
await check("meta no se puede borrar", false, () => deleteDoc(U(alice, "goals", "first-session")));
await check("meta con id distinto", false, () => setDoc(U(alice, "goals", "otra"), { id: "x", completedAt: T0 }));
await check("alice lista sus metas", true, () => getDocs(collection(alice, "users/alice/goals")));

// ── Denegar todo lo demás ──
await check("ruta desconocida denegada", false, () => setDoc(doc(alice, "cosas/x"), { a: 1 }));
await check("no se puede listar users", false, () => getDocs(collection(alice, "users")));
await check("subcolección desconocida denegada", false, () => setDoc(doc(alice, "users/alice/otra/x"), { a: 1 }));

console.log(`\n${pass} ok, ${fail} fallos`);
await env.cleanup();
process.exit(fail ? 1 : 0);
