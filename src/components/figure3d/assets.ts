/**
 * Carga y caché de los GLB (uno por personaje) con cuenta de usos.
 * La geometría, los materiales toon y los clips se comparten entre todas las vistas del mismo personaje;
 * cada vista solo clona el árbol de nodos (huesos incluidos). Al soltar el último uso se espera un rato antes de
 * liberar la GPU, para que un remontaje (p. ej. cambiar de ejercicio en el player) no vuelva a analizar el archivo.
 */

import {
  AnimationMixer,
  Bone,
  Box3,
  Mesh,
  DoubleSide,
  MeshStandardMaterial,
  MeshToonMaterial,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
  type Material,
  type Object3D,
  type Skeleton,
  type Texture,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";
import { NIGHT, PAPER } from "@/lib/inks";
import { LOOK, makeGradient, makeOutline, makeToon } from "./look";
import { modelUrl, type CharacterId } from "./types";

/** Caja en metros del personaje sin reflejar: [minX, minY, minZ, maxX, maxY, maxZ]. */
export type Box6 = [number, number, number, number, number, number];

export interface Asset {
  id: CharacterId;
  /** Personaje con texturas y materiales PBR (MakeHuman): sin contorno de cómic y con iluminación de estudio. */
  realistic: boolean;
  root: Object3D;
  clips: Map<string, AnimationClip>;
  toon: Map<string, Material>;
  outlineDark: Material;
  outlineLight: Material;
  gradient: Texture;
  bounds: Map<string, Box6>;
  /** Recorrido de cada pesa a lo largo de un clip (posiciones en el espacio del personaje, sin reflejar). */
  trails: Map<string, Vector3[][]>;
  probe?: { root: Object3D; mixer: AnimationMixer };
  /** Para liberar la memoria al soltar el último uso. */
  sources: Material[];
}

export const GRACE_MS = 20_000;
const RETRIES = [800, 2200]; // esperas antes de cada reintento de descarga: 2 reintentos y se rinde

const cache = new Map<CharacterId, { refs: number; timer: number; promise: Promise<Asset> }>();

/** Pelo, cejas y pestañas son planos con transparencia: recorte duro (sin ordenar transparencias) y a dos caras. */
const CUTOUT = ["hair", "eyebrows", "eyelashes"];

function tuneRealistic(m: MeshStandardMaterial): Material {
  if (CUTOUT.includes(m.name)) {
    m.transparent = false;
    m.alphaTest = 0.4;
    m.depthWrite = true;
    m.side = DoubleSide;
  }
  if (m.map) m.map.anisotropy = 4;
  return m;
}

async function load(id: CharacterId): Promise<Asset> {
  const loader = new GLTFLoader();
  let gltf;
  for (let i = 0; ; i++) {
    try {
      gltf = await loader.loadAsync(modelUrl(id));
      break;
    } catch (e) {
      const wait = RETRIES[i];
      // Un 4xx (p. ej. 404: el GLB aún no existe) no mejora reintentando; red caída o 5xx sí.
      if (wait === undefined || /responded with 4\d\d/.test(String((e as Error)?.message))) throw e;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  const gradient = makeGradient();
  const toon = new Map<string, Material>();
  const sources: Material[] = [];
  // Personaje realista (MakeHuman): sus materiales traen texturas; se dibujan tal cual (PBR) y sin contorno.
  let realistic = false;
  gltf.scene.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && (m.material as MeshStandardMaterial).map) realistic = true;
  });
  gltf.scene.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const src = m.material as Material;
    m.frustumCulled = false; // la caja de una malla con piel no sigue a los huesos
    if (!toon.has(src.name)) {
      const made = realistic ? tuneRealistic(src as MeshStandardMaterial) : makeToon(src, gradient);
      const color = LOOK.override[id]?.[src.name];
      if (color) (made as MeshToonMaterial).color.set(color);
      toon.set(src.name, made);
      sources.push(src);
    }
  });
  const clips = new Map(gltf.animations.map((c) => [c.name, c] as const));
  return {
    id,
    realistic,
    root: gltf.scene,
    clips,
    toon,
    outlineDark: makeOutline(NIGHT),
    outlineLight: makeOutline(PAPER),
    gradient,
    bounds: new Map(),
    trails: new Map(),
    sources,
  };
}

