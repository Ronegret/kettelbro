#!/usr/bin/env node
/**
 * Valida los GLB de los personajes contra docs/PERSONAJES-3D-CONTRATO.md (sin dependencias: solo Node).
 *
 * Lee el JSON y el BIN del GLB y comprueba: huesos exactos (§3), materiales (§4), pesas sin piel, sin cámaras
 * ni luces, clips con nombre = ExerciseId o "idle", duración = secPerRep (o 2 s), bucle sin salto (primer y
 * último fotograma iguales), pesas horneadas en cada clip, triángulos, tamaño (§6), texturas, Y arriba y
 * personaje mirando a +Z.
 *
 * Uso: node scripts/validate-glb.mjs [public/models/bro.glb ...] [--require-all]
 *   --require-all  exige los 29 clips del §8 (sin él, los que falten solo se avisan: entrega por hitos).
 * También se importa desde src/lib/__tests__/models.test.ts (función validateGlb).
 */
import { gzipSync } from "node:zlib";

export const REQUIRED_BONES = [
  "Hips", "Spine", "Chest", "Neck", "Head",
  "Shoulder.L", "UpperArm.L", "ForeArm.L", "Hand.L",
  "Shoulder.R", "UpperArm.R", "ForeArm.R", "Hand.R",
  "UpLeg.L", "Leg.L", "Foot.L", "Toe.L",
  "UpLeg.R", "Leg.R", "Foot.R", "Toe.R",
];
export const OPTIONAL_BONES = ["Tail.1", "Tail.2", "Tail.3", "Grip.L", "Grip.R"];
export const REQUIRED_MATERIALS = ["skin", "tattoo", "top", "bottoms", "shoes", "hair", "beard", "earrings", "eyes", "mouth", "bell", "bellHandle"];
/** Materiales opcionales de las caras (contrato §4): esclerótica y brillo, rubor. */
export const OPTIONAL_MATERIALS = ["eyewhite", "blush"];
export const LIMITS = { triangles: 14000, bones: 65, bytes: 1.5 * 1024 * 1024, gzipBytes: 800 * 1024, textures: 1, textureSize: 512 };
/** Personajes realistas (MakeHuman, con texturas PBR): se reconocen porque el GLB lleva imágenes. */
export const LIMITS_REALISTIC = { triangles: 60000, bones: 65, bytes: 4 * 1024 * 1024, gzipBytes: 3.5 * 1024 * 1024, textures: 14, textureSize: 1024 };
export const REALISTIC_MATERIALS = ["skin", "hair", "eyes", "shoes", "top", "bell", "bellHandle"];
export const REALISTIC_OPTIONAL_MATERIALS = ["eyebrows", "eyelashes", "top1"];
export const HEIGHTS = { bro: 1.805, princess: 1.606 };
const FPS = 30;
const IDLE_SEC = [1, 8];

function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("no es un GLB (falta la firma glTF)");
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  const off = 20 + buf.readUInt32LE(12);
  const bin = off + 8 <= buf.length ? buf.subarray(off + 8, off + 8 + buf.readUInt32LE(off)) : Buffer.alloc(0);
  return { json, bin };
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readFloats(gltf, index) {
  const acc = gltf.json.accessors[index];
  if (acc.componentType !== 5126) throw new Error(`accessor ${index}: solo se leen floats`);
  const view = gltf.json.bufferViews[acc.bufferView];
  const n = COMPONENTS[acc.type];
  const stride = view.byteStride || n * 4;
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let k = 0; k < n; k++) row.push(gltf.bin.readFloatLE(start + i * stride + k * 4));
    out.push(row);
  }
  return out;
}

