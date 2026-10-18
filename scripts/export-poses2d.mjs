#!/usr/bin/env node
/**
 * Exporta las poses 2D/3D de las figuras (src/components/figure) a JSON para Blender.
 *
 * Usa directamente rig.ts (solveRig) y poses.ts (ANIMATIONS): el TypeScript se ejecuta con el
 * "type stripping" de Node 24, y un hook resuelve los imports sin extensión ("./skeleton") y el alias "@/".
 *
 * Salida: art/personajes/poses2d.json, en unidades del lienzo 2D (x = adelante, y = ABAJO, z = lado
 * derecho del cuerpo). Blender (tools/blender/common.py) los pasa a metros con la escala del personaje.
 * Un fotograma por cada 1/30 s de una repetición; el último fotograma es igual al primero (bucle).
 *
 * Uso: node scripts/export-poses2d.mjs [--ids idle,two-hand-swing,...]
 */
import { registerHooks } from "node:module";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");

registerHooks({
  resolve(specifier, context, next) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = pathToFileURL(resolve(SRC, spec.slice(2))).href;
    const relative = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:");
    if (relative && !/\.[cm]?[jt]sx?$/.test(spec)) {
      const base = spec.startsWith("file:") ? fileURLToPath(spec) : resolve(dirname(fileURLToPath(context.parentURL)), spec);
      if (existsSync(base + ".ts")) return next(pathToFileURL(base + ".ts").href, context);
    }
    return next(spec, context);
  },
});

const FPS = 30;
const { solveRig, CHAR_DIMS } = await import(pathToFileURL(resolve(SRC, "components/figure/rig.ts")).href);
const { samplePhase } = await import(pathToFileURL(resolve(SRC, "components/figure/skeleton.ts")).href);
const { ANIMATIONS, P } = await import(pathToFileURL(resolve(SRC, "components/figure/poses.ts")).href);
const { EXERCISES } = await import(pathToFileURL(resolve(SRC, "lib/engine/exercises.ts")).href);

// Reposo: de pie, brazos sueltos al costado; respiración = el pecho sube y los brazos se separan un poco.
const IDLE = {
  cycleSec: 4,
  loop: "pingpong",
  still: 0,
  ease: "sine",
  keys: [
    { t: 0, pose: P({ ankle: [80, 0], torso: 0, neck: 0, arm: [184, 168], arm2: [184, 168], stance: 9, toeOut: 12, hz: 18.5, hz2: 18.5, elOut: 10, elOut2: 10 }) },
    { t: 1, pose: P({ ankle: [80, 0], torso: -1.5, neck: -1, arm: [182, 165], arm2: [182, 165], stance: 9, toeOut: 12, hz: 19.2, hz2: 19.2, elOut: 12, elOut2: 12 }) },
  ],
};
const IDLE_SEC = 4;

// Variantes 3D (corrección técnica) donde la pose 2D no sirve para el cuerpo 3D. Se escriben con el mismo P()
// de poses.ts. Anotadas en docs/PERSONAJES-3D-NOTAS.md por si la 2D quiere adoptarlas.
const HINGE = { stance: 12, toeOut: 14, kneeOut: 10 };
const BELL2 = { at: "both", ang: 180 };
const POSES_3D = {
  // Molino: bisagra en el plano de los pies girados (animate.py gira todo el cuerpo 45° con OVERRIDES.yaw) y el pecho
  // se abre hacia la pesa girando sobre la columna (roll), no sobre la vertical (twist retorcía el cuello en 3D).
  windmill: {
    cycleSec: 4.2,
    loop: "pingpong",
    still: 1,
    keys: [
      { t: 0, pose: P({ ankle: [84, 0], torso: -1, neck: 4, arm: [0, 0], arm2: [180, 180], front2: true, bell: { at: "hand", ang: 212, bar: 30 }, stance: 8, stance2: 12, toeOut: 12, hz: 13, hz2: 15 }) },
      { t: 1, pose: P({ ankle: [84, 0], hip: [63, 57], torso: 78, neck: 70, gaze: 140, arm: [0, 0], hand2: [96, 12], elbow2: 1, front2: true, bell: { at: "hand", ang: 212, bar: 30 }, stance: 8, stance2: 12, toeOut: 12, kneeOut: 6, hz: 13, hz2: 9, roll: 62, headYaw: 38 }) },
    ],
  },
  // Cuello neutro, en línea con el tronco (espalda larga): la 2D levanta la cabeza para mirar al frente.
  "single-leg-rdl": {
    cycleSec: 3.6,
    loop: "pingpong",
    still: 1,
    keys: [
      { t: 0, pose: P({ ankle: [80, 0], hip: [80, 66], torso: 0, hand: [90, 62], bell: { at: "hand", ang: 180, bar: 0 }, stance: 6, stance2: 7, hz: 11 }) },
      { t: 1, pose: P({ ankle: [84, 0], hip: [74, 64], knee: 1, ankle2: [9, 53], foot2: 160, torso: 82, neck: 80, gaze: 160, arm: [180, 180], arm2: [176, 170], bell: { at: "hand", ang: 180, bar: 0 }, stance: 6, stance2: 7, hz: 11, hz2: 16 }) },
    ],
  },
  // La 2D baja la cadera casi a sentadilla (rodilla a ~90°) porque sus brazos son cortos y su pesa grande. En 3D:
  // cadera atrás y arriba, espinillas casi verticales (~11°), tronco a 60° con la espalda larga, brazos colgando
  // rectos bajo los hombros y la pesa entre los pies, a ~5 cm del suelo abajo.
  "kettlebell-deadlift": {
    cycleSec: 3.2,
    loop: "pingpong",
    still: 1,
    keys: [
      { t: 0, pose: P({ ankle: [76, 0], hip: [76, 66], torso: 0, arm: [166, 166], bell: BELL2, ...HINGE }) },
      { t: 1, pose: P({ ankle: [76, 0], hip: [52, 47], torso: 60, arm: [180, 180], bell: BELL2, ...HINGE }) },
    ],
  },
};

