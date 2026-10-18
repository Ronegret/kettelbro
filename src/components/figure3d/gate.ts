/**
 * Puerta de entrada al 3D, SIN three: decide si merece la pena descargar el visor. Si no hay WebGL2,
 * el dispositivo pide ahorro de datos, o el visor ya se rindió (pérdidas de contexto), el 3D ni se pide.
 */

/** Lo activa el motor cuando agota los reintentos de contexto: el resto de la página ya no lo intenta. */
export const gate = { dead: false };

let probed: boolean | undefined;

/** Sonda de WebGL2 (three 0.186 ya no usa WebGL1). Una sola vez por página; el contexto de prueba se libera al instante. */
function hasWebGL2(): boolean {
  if (probed !== undefined) return probed;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    probed = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    probed = false;
  }
  return probed;
}

export function canUse3D(): boolean {
  if (gate.dead || typeof document === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return false;
  return hasWebGL2();
}
