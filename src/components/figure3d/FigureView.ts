/**
 * Una figura 3D: escena, cámara, animación y suelo. No toca React; <Figure3DCanvas /> la gobierna.
 *
 * Decisiones:
 * - La cámara orbita al personaje (el personaje no gira) y la luz principal va pegada a la cámara: el sombreado se ve igual
 *   desde cualquier vista, como en una ilustración. El encuadre sale de una caja medida sobre el clip (assets.boundsFor).
 * - Cámara con suavizado exponencial (salida fuerte: arranca rápido y se posa sin rebote) sobre azimut y caja.
 * - Lado izquierdo = personaje reflejado (scale.x = -1) y el azimut también se refleja, de modo que la imagen es el espejo exacto
 *   de la del lado derecho (la mano de trabajo siempre queda cerca de la cámara). `keepFacing` conserva el azimut y el personaje
 *   sigue mirando a la derecha, con la mano de trabajo detrás del cuerpo.
 * - Solo dibuja cuando algo cambia: sin animar y con la cámara quieta, la figura no gasta GPU.
 */

import {
  AmbientLight,
  AnimationMixer,
  CircleGeometry,
  Color,
  BackSide,
  DirectionalLight,
  InstancedMesh,
  LoopRepeat,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Material,
} from "three";
import type { ExerciseId } from "@/lib/engine/types";
import { acquire, boundsFor, instantiate, release, trailFor, type Asset, type Box6, type Instance } from "./assets";
import { ELEVATION_BONUS, TRAIL_EXERCISES, cropY, noGround } from "./focus";
import { FIGURE_VIEWS as EXERCISE_VIEWS, viewYaw } from "../figure/poses";
import { draw, getDpr, register, unregister, type Tickable } from "./engine";
import type { InkTheme } from "./ink";
import { LOOK, U, lighting, makeOutline } from "./look";
import type { CharacterId, FigureSide, FigureViewInput } from "./types";

const RING_GEO = new SphereGeometry(LOOK.trailRing, 10, 8);
const DOT_GEO = new SphereGeometry(LOOK.trailDot, 10, 8);

const FOV = 24; // grados, vertical: perspectiva suave (casi ilustración)
const TAN = Math.tan((FOV * Math.PI) / 360);
const EASE_K = 7; // 1/s: ~95 % del recorrido en 0,43 s
const AUTO_K = 2.4; // en `auto` el giro entre vistas es más lento (~1,2 s)
const AUTO_DWELL = 4.5; // s que se queda en cada vista útil antes de pasar a la siguiente
/** Fases del clip en las que se dejan siluetas fijas detrás del personaje: el recorrido completo se ve de un vistazo. */
const GHOST_PHASES = [1 / 6, 1 / 2, 5 / 6];
/** Detalles que no aportan a una silueta (y cuestan una pasada de dibujo cada uno). */
const GHOST_SKIP = ["eyes", "eyebrows", "eyelashes", "hair", "eyewhite", "mouth", "blush"];
const TAIL = 0.45; // fracción del recorrido que dibuja la cola de la pesa
const FADE = 0.25; // s de fundido entre clips
const D2R = Math.PI / 180;
/** Fracción del campo de visión que ocupa el encuadre: mayor = personaje más grande (las caras se leen mejor). Los márgenes de huesos ya dejan aire. */
const FRAME = 0.9;

export interface ViewProps {
  exerciseId: ExerciseId;
  /** Sin valor: la mejor vista del ejercicio (FIGURE_VIEWS[id].defaultView de la 2D). */
  view: FigureViewInput | undefined;
  side: FigureSide;
  keepFacing: boolean;
  tone: "dark" | "light";
  showGround: boolean;
  playing: boolean;
  repSec: number | undefined;
  /** Fase (0..1) del clip en la pose representativa: arranque y movimiento reducido. */
  still: number;
  /** Dibuja el recorrido de la pesa (puntos con borde oscuro). Por defecto sí, salvo en los acarreos. */
  trail?: boolean | undefined;
  /** Congela el movimiento en esta fase (0..1) del clip: para el banco de pruebas visual. */
  phase?: number | undefined;
  /** Siluetas fijas de tres momentos del movimiento detrás del personaje (rango de la repetición). */
  ghosts?: boolean | undefined;
  /** Fuerza el clip `idle` (de pie, respirando) aunque el ejercicio tenga clip: para presentar al personaje. */
  idle?: boolean | undefined;
  reduced: boolean;
}