export function acquire(id: CharacterId): Promise<Asset> {
  let e = cache.get(id);
  if (!e) {
    const promise = load(id);
    e = { refs: 0, timer: 0, promise };
    cache.set(id, e);
    promise.catch(() => {
      if (cache.get(id)?.promise === promise) cache.delete(id); // un fallo no se queda en caché: se puede reintentar
    });
  }
  clearTimeout(e.timer);
  e.refs++;
  return e.promise;
}

export function release(id: CharacterId): void {
  const e = cache.get(id);
  if (!e || --e.refs > 0) return;
  e.timer = window.setTimeout(() => {
    if (e.refs > 0 || cache.get(id) !== e) return;
    cache.delete(id);
    e.promise.then(disposeAsset, () => {});
  }, GRACE_MS);
}

/** Libera ya (sin esperar la gracia). Para pruebas de memoria. */
export function purge(): void {
  for (const [id, e] of [...cache]) {
    clearTimeout(e.timer);
    if (e.refs > 0) continue;
    cache.delete(id);
    e.promise.then(disposeAsset, () => {});
  }
}

function disposeAsset(a: Asset): void {
  a.root.traverse((o) => (o as Mesh).isMesh && (o as Mesh).geometry.dispose());
  a.toon.forEach((m) => m.dispose());
  a.sources.forEach((m) => m.dispose());
  a.outlineDark.dispose();
  a.outlineLight.dispose();
  a.gradient.dispose();
}

export interface Instance {
  root: Object3D;
  bells: [Object3D | undefined, Object3D | undefined];
  outlines: Mesh[];
  /** Esqueleto compartido por todas las mallas con piel de esta copia (y sus contornos): se libera al desmontar. */
  skeleton: Skeleton | undefined;
}

/**
 * Copia dibujable: nodos clonados, materiales del personaje y un casco de contorno por malla visible (solo en el estilo cómic,
 * o con `hulls` para las siluetas de poses clave, que siempre llevan borde).
 */
export function instantiate(a: Asset, outlineMat: Material, hulls = !a.realistic): Instance {
  const root = cloneRig(a.root);
  let shared: Skeleton | undefined;
  const outlines: Mesh[] = [];
  const meshes: Mesh[] = [];
  root.traverse((o) => (o as Mesh).isMesh && meshes.push(o as Mesh));
  for (const m of meshes) {
    const skinned = m as SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      // SkeletonUtils.clone da un esqueleto por malla (10 en el cuerpo): se unifican para actualizar y subir los huesos una sola vez.
      if (!shared) shared = skinned.skeleton;
      else {
        skinned.skeleton.dispose();
        skinned.bind(shared, skinned.bindMatrix);
      }
    }
    const name = (m.material as Material).name;
    m.material = a.toon.get(name) ?? m.material;
    m.frustumCulled = false;
    if (!hulls || LOOK.outlineSkip.includes(name)) continue;
    let hull: Mesh;
    if (skinned.isSkinnedMesh && shared) {
      hull = new SkinnedMesh(m.geometry, outlineMat);
      (hull as SkinnedMesh).bind(shared, skinned.bindMatrix);
    } else hull = new Mesh(m.geometry, outlineMat);
    hull.frustumCulled = false;
    hull.name = m.name + "_outline";
    m.parent?.add(hull);
    outlines.push(hull);
  }
  const bells: Instance["bells"] = [root.getObjectByName("Kettlebell"), root.getObjectByName("Kettlebell2")];
  // La pesa es lo que hay que ver: sus mallas (y su contorno) se dibujan un poco más grandes alrededor del origen de la pesa.
  // (Con personajes realistas va a su tamaño real: el halo se ajusta contra el cuerpo con esas medidas.)
  const bellScale = a.realistic ? 1 : LOOK.bellScale;
  for (const b of bells) b?.children.forEach((c) => c.scale.multiplyScalar(bellScale));
  return {
    root,
    bells,
    outlines,
    skeleton: shared,
  };
}

