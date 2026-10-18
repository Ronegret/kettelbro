/**
 * Motor compartido del 3D: UN WebGLRenderer por página, un solo bucle de requestAnimationFrame y la pérdida de contexto.
 *
 * Cada <Figure3D /> tiene su propio <canvas> 2D. El renderer único dibuja en un canvas fuera de pantalla (con viewport y
 * scissor del tamaño de cada vista) y el resultado se copia al canvas de la vista con drawImage. Así caben N figuras con un
 * solo contexto WebGL (los móviles limitan los contextos activos) y sin reasignar buffers al alternar tamaños.
 */

import { WebGLRenderer, type Camera, type Scene } from "three";
import { gate } from "./gate";

export type GlStatus = "ok" | "lost" | "dead";

/** Lo que el motor pide a cada vista en cada fotograma. Devuelve true si dibujó. */
export interface Tickable {
  tick(now: number): boolean;
}

const MAX_LOSSES = 3; // a la 4.ª pérdida de contexto se rinde: todas las figuras pasan a la 2D
const IDLE_DISPOSE_MS = 30_000;
const HIGH_HZ_GAP = 11.5; // ms entre fotogramas del navegador por debajo del cual la pantalla es de ≥ 90 Hz: se dibuja uno de cada dos (≈ 60 fps, batería)

let renderer: WebGLRenderer | null = null;
let canvas: HTMLCanvasElement | null = null;
let status: GlStatus = "ok";
let losses = 0;
let idleTimer = 0;
const subs = new Set<(s: GlStatus) => void>();
const views = new Set<Tickable>();

function setStatus(s: GlStatus): void {
  status = s;
  if (s === "dead") gate.dead = true;
  subs.forEach((fn) => fn(s));
}

export function onGlStatus(fn: (s: GlStatus) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

// ───────────── Calidad (pixel ratio) ─────────────

function isSlowDevice(): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return (navigator.hardwareConcurrency || 8) <= 4 || (mem !== undefined && mem <= 2);
}

let dpr = 1;
const dprCap = (): number => (isSlowDevice() ? 1.5 : 2);
export const getDpr = (): number => dpr;

// ───────────── Renderer ─────────────

function ensureRenderer(): WebGLRenderer | null {
  if (renderer) return renderer;
  if (status === "dead") return null;
  try {
    canvas = document.createElement("canvas");
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "default" });
    renderer.setPixelRatio(1); // el pixel ratio lo gestiona el motor (por vista, en píxeles de dispositivo)
    renderer.setClearColor(0x000000, 0);
    renderer.setScissorTest(true);
    dpr = Math.min(window.devicePixelRatio || 1, dprCap());
    return renderer;
  } catch {
    renderer = null;
    setStatus("dead");
    return null;
  }
}

function onLost(e: Event): void {
  e.preventDefault(); // sin esto el navegador nunca restaura el contexto
  if (++losses > MAX_LOSSES) setStatus("dead");
  else setStatus("lost");
}
function onRestored(): void {
  if (status === "lost") setStatus("ok");
}

function disposeRenderer(): void {
  if (!renderer || !canvas) return;
  canvas.removeEventListener("webglcontextlost", onLost);
  canvas.removeEventListener("webglcontextrestored", onRestored);
  renderer.dispose();
  renderer.forceContextLoss();
  renderer = null;
  canvas = null;
}

// ───────────── Dibujo ─────────────

const stats = { frames: 0, calls: 0, triangles: 0, geometries: 0, textures: 0 };

/** Dibuja `scene` y lo copia a `ctx` (tamaño en píxeles de dispositivo). */
export function draw(scene: Scene, camera: Camera, ctx: CanvasRenderingContext2D, pw: number, ph: number): void {
  const r = renderer;
  if (!r || !canvas || status !== "ok") return;
  if (canvas.width < pw || canvas.height < ph) r.setSize(Math.max(canvas.width, pw), Math.max(canvas.height, ph), false);
  r.setViewport(0, 0, pw, ph);
  r.setScissor(0, 0, pw, ph);
  r.clear();
  r.render(scene, camera);
  ctx.clearRect(0, 0, pw, ph);
  // el origen de WebGL es abajo a la izquierda: la región dibujada es la inferior del buffer
  ctx.drawImage(canvas, 0, canvas.height - ph, pw, ph, 0, 0, pw, ph);
  stats.frames++;
  stats.calls = r.info.render.calls;
  stats.triangles = r.info.render.triangles;
  stats.geometries = r.info.memory.geometries;
  stats.textures = r.info.memory.textures;
}

