import { describe, expect, it } from "vitest";
import { CHARACTER_KEY, figViewKey, isCharacterId, modelUrl, parseView } from "../types";

describe("types del 3D", () => {
  it("parseView acepta nombres, el alias angle y grados (también como texto guardado)", () => {
    expect(parseView("side")).toBe("side");
    expect(parseView("angle")).toBe("angle");
    expect(parseView("auto")).toBe("auto");
    expect(parseView("135")).toBe(135);
    expect(parseView("-90")).toBe(-90);
    expect(parseView(45)).toBe(45);
  });
  it("parseView descarta lo que no es una vista", () => {
    for (const v of ["", " ", "izquierda", null, undefined, NaN, {}]) expect(parseView(v)).toBeNull();
  });
  it("claves de localStorage y URL del modelo (con versión)", () => {
    expect(CHARACTER_KEY).toBe("kb:character");
    expect(figViewKey("goblet-squat")).toBe("kb:fig-view:goblet-squat");
    expect(modelUrl("bro")).toMatch(/^\/models\/bro\.glb\?v=\S+$/);
    expect(isCharacterId("princess") && !isCharacterId("otra")).toBe(true);
  });
});
