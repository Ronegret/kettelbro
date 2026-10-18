import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXERCISES } from "../engine/exercises";
import { validateGlb } from "../../../scripts/validate-glb.mjs";

// Modelos 3D de los personajes (docs/PERSONAJES-3D-CONTRATO.md). Si el GLB aún no existe, se salta.
const exercises = Object.values(EXERCISES).map((e) => ({ id: e.id, secPerRep: e.secPerRep }));
const fileOf = (id: string) => fileURLToPath(new URL(`../../../public/models/${id}.glb`, import.meta.url));

for (const character of ["bro", "princess"]) {
  const file = fileOf(character);
  describe.skipIf(!existsSync(file))(`modelo 3D "${character}"`, () => {
    const buf = existsSync(file) ? readFileSync(file) : Buffer.alloc(0);

    it("cumple el contrato (huesos, materiales, clips, bucles, pesas, presupuestos)", () => {
      const r = validateGlb(buf, { exercises, character });
      expect(r.errors).toEqual([]);
      expect(r.stats.triangles).toBeLessThanOrEqual(60000); // personajes realistas de MakeHuman (los de cómic tenían 14000)
      expect(r.stats.bones).toBeLessThanOrEqual(65);
    });

    it("el validador detecta un hueso renombrado", () => {
      const broken = Buffer.from(buf);
      const at = broken.indexOf('"name":"Hips"');
      expect(at).toBeGreaterThan(0);
      broken.write('"name":"Hipz"', at);
      expect(validateGlb(broken, { exercises, character }).errors).toContain("falta el hueso Hips");
    });
  });
}