const MARGIN: Record<string, number> = { Head: 0.15, "Hand.L": 0.1, "Hand.R": 0.1, "Foot.L": 0.1, "Foot.R": 0.1, "Toe.L": 0.08, "Toe.R": 0.08 };
const SAMPLES = 14;
const _v = new Vector3();
const _box = new Box3();

/** Centro del cuerpo de la pesa en el mundo (el origen del objeto es el agarre: en el halo, con la pesa invertida, va 20 cm por debajo). */
const bellCenter = (b: Object3D, out: Vector3): Vector3 => _box.setFromObject(b).getCenter(out);

/**
 * Caja del personaje a lo largo de UN clip (huesos + margen para volumen, pesas con su radio), sin reflejar.
 * Se mide con una copia que nunca se dibuja. El encuadre sale de aquí: no hay cámara por ejercicio escrita a mano.
 */
export function boundsFor(a: Asset, clip: AnimationClip): Box6 {
  const hit = a.bounds.get(clip.name);
  if (hit) return hit;
  if (!a.probe) {
    const root = cloneRig(a.root);
    a.probe = { root, mixer: new AnimationMixer(root) };
  }
  const { root, mixer } = a.probe;
  const bones: Bone[] = [];
  root.traverse((o) => (o as Bone).isBone && bones.push(o as Bone));
  const bells = [root.getObjectByName("Kettlebell"), root.getObjectByName("Kettlebell2")];
  const box: Box6 = [Infinity, 0, Infinity, -Infinity, 0, -Infinity];
  const grow = (p: Vector3, r: number): void => {
    box[0] = Math.min(box[0], p.x - r);
    box[1] = Math.min(box[1], p.y - r);
    box[2] = Math.min(box[2], p.z - r);
    box[3] = Math.max(box[3], p.x + r);
    box[4] = Math.max(box[4], p.y + r);
    box[5] = Math.max(box[5], p.z + r);
  };
  const act = mixer.clipAction(clip);
  act.play();
  for (let k = 0; k < SAMPLES; k++) {
    act.time = (k / SAMPLES) * clip.duration;
    mixer.update(0);
    root.updateMatrixWorld(true);
    for (const b of bones) grow(b.getWorldPosition(_v), MARGIN[b.name] ?? 0.08);
    for (const b of bells) if (b && b.scale.x > 0.02) grow(bellCenter(b, _v), 0.22);
  }
  act.stop();
  mixer.uncacheAction(clip);
  box[1] = Math.min(box[1], -0.14); // sitio bajo los pies para el borde cercano del disco de suelo (visto desde 6-12° de elevación)
  a.bounds.set(clip.name, box);
  return box;
}

const TRAIL_N = 56;

/**
 * Recorrido de cada pesa durante UNA repetición: TRAIL_N posiciones a intervalos iguales del clip (bucle cerrado).
 * Se mide con la misma copia que nunca se dibuja. Una pesa que el clip no usa devuelve un camino vacío.
 */
export function trailFor(a: Asset, clip: AnimationClip): Vector3[][] {
  const hit = a.trails.get(clip.name);
  if (hit) return hit;
  if (!a.probe) {
    const root = cloneRig(a.root);
    a.probe = { root, mixer: new AnimationMixer(root) };
  }
  const { root, mixer } = a.probe;
  const bells = [root.getObjectByName("Kettlebell"), root.getObjectByName("Kettlebell2")];
  const paths: Vector3[][] = [[], []];
  const act = mixer.clipAction(clip);
  act.play();
  for (let k = 0; k < TRAIL_N; k++) {
    act.time = (k / TRAIL_N) * clip.duration;
    mixer.update(0);
    root.updateMatrixWorld(true);
    bells.forEach((b, i) => {
      if (b && b.scale.x > 0.02) (paths[i] as Vector3[]).push(bellCenter(b, new Vector3()));
    });
  }
  act.stop();
  mixer.uncacheAction(clip);
  a.trails.set(clip.name, paths);
  return paths;
}
