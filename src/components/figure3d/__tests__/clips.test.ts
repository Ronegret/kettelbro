import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIPS_3D } from "../clips";
import { CHARACTERS } from "../types";

/** Nombres de animación del JSON de un GLB (cabecera de 12 bytes + trozo JSON). */
function clipNames(file: string): string[] {
  const buf = readFileSync(file);
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8")) as { animations?: Array<{ name: string }> };
  return (json.animations ?? []).map((a) => a.name);
}

describe("ejercicios con clip 3D", () => {
  for (const c of CHARACTERS) {
    const file = join(process.cwd(), "public", "models", `${c}.glb`);
    it.skipIf(!existsSync(file))(`la lista de la app coincide con los clips de ${c}.glb`, () => {
      const real = new Set(clipNames(file).filter((n) => n !== "idle"));
      // La app solo debe usar el 3D donde el GLB tiene clip. Si el GLB gana clips, se añaden a CLIPS_3D a propósito.
      for (const id of CLIPS_3D) expect(real.has(id), `${c}: falta el clip ${id}`).toBe(true);
      expect([...real].sort()).toEqual([...CLIPS_3D].sort());
    });
  }
});
