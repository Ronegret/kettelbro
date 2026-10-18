/** Tipos de scripts/validate-glb.mjs (lo importa src/lib/__tests__/models.test.ts). */
export interface GlbStats {
  bones?: number;
  triangles?: number;
  textures?: number;
  height?: number;
  eyesZ?: number;
  clips?: number;
  missingClips?: string[];
  bytes?: number;
  gzipBytes?: number;
}

export interface GlbReport {
  errors: string[];
  warnings: string[];
  stats: GlbStats;
}

export declare const REQUIRED_BONES: string[];
export declare const REQUIRED_MATERIALS: string[];
export declare const LIMITS: { triangles: number; bones: number; bytes: number; gzipBytes: number; textures: number; textureSize: number };

export declare function validateGlb(
  buf: Uint8Array,
  opts: { exercises: { id: string; secPerRep: number }[]; character?: string; requireAll?: boolean },
): GlbReport;