export interface ViewEvents {
  onReady(clip: string, usedIdle: boolean): void;
  onFail(e: unknown): void;
  /** Fase (0..1) del clip en cada fotograma animado; solo la figura principal de la pantalla lo pide. */
  onPhase?(p: number): void;
}

const wrap180 = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;
const _u = new Vector3();
const _r = new Vector3();
const _up = new Vector3();
const _c = new Vector3();
const _p = new Vector3();
const _s = new Vector3();
const _q = new Quaternion();
const _m4 = new Matrix4();

export class FigureView implements Tickable {
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.5, 40);
  // En three los valores de luz se multiplican por 1/π en el difuso: π equivale a "el color base completo".
  private ambient = new AmbientLight(0xffffff, lighting().ambient * Math.PI);
  private key = new DirectionalLight(0xffffff, lighting().key * Math.PI);
  private ground: Mesh<CircleGeometry, MeshBasicMaterial>;
  private rim = new Color();
  private ctx: CanvasRenderingContext2D;
  private asset: Asset | null = null;
  private inst: Instance | null = null;
  private mixer: AnimationMixer | null = null;
  private action: AnimationAction | null = null;
  private clip: AnimationClip | null = null;
  private usedIdle = false;
  private tone: InkTheme | null = null;
  private cssW = 0;
  private cssH = 0;
  private pw = 0;
  private ph = 0;
  private az = Number.NaN;
  private box: Box6 | null = null;
  private boxWant: Box6 | null = null;
  private trailObjs: Array<{ ring: InstancedMesh; dot: InstancedMesh; ghost: InstancedMesh; path: Vector3[] }> = [];
  /** Muestra de la pesa en la que está la cola dibujada (-1: sin dibujar). */
  private tailAt = -1;
  private trailMat: { ring: MeshBasicMaterial; dot: MeshBasicMaterial; ghost: MeshBasicMaterial } | null = null;
  private ghostObjs: Array<{ inst: Instance; mixer: AnimationMixer }> = [];
  private ghostMat: MeshBasicMaterial | null = null;
  private ghostRim: MeshBasicMaterial | null = null;
  private lastNow = 0;
  private autoT = 0;
  private dirty = true;
  private disposed = false;
  private registered = false;
  inView = true;
  paused = false; // pérdida de contexto: no dibuja hasta que vuelva

  constructor(
    private canvas: HTMLCanvasElement,
    private p: ViewProps,
    private ev: ViewEvents,
    private character: CharacterId,
  ) {
    this.ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.scene.add(this.camera, this.ambient);
    // Luz principal fija respecto a la cámara: arriba a la izquierda y algo por delante.
    this.key.position.set(-1.4, 2.2, 1.4);
    this.key.target.position.set(0, 0, -5);
    this.camera.add(this.key, this.key.target);
    this.ground = new Mesh(new CircleGeometry(1, 56), new MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: LOOK.groundAlpha }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.001;
    this.ground.renderOrder = -1;
    this.scene.add(this.ground);
  }

  /** Iluminación de estudio para los personajes con materiales PBR: ambiente, luz principal, relleno y contraluz que despega la silueta del fondo. */
  private studioLight(): void {
    const L = LOOK.studio;
    this.ambient.intensity = L.ambient * Math.PI;
    this.key.intensity = L.key * Math.PI;
    const fill = new DirectionalLight(0xfff3e6, L.fill * Math.PI);
    fill.position.set(2.2, -0.4, 1.2);
    fill.target.position.set(0, 0, -5);
    const rim = new DirectionalLight(0xffffff, L.rim * Math.PI);
    rim.position.set(1.6, 1.4, -6);
    rim.target.position.set(0, 0, -2);
    this.camera.add(fill, fill.target, rim, rim.target);
  }

  async init(): Promise<void> {
    if (!register(this)) return this.ev.onFail(new Error("sin WebGL"));
    this.registered = true;
    try {
      const asset = await acquire(this.character);
      if (this.disposed) return release(this.character);
      this.asset = asset;
      this.inst = instantiate(asset, this.p.tone === "light" ? asset.outlineLight : asset.outlineDark);
      this.scene.add(this.inst.root);
      if (asset.realistic) this.studioLight();
      this.mixer = new AnimationMixer(this.inst.root);
      this.applyStatic();
      this.play(true);
    } catch (e) {
      if (!this.disposed) this.ev.onFail(e);
    }
  }

  // ───────────── Props ─────────────

  update(next: Partial<ViewProps>): void {
    const prev = this.p;
    if (!(Object.keys(next) as (keyof ViewProps)[]).some((k) => next[k] !== prev[k])) return; // React vuelve a pintar a menudo: sin cambios no se redibuja
    this.p = { ...prev, ...next };
    if (!this.asset) return;
    const p = this.p;
    if (p.exerciseId !== prev.exerciseId || p.idle !== prev.idle || p.trail !== prev.trail || p.ghosts !== prev.ghosts) this.play(false);
    if (p.phase !== prev.phase && p.phase !== undefined && this.action && this.clip && this.mixer) {
      this.action.time = this.clip.duration * p.phase;
      this.mixer.update(0);
      this.syncBells();
    }
    else if (this.action && (p.repSec !== prev.repSec)) this.applyRate();
    if (p.tone !== prev.tone || p.showGround !== prev.showGround || p.side !== prev.side || p.keepFacing !== prev.keepFacing) this.applyStatic();
    if (p.side !== prev.side && this.clip && this.asset) this.boxWant = this.measure(this.clip);
    if (p.reduced !== prev.reduced || (p.reduced && p.still !== prev.still)) this.restill();
    this.dirty = true;
  }

  setInk(t: InkTheme): void {
    this.tone = t;
    // Borde: --ink-lift del día; sobre campos oscuros (cobalto, luminancia < 0,2) pasa a papel, que es lo que separa la silueta (docs/PERSONAJES-3D.md §4).
    const c = new Color(t.ink); // r,g,b ya en lineal: la luminancia relativa de WCAG
    this.rim.set(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.2 ? t.paper : t.lift);
    this.ground.material.color.set(this.p.tone === "light" ? t.paper : t.deep);
    this.ghostMat?.color.set(this.ghostColor());
    this.ghostRim?.color.set(t.paper);
    this.dirty = true;
  }

  /** Silueta: la tinta del día aclarada un 30 % hacia el papel (se lee sin competir con el personaje). */
  private ghostColor(): Color {
    const t = this.tone;
    return t ? new Color(t.ink).lerp(new Color(t.paper), 0.3) : new Color(0x888888);
  }

  resize(cssW: number, cssH: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.syncCanvas();
  }

  private syncCanvas(): void {
    const dpr = getDpr();
    const pw = Math.max(1, Math.round(this.cssW * dpr));
    const ph = Math.max(1, Math.round(this.cssH * dpr));
    if (pw === this.pw && ph === this.ph) return;
    this.pw = pw;
    this.ph = ph;
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.camera.aspect = this.cssW / Math.max(1, this.cssH);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  private mirrored = (): boolean => this.p.side === "left";

  /** Reflejo, contorno según tono y suelo. */
  private applyStatic(): void {
    const { tone, showGround } = this.p;
    if (this.inst && this.asset) {
      this.inst.root.scale.x = this.mirrored() ? -1 : 1;
      const m: Material = tone === "light" ? this.asset.outlineLight : this.asset.outlineDark;
      for (const o of this.inst.outlines) o.material = m;
    }
    for (const g of this.ghostObjs) g.inst.root.scale.x = this.mirrored() ? -1 : 1;
    this.ground.visible = showGround && !noGround(this.p.exerciseId); // en el zoom de tronco el disco de suelo queda fuera del encuadre
    if (this.tone) this.ground.material.color.set(tone === "light" ? this.tone.paper : this.tone.deep);
    this.ground.material.opacity = tone === "light" ? LOOK.groundAlpha * 0.35 : LOOK.groundAlpha;
  }

  // ───────────── Animación ─────────────

  /** timeScale = duración del clip / segundos por repetición (el clip dura una repetición). El respaldo idle va a su ritmo. */
  private rate(clip: AnimationClip): number {
    const s = this.p.repSec;
    return !this.usedIdle && s && s > 0 ? clip.duration / s : 1;
  }

  private applyRate(): void {
    if (this.action && this.clip) this.action.timeScale = this.rate(this.clip);
  }

  private play(first: boolean): void {
    const a = this.asset;
    const mixer = this.mixer;
    if (!a || !mixer) return;
    const wanted = this.p.idle ? undefined : a.clips.get(this.p.exerciseId);
    const clip = wanted ?? a.clips.get("idle") ?? [...a.clips.values()][0];
    if (!clip) return this.ev.onFail(new Error("el GLB no tiene clips"));
    const prev = this.action;
    const next = mixer.clipAction(clip);
    this.usedIdle = !wanted;
    if (prev === next) {
      // Dos ejercicios sin clip propio caen en el mismo idle: no se reinicia, solo se avisa.
      this.applyRate();
      return this.ev.onReady(clip.name, !wanted);
    }
    next.reset();
    next.setLoop(LoopRepeat, Infinity);
    next.timeScale = this.rate(clip);
    next.time = clip.duration * this.p.still;
    const fade = !first && this.p.playing && !this.p.reduced && prev;
    if (fade) {
      next.play();
      prev.crossFadeTo(next, FADE, false);
    } else {
      prev?.stop();
      next.play();
    }
    this.action = next;
    this.clip = clip;
    this.boxWant = this.measure(clip);
    if (!this.box || first) this.box = [...this.boxWant] as Box6;
    this.buildTrail(clip);
    this.buildGhosts(clip);
    if (this.p.phase !== undefined) next.time = clip.duration * this.p.phase;
    mixer.update(0);
    this.syncBells();
    this.dirty = true;
    this.ev.onReady(clip.name, !wanted);
  }

  private restill(): void {
    if (!this.action || !this.clip || !this.mixer) return;
    if (this.p.reduced) {
      this.action.time = this.clip.duration * this.p.still;
      this.mixer.update(0);
      this.syncBells();
    }
  }

  /** Las pesas que el clip no usa vienen con escala ≈ 0.001: se ocultan (y con ellas su contorno). */
  private syncBells(): void {
    if (!this.inst) return;
    for (const b of this.inst.bells) if (b) b.visible = b.scale.x > 0.02;
  }

  /** Caja del clip, reflejada si hace falta. */
  private measure(clip: AnimationClip): Box6 {
    const b = [...boundsFor(this.asset as Asset, clip)] as Box6;
    // Ejercicios de tronco superior: se encuadra de la cintura para arriba (la cara y los brazos ganan tamaño).
    const minY = this.usedIdle ? undefined : cropY(this.p.exerciseId);
    if (minY !== undefined) {
      b[1] = Math.max(b[1], minY);
      if (minY > 0.6) {
        // tronco superior: también se recorta el margen lateral y el de arriba
        b[0] += 0.07;
        b[3] -= 0.07;
        b[4] -= 0.06;
      }
    }
    return this.mirrored() ? [-b[3], b[1], b[2], -b[0], b[4], b[5]] : b;
  }

  /** Recorrido de la pesa en forma de cola de cometa: puntos blancos con borde oscuro que se achican hacia atrás (el espacio es el del personaje, se reflejan con él). */
  private buildTrail(clip: AnimationClip): void {
    for (const t of this.trailObjs) {
      for (const o of [t.ring, t.dot, t.ghost]) {
        o.removeFromParent();
        o.dispose();
      }
    }
    this.trailObjs = [];
    this.tailAt = -1;
    if (!this.asset || !this.inst || this.usedIdle || this.p.trail === false || !TRAIL_EXERCISES.has(this.p.exerciseId)) return;
    if (!this.trailMat) {
      this.trailMat = {
        ring: new MeshBasicMaterial({ color: 0x14152e, side: BackSide }),
        dot: new MeshBasicMaterial({ color: 0xf4efe2 }),
        // Versión tenue que se ve a través del cuerpo: así el círculo del halo se lee entero aunque la cabeza lo tape.
        ghost: new MeshBasicMaterial({ color: 0xf4efe2, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }),
      };
    }
    for (const path of trailFor(this.asset, clip)) {
      if (path.length < 4) continue;
      const ring = new InstancedMesh(RING_GEO, this.trailMat.ring, path.length);
      const dot = new InstancedMesh(DOT_GEO, this.trailMat.dot, path.length);
      const ghost = new InstancedMesh(DOT_GEO, this.trailMat.ghost, path.length);
      ghost.renderOrder = 5;
      for (const o of [ring, dot, ghost]) {
        o.frustumCulled = false;
        this.inst.root.add(o);
      }
      this.trailObjs.push({ ring, dot, ghost, path });
    }
  }

  /** Coloca la cola en la muestra que corresponde a la fase actual: la última fracción del recorrido, de más grande (la pesa) a más pequeña. Solo escribe al cambiar de muestra. */
  private updateTail(): void {
    if (!this.trailObjs.length || !this.action || !this.clip) return;
    const n = (this.trailObjs[0] as { path: Vector3[] }).path.length;
    const head = Math.floor((((this.action.time % this.clip.duration) + this.clip.duration) % this.clip.duration) / this.clip.duration * n) % n;
    if (head === this.tailAt) return;
    this.tailAt = head;
    const len = Math.round(n * TAIL);
    for (const t of this.trailObjs) {
      t.path.forEach((p, i) => {
        const age = (head - i + n) % n;
        _m4.compose(p, _q, _s.setScalar(age < len ? 1 - (0.7 * age) / len : 0));
        t.ring.setMatrixAt(i, _m4);
        t.dot.setMatrixAt(i, _m4);
        t.ghost.setMatrixAt(i, _m4);
      });
      for (const o of [t.ring, t.dot, t.ghost]) o.instanceMatrix.needsUpdate = true;
    }
  }

  /** Siluetas planas (sin contorno ni profundidad: siempre quedan detrás del personaje) del clip congelado en GHOST_PHASES. */
  private buildGhosts(clip: AnimationClip): void {
    for (const g of this.ghostObjs) {
      g.mixer.stopAllAction();
      g.mixer.uncacheRoot(g.inst.root);
      this.scene.remove(g.inst.root);
      g.inst.skeleton?.dispose();
    }
    this.ghostObjs = [];
    const a = this.asset;
    if (!a || this.usedIdle || !this.p.ghosts) return;
    this.ghostMat ??= new MeshBasicMaterial({ color: this.ghostColor(), depthTest: false, depthWrite: false });
    if (!this.ghostRim) {
      this.ghostRim = makeOutline(this.tone?.paper ?? "#f4f6fa");
      this.ghostRim.depthTest = false;
      this.ghostRim.depthWrite = false;
    }
    for (const ph of GHOST_PHASES) {
      const inst = instantiate(a, this.ghostRim, true);
      const skip = new Set<unknown>();
      inst.root.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && !inst.outlines.includes(m) && GHOST_SKIP.includes((m.material as Material).name)) skip.add(m.geometry);
      });
      const gone: Mesh[] = [];
      inst.root.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && skip.has(m.geometry)) gone.push(m); // el detalle y su contorno
      });
      for (const m of gone) m.removeFromParent();
      inst.root.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const hull = inst.outlines.includes(m);
        m.material = hull ? (this.ghostRim as MeshBasicMaterial) : (this.ghostMat as MeshBasicMaterial);
        m.renderOrder = hull ? -4 : -3;
      });
      inst.root.scale.x = this.mirrored() ? -1 : 1;
      this.scene.add(inst.root);
      const mixer = new AnimationMixer(inst.root);
      const act = mixer.clipAction(clip);
      act.play();
      act.time = clip.duration * ph;
      mixer.update(0);
      for (const b of inst.bells) if (b) b.visible = b.scale.x > 0.02;
      this.ghostObjs.push({ inst, mixer });
    }
  }

  // ───────────── Cámara ─────────────

  private basis(azDeg: number): void {
    const a = azDeg * D2R;
    const e = (6 + 6 * Math.abs(Math.sin(2 * a)) + (ELEVATION_BONUS[this.p.exerciseId] ?? 0)) * D2R;
    _u.set(-Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); // del objetivo hacia la cámara
    _r.set(_u.z, 0, -_u.x).normalize();
    _up.crossVectors(_u, _r);
  }

  /** Radio del disco de suelo: fijo, salvo clips que recorren mucho suelo (get-up). */
  private groundR(b: Box6): number {
    const reach = Math.max(Math.abs(b[0]), Math.abs(b[3]), Math.abs(b[2]), Math.abs(b[5]));
    return Math.min(0.85, Math.max(LOOK.groundRadius, reach * 0.5));
  }

  /**
   * Distancia que hace caber las 8 esquinas de la caja y el disco de suelo con la cámara en azimut `azDeg` (azimut ya reflejado).
   * Para cada punto a distancia D: desplazamiento_en_pantalla / (D - profundidad) <= tangente del campo de visión.
   */
  private fit(azDeg: number, b: Box6): number {
    this.basis(azDeg);
    const tx = TAN * this.camera.aspect * FRAME;
    const ty = TAN * FRAME;
    _c.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
    let d = 0;
    const take = (): void => {
      const along = _p.dot(_u);
      d = Math.max(d, along + Math.abs(_p.dot(_r)) / tx, along + Math.abs(_p.dot(_up)) / ty);
    };
    for (let i = 0; i < 8; i++) {
      _p.set(i & 1 ? b[3] : b[0], i & 2 ? b[4] : b[1], i & 4 ? b[5] : b[2]).sub(_c);
      take();
    }
    // Disco: sus extremos laterales y su borde cercano/lejano (la parte horizontal de `u` apunta hacia la cámara).
    // Si no se dibuja (zoom de tronco, sin suelo) no condiciona el encuadre.
    if (!this.ground.visible) return d;
    const R = this.groundR(b);
    const hx = _u.x;
    const hz = _u.z;
    const hl = Math.hypot(hx, hz) || 1;
    for (const [px, pz] of [[_r.x * R, _r.z * R], [-_r.x * R, -_r.z * R], [(hx / hl) * R, (hz / hl) * R], [(-hx / hl) * R, (-hz / hl) * R]] as const) {
      _p.set(px, 0, pz).sub(_c);
      take();
    }
    return d;
  }

  /** Yaw (convención de la 2D: 0 perfil, 90 frente) de la vista pedida; `auto` recorre las vistas útiles del ejercicio. */
  private wantYaw(): number {
    const { exerciseId: id, view, reduced } = this.p;
    const spec = EXERCISE_VIEWS[id];
    const v = view ?? spec.defaultView;
    if (v !== "auto") return viewYaw(id, v);
    if (reduced || spec.views.length < 2) return viewYaw(id, spec.defaultView);
    return viewYaw(id, spec.views[Math.floor(this.autoT / AUTO_DWELL) % spec.views.length] ?? spec.defaultView);
  }

  /** Avanza azimut y caja hacia su meta. Devuelve true si siguen en movimiento. */
  private stepCamera(dt: number): boolean {
    const p = this.p;
    const auto = (p.view ?? "") === "auto" && !p.reduced;
    if (auto) this.autoT += dt;
    const want = 90 - this.wantYaw(); // azimut de la cámara: 0 = delante, 90 = en el lado de la mano derecha
    let moving = false;
    if (Number.isNaN(this.az) || p.reduced) {
      this.az = want;
    } else {
      const k = 1 - Math.exp(-dt * (auto ? AUTO_K : EASE_K));
      const d = wrap180(want - this.az);
      if (Math.abs(d) < 0.05) this.az = want;
      else {
        this.az += d * k;
        moving = true;
      }
    }
    if (this.box && this.boxWant) {
      const k = p.reduced ? 1 : 1 - Math.exp(-dt * EASE_K);
      for (let i = 0; i < 6; i++) {
        const d = (this.boxWant[i] as number) - (this.box[i] as number);
        if (Math.abs(d) < 0.001) this.box[i] = this.boxWant[i] as number;
        else {
          this.box[i] = (this.box[i] as number) + d * k;
          moving = true;
        }
      }
    }
    return moving;
  }

  private place(): number {
    const b = this.box as Box6;
    const sgn = this.mirrored() && !this.p.keepFacing ? -1 : 1;
    const az = this.az * sgn;
    const dist = this.fit(az, b);
    this.basis(az);
    _c.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
    this.camera.position.copy(_c).addScaledVector(_u, dist);
    this.camera.lookAt(_c);
    // Contorno de grosor constante en pantalla: metros por píxel CSS a la distancia del objetivo.
    U.uThick.value = LOOK.outlinePx * ((2 * dist * TAN) / Math.max(1, this.cssH));
    this.ground.scale.setScalar(this.groundR(b));
    this.updateTail();
    return dist;
  }

  // ───────────── Bucle ─────────────

  tick(now: number): boolean {
    if (this.disposed || this.paused || !this.mixer || !this.box || this.cssW < 2) return false;
    if (document.hidden || !this.inView) {
      this.lastNow = 0;
      return false;
    }
    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;
    this.syncCanvas();
    let moving = false;
    if (this.p.playing && !this.p.reduced && this.p.phase === undefined) {
      this.mixer.update(dt);
      this.syncBells();
      if (this.ev.onPhase && this.action && this.clip) this.ev.onPhase((this.action.time % this.clip.duration) / this.clip.duration);
      moving = true;
    }
    if (this.stepCamera(dt)) moving = true;
    if (!moving && !this.dirty) return false;
    this.dirty = false;
    this.place();
    U.uRim.value.copy(this.rim);
    draw(this.scene, this.camera, this.ctx, this.pw, this.ph);
    return true;
  }

  /** Para volver a dibujar tras recuperar el contexto o cambiar algo externo. */
  invalidate(): void {
    this.dirty = true;
  }

  dispose(): void {
    this.disposed = true;
    if (this.registered) unregister(this);
    this.mixer?.stopAllAction();
    if (this.inst) {
      this.mixer?.uncacheRoot(this.inst.root);
      this.scene.remove(this.inst.root);
      this.inst.outlines.forEach((o) => o.removeFromParent());
      this.inst.skeleton?.dispose();
    }
    for (const t of this.trailObjs) {
      t.ring.dispose();
      t.dot.dispose();
      t.ghost.dispose();
    }
    this.trailMat?.ring.dispose();
    this.trailMat?.dot.dispose();
    this.trailMat?.ghost.dispose();
    for (const g of this.ghostObjs) {
      g.mixer.stopAllAction();
      g.mixer.uncacheRoot(g.inst.root);
      g.inst.skeleton?.dispose();
    }
    this.ghostMat?.dispose();
    this.ghostRim?.dispose();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    this.key.dispose();
    if (this.asset) release(this.character);
    this.asset = this.inst = this.mixer = this.action = null;
  }
}