// ───────────── Bucle único ─────────────

let raf = 0;
let lastRender = 0;
let prevTs = 0;
let rafGap = 16.7;
let parity = 0;
let ema = 16.7;
let slow = 0;
let warm = 0;

function adapt(gap: number): void {
  if (warm > 0) {
    warm--; // el arranque (compilar shaders, subir texturas) no cuenta: no es el ritmo real del dispositivo
    return;
  }
  if (gap > 100) {
    slow = 0; // hubo reposo: no cuenta
    return;
  }
  ema += (gap - ema) * 0.05;
  if (ema <= 26) {
    slow = 0;
    return;
  }
  // Más de ~26 ms por fotograma sostenidos (< 38 fps): baja el pixel ratio medio punto, hasta 1.
  if (++slow > 90 && dpr > 1) {
    dpr = Math.max(1, dpr - 0.5);
    slow = 0;
    ema = 16.7;
  }
}

function loop(now: number): void {
  raf = requestAnimationFrame(loop);
  const g = now - prevTs;
  prevTs = now;
  if (g > 0 && g < 100) rafGap += (g - rafGap) * 0.1;
  if (status !== "ok" || !renderer) return;
  if (rafGap < HIGH_HZ_GAP && (parity ^= 1)) return;
  const gap = now - lastRender;
  let drew = false;
  views.forEach((v) => {
    if (v.tick(now)) drew = true;
  });
  if (drew) {
    adapt(gap);
    lastRender = now;
  }
}

/** Alta de una vista: crea el renderer si hace falta y arranca el bucle. Devuelve false si no hay WebGL. */
export function register(v: Tickable): boolean {
  if (!ensureRenderer()) return false;
  clearTimeout(idleTimer);
  if (views.size === 0) warm = 120;
  views.add(v);
  if (!raf) raf = requestAnimationFrame(loop);
  return true;
}

export function unregister(v: Tickable): void {
  views.delete(v);
  if (views.size > 0) return;
  cancelAnimationFrame(raf);
  raf = 0;
  // Sin figuras no hay por qué retener la GPU: se suelta pasado un rato (así volver a abrir el player no recrea el contexto).
  idleTimer = window.setTimeout(() => views.size === 0 && disposeRenderer(), IDLE_DISPOSE_MS);
}

// ───────────── Diagnóstico (página dev) ─────────────

export function getStats(): typeof stats & { dpr: number; status: GlStatus; views: number; losses: number; gpu: string } {
  let gpu = "";
  if (renderer) {
    stats.geometries = renderer.info.memory.geometries; // en vivo (si no, solo se actualizaría al dibujar)
    stats.textures = renderer.info.memory.textures;
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  }
  return { ...stats, dpr, status, views: views.size, losses, gpu };
}

/** Provoca y deshace una pérdida de contexto (prueba de robustez de la página dev). */
export function debugLoseContext(restoreAfterMs: number | null): boolean {
  const ext = renderer?.getContext().getExtension("WEBGL_lose_context");
  if (!ext) return false;
  ext.loseContext();
  if (restoreAfterMs !== null) setTimeout(() => ext.restoreContext(), restoreAfterMs);
  return true;
}

export function debugRestoreContext(): boolean {
  const ext = renderer?.getContext().getExtension("WEBGL_lose_context");
  if (!ext) return false;
  ext.restoreContext();
  return true;
}

/** Libera el renderer ya (pruebas de memoria). */
export function debugDisposeRenderer(): void {
  if (views.size === 0) disposeRenderer();
}