function imageSize(gltf, img) {
  if (img.bufferView === undefined) return null;
  const v = gltf.json.bufferViews[img.bufferView];
  const b = gltf.bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  for (let i = 2; i < b.length - 9; ) {
    const marker = b.readUInt16BE(i);
    if (marker >= 0xffc0 && marker <= 0xffc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

const same = (a, b, eps) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= eps);

/**
 * @param {Buffer} buf  contenido del .glb
 * @param {{ exercises: {id: string, secPerRep: number}[], character?: string, requireAll?: boolean }} opts
 */
export function validateGlb(buf, opts) {
  const errors = [];
  const warnings = [];
  const stats = {};
  let gltf;
  try {
    gltf = parseGlb(buf);
  } catch (e) {
    return { errors: [String(e.message || e)], warnings, stats };
  }
  const j = gltf.json;
  const realistic = (j.images || []).length > 0;
  const L = realistic ? LIMITS_REALISTIC : LIMITS;
  const nodes = j.nodes || [];
  const byName = new Map(nodes.map((n, i) => [n.name, i]));

  // ── Esqueleto ──
  const skins = j.skins || [];
  if (skins.length !== 1) errors.push(`debe haber 1 skin y hay ${skins.length}`);
  const joints = (skins[0]?.joints || []).map((i) => nodes[i]?.name);
  stats.bones = joints.length;
  for (const b of REQUIRED_BONES) if (!joints.includes(b)) errors.push(`falta el hueso ${b}`);
  for (const b of joints) if (!REQUIRED_BONES.includes(b) && !OPTIONAL_BONES.includes(b)) errors.push(`hueso no previsto en el contrato: ${b}`);
  if (joints.length > L.bones) errors.push(`${joints.length} huesos (> ${L.bones})`);
  if (!byName.has("Rig")) errors.push('falta el nodo del Armature "Rig"');

  // ── Materiales ──
  const mats = (j.materials || []).map((m) => m.name);
  const needed = realistic ? REALISTIC_MATERIALS : REQUIRED_MATERIALS;
  const optional = realistic ? REALISTIC_OPTIONAL_MATERIALS : OPTIONAL_MATERIALS;
  for (const m of needed) if (!mats.includes(m)) errors.push(`falta el material ${m}`);
  for (const m of mats) if (!needed.includes(m) && !optional.includes(m)) warnings.push(`material no previsto: ${m}`);

  // ── Pesas ──
  for (const name of ["Kettlebell", "Kettlebell2"]) {
    const n = nodes[byName.get(name)];
    if (!n) errors.push(`falta el nodo ${name}`);
    else if (n.skin !== undefined) errors.push(`${name} no debe tener piel`);
    else if (n.mesh === undefined) errors.push(`${name} no tiene malla`);
  }

  // ── Cámaras, luces, texturas ──
  if ((j.cameras || []).length) errors.push("el GLB no debe llevar cámaras");
  if (j.extensions?.KHR_lights_punctual || (j.extensionsUsed || []).includes("KHR_lights_punctual")) errors.push("el GLB no debe llevar luces");
  const images = j.images || [];
  stats.textures = images.length;
  if (images.length > L.textures) errors.push(`${images.length} texturas (> ${L.textures})`);
  for (const img of images) {
    const s = imageSize(gltf, img);
    if (s && (s[0] > L.textureSize || s[1] > L.textureSize)) errors.push(`textura de ${s[0]}x${s[1]} (> ${L.textureSize}x${L.textureSize})`);
  }

  // ── Triángulos (cada malla por cada nodo que la usa) ──
  let tris = 0;
  for (const n of nodes) {
    if (n.mesh === undefined) continue;
    for (const p of j.meshes[n.mesh].primitives) {
      const mode = p.mode ?? 4;
      if (mode !== 4) errors.push(`primitiva en modo ${mode} (solo triángulos)`);
      const count = p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count;
      tris += count / 3;
    }
  }
  stats.triangles = tris;
  if (tris > L.triangles) errors.push(`${tris} triángulos (> ${L.triangles})`);

  // ── Orientación y altura: Y arriba, pies en el suelo, cara hacia +Z ──
  const skinned = nodes.filter((n) => n.skin !== undefined && n.mesh !== undefined);
  if (skinned.length) {
    let minY = Infinity;
    let maxY = -Infinity; // altura del cuerpo: hasta la piel más alta (el cráneo), sin el volumen del pelo
    for (const body of skinned) {
      for (const p of j.meshes[body.mesh].primitives) {
        const a = j.accessors[p.attributes.POSITION];
        const mat = j.materials?.[p.material]?.name;
        minY = Math.min(minY, a.min[1]);
        if (mat === "skin") maxY = Math.max(maxY, a.max[1]);
        if (mat === "eyes") stats.eyesZ = Math.round(((a.min[2] + a.max[2]) / 2) * 1000) / 1000;
      }
    }
    stats.height = Math.round((maxY - minY) * 1000) / 1000;
    const h = HEIGHTS[opts.character];
    if (Math.abs(minY) > 0.02) errors.push(`los pies no están en el suelo (min Y = ${minY.toFixed(3)})`);
    if (h && Math.abs(stats.height - h) > 0.03) errors.push(`altura ${stats.height} m (esperada ${h})`);
    if (stats.eyesZ !== undefined && stats.eyesZ <= 0) errors.push("el personaje no mira a +Z");
  } else errors.push("no hay malla con piel");

  // ── Clips ──
  const secs = new Map(opts.exercises.map((e) => [e.id, e.secPerRep > 0 ? e.secPerRep : 2]));
  const anims = j.animations || [];
  const names = anims.map((a) => a.name);
  stats.clips = names.length;
  if (new Set(names).size !== names.length) errors.push("hay clips con nombre repetido");
  if (!names.includes("idle")) errors.push('falta el clip "idle"');
  const missing = [...secs.keys()].filter((id) => !names.includes(id));
  stats.missingClips = missing;
  if (missing.length) (opts.requireAll ? errors : warnings).push(`faltan ${missing.length} clips: ${missing.join(", ")}`);
  const bellNodes = ["Kettlebell", "Kettlebell2"].map((n) => byName.get(n));
  for (const a of anims) {
    if (a.name !== "idle" && !secs.has(a.name)) {
      errors.push(`clip "${a.name}" no es un ExerciseId`);
      continue;
    }
    let dur = 0;
    for (const ch of a.channels) {
      const s = a.samplers[ch.sampler];
      const times = readFloats(gltf, s.input);
      const vals = readFloats(gltf, s.output);
      dur = Math.max(dur, times[times.length - 1][0]);
      if (s.interpolation === "CUBICSPLINE") continue;
      const first = vals[0];
      const last = vals[vals.length - 1];
      const ok = ch.target.path === "rotation" ? same(first, last, 2e-3) || same(first, last.map((v) => -v), 2e-3) : same(first, last, 2e-3);
      if (!ok) errors.push(`${a.name}: ${nodes[ch.target.node]?.name}.${ch.target.path} no cierra el bucle`);
      if (times[0][0] > 1e-4) errors.push(`${a.name}: el clip no empieza en 0`);
    }
    if (a.name === "idle") {
      if (dur < IDLE_SEC[0] || dur > IDLE_SEC[1]) errors.push(`idle dura ${dur.toFixed(2)} s`);
    } else if (Math.abs(dur - secs.get(a.name)) > 0.5 / FPS) {
      errors.push(`${a.name} dura ${dur.toFixed(3)} s y debe durar ${secs.get(a.name)} s`);
    }
    for (const bn of bellNodes) {
      if (bn === undefined) continue;
      const paths = new Set(a.channels.filter((c) => c.target.node === bn).map((c) => c.target.path));
      for (const p of ["translation", "rotation", "scale"]) if (!paths.has(p)) errors.push(`${a.name}: ${nodes[bn].name} sin canal ${p} horneado`);
    }
    if (a.channels.some((c) => nodes[c.target.node]?.name === "Rig")) errors.push(`${a.name}: el nodo Rig no debe moverse (sin movimiento de raíz)`);
  }

  // ── Tamaño ──
  stats.bytes = buf.length;
  stats.gzipBytes = gzipSync(buf, { level: 9 }).length;
  if (buf.length > L.bytes) errors.push(`${(buf.length / 1024).toFixed(0)} KB sin comprimir (> ${(L.bytes / 1048576).toFixed(1)} MB)`);
  if (stats.gzipBytes > L.gzipBytes) warnings.push(`${(stats.gzipBytes / 1024).toFixed(0)} KB con gzip (objetivo ≤ ${(L.gzipBytes / 1024).toFixed(0)} KB)`);
  return { errors, warnings, stats };
}

async function main() {
  const { registerHooks } = await import("node:module");
  const { existsSync, readdirSync, readFileSync } = await import("node:fs");
  const { basename, dirname, resolve } = await import("node:path");
  const { fileURLToPath, pathToFileURL } = await import("node:url");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  // exercises.ts es TypeScript con imports sin extensión: Node 24 quita los tipos; este hook añade ".ts".
  registerHooks({
    resolve(spec, ctx, next) {
      if ((spec.startsWith("./") || spec.startsWith("../")) && !/\.[cm]?[jt]s$/.test(spec)) {
        const f = resolve(dirname(fileURLToPath(ctx.parentURL)), spec) + ".ts";
        if (existsSync(f)) return next(pathToFileURL(f).href, ctx);
      }
      return next(spec, ctx);
    },
  });
  const { EXERCISES } = await import(pathToFileURL(resolve(root, "src/lib/engine/exercises.ts")).href);
  const exercises = Object.values(EXERCISES).map((e) => ({ id: e.id, secPerRep: e.secPerRep }));
  const args = process.argv.slice(2);
  const requireAll = args.includes("--require-all");
  let files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) {
    const dir = resolve(root, "public/models");
    files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".glb")).map((f) => resolve(dir, f)) : [];
  }
  if (!files.length) {
    console.log("validate-glb: no hay GLB que validar");
    return;
  }
  let failed = false;
  for (const f of files) {
    const character = basename(f, ".glb");
    const r = validateGlb(readFileSync(f), { exercises, character, requireAll });
    const s = r.stats;
    console.log(`\n${f}`);
    console.log(`  ${s.triangles} triángulos · ${s.bones} huesos · ${s.clips} clips · ${(s.bytes / 1024).toFixed(0)} KB (${(s.gzipBytes / 1024).toFixed(0)} KB gzip) · altura ${s.height} m · texturas ${s.textures}`);
    for (const w of r.warnings) console.log(`  aviso: ${w}`);
    for (const e of r.errors) console.log(`  ERROR: ${e}`);
    if (r.errors.length) failed = true;
    else console.log("  OK");
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) await main();