// 0,1 unidades del lienzo = 1,3 mm; las direcciones con 3 decimales (< 0,1°). Basta y el JSON pesa la mitad.
const r2 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 1000) / 1000;
const P3 = (p) => [r2(p.x), r2(p.y), r2(p.z)];
const D3 = (p) => [r4(p.x), r4(p.y), r4(p.z)];

function frameOf(rig, pose) {
  return {
    pelvis: P3(rig.pelvis),
    chest: P3(rig.chest),
    head: P3(rig.head),
    up: D3(rig.up),
    fwd: D3(rig.fwd),
    lat: D3(rig.lat),
    twist: r2(rig.twist),
    hip: rig.hip.map(P3),
    knee: rig.knee.map(P3),
    ankle: rig.ankle.map(P3),
    heel: rig.heel.map(P3),
    toe: rig.toe.map(P3),
    footUp: rig.footUp.map(D3),
    sh: rig.sh.map(P3),
    elbow: rig.elbow.map(P3),
    hand: rig.hand.map(P3),
    grip: rig.grip,
    hF: D3(rig.hF),
    hU: D3(rig.hU),
    hL: D3(rig.hL),
    handFix: [r4(pose.lat.handFix), r4(pose.lat.handFix2)],
    // La 2D no define el brazo libre en los ejercicios a una mano y resolvePose copia el que trabaja (de lado no se
    // ve). En 3D ese brazo cuelga relajado: animate.py lo sustituye cuando free2 es true.
    free2: pose.bell.at === "hand" && Math.abs(pose.upperArm2 - pose.upperArm) < 1e-6 && Math.abs(pose.foreArm2 - pose.foreArm) < 1e-6,
    bellAt: pose.bell.at,
    bells: rig.bells.map((b) => ({ grip: P3(b.grip), dir: D3(b.dir), bar: D3(b.bar), hang: r2(b.hang), size: r4(b.size) })),
  };
}

function clipOf(anim, sec, dims) {
  const n = Math.max(2, Math.round(sec * FPS));
  const frames = [];
  for (let i = 0; i <= n; i++) {
    const pose = samplePhase(anim, i / n); // i = n da la fase 1 = fase 0: bucle exacto
    frames.push(frameOf(solveRig(pose, dims), pose));
  }
  // travel: unidades del lienzo que corre el suelo en un ciclo (acarreos en cinta: el visor puede desplazar el suelo).
  return { sec: n / FPS, travel: anim.travel ?? 0, frames };
}

const args = process.argv.slice(2);
const idsArg = args.includes("--ids") ? args[args.indexOf("--ids") + 1] : "";
const wanted = idsArg ? new Set(idsArg.split(",")) : null;

const clips = { idle: { anim: IDLE, sec: IDLE_SEC } };
for (const [id, anim] of Object.entries(ANIMATIONS)) {
  const ex = EXERCISES[id];
  if (!ex) throw new Error(`Sin ejercicio para la animación ${id}`);
  clips[id] = { anim: POSES_3D[id] ?? anim, sec: ex.secPerRep > 0 ? ex.secPerRep : 2 };
}
for (const id of Object.keys(EXERCISES)) if (!clips[id]) throw new Error(`Falta animación 2D para ${id}`);

const out = { fps: FPS, units: "canvas2d", groundY: 170, characters: {} };
for (const ch of ["bro", "princess"]) {
  const dims = CHAR_DIMS[ch];
  const byClip = {};
  for (const [id, c] of Object.entries(clips)) {
    if (wanted && !wanted.has(id)) continue;
    byClip[id] = clipOf(c.anim, c.sec, dims);
  }
  out.characters[ch] = { dims, clips: byClip };
}

const file = resolve(ROOT, "art/personajes/poses2d.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out));
const nClips = Object.keys(out.characters.bro.clips).length;
console.log(`poses2d: ${nClips} clips x 2 personajes -> ${file}`);
