/**
 * Aspecto de cómic del visor: materiales toon por nombre, contorno por casco invertido y borde tintado.
 * Todo lo ajustable vive en LOOK. Los colores de ropa salen del GLB (no se tiñen con la tinta del día).
 */

import {
  BackSide,
  Color,
  DataTexture,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  UnsignedByteType,
  type Material,
  type Texture,
} from "three";

export const LOOK = {
  /**
   * Brillo final de cada escalón del sombreado (multiplica el color base; de sombra a luz). 3-4 escalones = lectura de cómic.
   * El primero lo da la luz ambiente, el último ambiente + luz principal; el mapa de gradiente reparte los intermedios.
   */
  tones: [0.55, 0.8, 1.0] as readonly number[],
  /** Borde tintado: mezcla (0..1) con el color de borde y umbral de (1 - N·V) a partir del cual aparece. */
  rim: 0.4,
  rimEdge: 0.66,
  /** Grosor del contorno en píxeles CSS (se convierte a metros según el encuadre). */
  outlinePx: 2.3,
  /** Materiales sin contorno (detalles pequeños que se ensuciarían). */
  outlineSkip: ["eyes", "eyewhite", "mouth", "blush", "tattoo"] as readonly string[],
  /** Sin luz (planos): rasgos pequeños que deben leerse siempre igual. */
  flat: ["eyes", "eyewhite", "mouth", "blush", "tattoo"] as readonly string[],
  /** Multiplicador del color base por material (aclara lo que sale muy oscuro sobre campos de color). */
  lift: {} as Record<string, number>,
  /** Colores propios por personaje y material (los personajes realistas traen los suyos en el GLB: pesa negra sobre Bro, perla sobre Princess). */
  override: {
    bro: {},
    princess: {},
  } as Record<string, Record<string, string>>,
  /** Luces de estudio de los personajes realistas (π = el color base completo): ambiente, principal, relleno y contraluz. */
  studio: { ambient: 0.62, key: 0.78, fill: 0.22, rim: 0.5 },
  /** La pesa se dibuja algo más grande de lo real: es lo que hay que ver. */
  bellScale: 1.2,
  /** Recorrido de la pesa: radio del punto (m) y de su borde oscuro. */
  trailDot: 0.0135,
  trailRing: 0.021,
  /** Suelo: radio mínimo (m) y opacidad del disco. */
  groundRadius: 0.42,
  groundAlpha: 0.55,
};

/** Uniformes compartidos por TODOS los materiales: se asignan justo antes de cada dibujo (cada vista pone los suyos). */
export const U = {
  uRim: { value: new Color("#ff7a62") },
  uRimK: { value: LOOK.rim },
  uRimE: { value: LOOK.rimEdge },
  uThick: { value: 0.01 },
};

/** Luces y escalones derivados de LOOK.tones. */
export function lighting(): { ambient: number; key: number; steps: number[] } {
  const lo = LOOK.tones[0] as number;
  const key = (LOOK.tones[LOOK.tones.length - 1] as number) - lo;
  return { ambient: lo, key, steps: LOOK.tones.map((t) => (t - lo) / key) };
}

export function makeGradient(): Texture {
  const steps = lighting().steps;
  const t = new DataTexture(new Uint8Array(steps.map((v) => Math.round(v * 255))), steps.length, 1, RedFormat, UnsignedByteType);
  t.minFilter = t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Toon con borde tintado duro (mezcla hacia el color de borde donde la superficie rasa la vista); planos para los rasgos pequeños. */
export function makeToon(src: Material, gradientMap: Texture): Material {
  const base = (src as MeshToonMaterial).color ?? new Color("#888888");
  const color = base.clone().multiplyScalar(LOOK.lift[src.name] ?? 1);
  if (LOOK.flat.includes(src.name)) return new MeshBasicMaterial({ color, name: src.name });
  const m = new MeshToonMaterial({ color, gradientMap, name: src.name });
  m.onBeforeCompile = (s) => {
    s.uniforms.uRim = U.uRim;
    s.uniforms.uRimK = U.uRimK;
    s.uniforms.uRimE = U.uRimE;
    s.fragmentShader = s.fragmentShader
      .replace("void main() {", "uniform vec3 uRim;\nuniform float uRimK;\nuniform float uRimE;\nvoid main() {")
      .replace(
        "#include <opaque_fragment>",
        "float rimF = smoothstep(uRimE - 0.05, uRimE + 0.05, 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0));\noutgoingLight = mix(outgoingLight, uRim, rimF * uRimK);\n#include <opaque_fragment>",
      );
  };
  m.customProgramCacheKey = () => "kb-toon";
  return m;
}

/** Casco invertido: la misma malla (con piel) inflada a lo largo de la normal y pintada por detrás en un color liso. */
export function makeOutline(color: string): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ color, side: BackSide, fog: false });
  m.onBeforeCompile = (s) => {
    s.uniforms.uThick = U.uThick;
    s.vertexShader = s.vertexShader
      .replace("void main() {", "uniform float uThick;\nvoid main() {")
      .replace(
        "#include <skinning_vertex>",
        "#include <skinning_vertex>\n#ifdef USE_SKINNING\n transformed += normalize(objectNormal) * uThick;\n#else\n transformed += normalize(normal) * uThick;\n#endif",
      );
  };
  m.customProgramCacheKey = () => "kb-outline";
  return m;
}
