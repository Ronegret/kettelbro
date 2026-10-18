#!/usr/bin/env node
/**
 * Orquesta el pipeline de personajes (lo llaman los scripts npm characters:build y characters:preview).
 *
 *   node tools/blender/run.mjs build   [--id bro] [--clips idle,two-hand-swing]
 *   node tools/blender/run.mjs preview [--id bro] [--clips ...]
 *
 * build:   poses 2D -> build_character -> animate -> validate (Blender) -> export_glb -> validate-glb (Node)
 * preview: hojas de contacto en art/previews/
 * Blender: variable BLENDER_EXE o la ruta de instalación por defecto.
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const BLENDER = process.env.BLENDER_EXE || "C:/Users/rodri/tools/blender/blender-5.2.2-windows-x64/blender.exe";

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name, def) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : def);
const ids = opt("id", "bro").split(",");
const clips = opt("clips", null);

function run(bin, args) {
  console.log(`\n> ${[bin, ...args].join(" ")}`);
  const r = spawnSync(bin, args, { stdio: "inherit", cwd: ROOT });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const node = (script, args = []) => run(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", resolve(ROOT, script), ...args]);
const blender = (script, args) =>
  run(BLENDER, ["--background", "--factory-startup", "--python-exit-code", "1", "--python", resolve(HERE, script), "--", ...args]);

if (cmd === "build") {
  node("scripts/export-poses2d.mjs");
  for (const id of ids) {
    const extra = clips ? ["--clips", clips] : [];
    blender("build_character.py", ["--id", id]);
    blender("animate.py", ["--id", id, ...extra]);
    blender("validate.py", ["--id", id]);
    blender("export_glb.py", ["--id", id]);
  }
  node("scripts/validate-glb.mjs", ids.map((id) => resolve(ROOT, "public/models", `${id}.glb`)));
} else if (cmd === "preview") {
  for (const id of ids) {
    blender("render_preview.py", ["--id", id, "--rest"]);
    blender("render_preview.py", ["--id", id, ...(clips ? ["--clips", clips] : [])]);
  }
} else {
  console.error("Uso: node tools/blender/run.mjs <build|preview> [--id bro] [--clips a,b]");
  process.exit(2);
}
