/**
 * Tipos y claves compartidos de los personajes 3D. SIN imports de three: este módulo entra en el JS
 * inicial de quien lo use (la 2D también podrá importarlo para unificar personaje y vista).
 */

export type CharacterId = "bro" | "princess";
export const CHARACTERS: readonly CharacterId[] = ["bro", "princess"];

/**
 * Vistas con nombre. `angle` es alias de `three-quarter`. Un número = grados de yaw con la MISMA convención que `viewYaw`
 * de la 2D (poses.ts): 0 = de perfil (mira a la derecha de la pantalla), 90 = de frente, 45 = tres cuartos,
 * 180 = perfil contrario, -90 = de espaldas. `auto` alterna las vistas útiles del ejercicio (FIGURE_VIEWS de poses.ts).
 */
export type FigureView = "side" | "front" | "three-quarter" | "auto";
export type FigureViewInput = FigureView | "angle" | number;
/** Opciones para un selector de vista (no confundir con FIGURE_VIEWS de poses.ts, que es la tabla por ejercicio). */
export const FIGURE_VIEW_OPTIONS: readonly FigureView[] = ["side", "front", "three-quarter", "auto"];

/** Lado de trabajo (mismo vocabulario que el motor). `left` refleja el personaje (scale.x = -1). */
export type FigureSide = "left" | "right" | "both";

/** localStorage: personaje elegido y vista elegida por ejercicio (se unifican con la 2D). */
export const CHARACTER_KEY = "kb:character";
export const figViewKey = (exerciseId: string): string => `kb:fig-view:${exerciseId}`;

/** Sube este valor al reexportar los GLB: el service worker los sirve con prioridad a la caché y esta versión va en la URL. */
export const MODELS_VERSION = "10";
export const modelUrl = (c: CharacterId): string => `/models/${c}.glb?v=${MODELS_VERSION}`;

export const isCharacterId = (v: unknown): v is CharacterId => v === "bro" || v === "princess";

/** Interpreta un valor guardado o escrito a mano: nombre de vista, alias o grados. */
export function parseView(v: unknown): FigureViewInput | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  if (v === "side" || v === "front" || v === "three-quarter" || v === "auto" || v === "angle") return v;
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

function store(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // acceder a localStorage puede lanzar SecurityError
  }
}

export function readCharacter(): CharacterId {
  const v = store()?.getItem(CHARACTER_KEY);
  return isCharacterId(v) ? v : "bro";
}
export function readFigView(exerciseId: string): FigureViewInput | null {
  return parseView(store()?.getItem(figViewKey(exerciseId)));
}
export function saveCharacter(c: CharacterId): void {
  try {
    store()?.setItem(CHARACTER_KEY, c);
  } catch {
    /* lleno o bloqueado: la elección vive solo en memoria */
  }
}
export function saveFigView(exerciseId: string, v: FigureViewInput): void {
  try {
    store()?.setItem(figViewKey(exerciseId), String(v));
  } catch {
    /* igual */
  }
}

/** Estado que <Figure3D /> comunica a quien lo use (la página dev lo muestra; el player puede ignorarlo). */
export interface Figure3DStatus {
  /** loading = descargando visor/GLB · ready = dibujando en 3D · lost = contexto WebGL perdido (se ve la 2D, puede volver) · failed = se ve la 2D de forma definitiva */
  state: "loading" | "ready" | "lost" | "failed";
  /** Clip que suena (el del ejercicio, o `idle` si el GLB aún no lo tiene). */
  clip?: string;
  usedIdle?: boolean;
  error?: string;
}
