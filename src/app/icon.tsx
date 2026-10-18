import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/brandArt";

/**
 * Íconos de la app, generados en build desde un solo dibujo (src/lib/brandArt.tsx).
 *  /icon/16 /icon/32 /icon/48  → favicon (solo la pesa, la cara no se distingue)
 *  /icon/192 /icon/512         → ícono estándar de la PWA
 *  /icon/maskable              → versión con zona segura para las máscaras de Android
 */
const SPECS = [
  { id: "16", size: 16, variant: "mark" },
  { id: "32", size: 32, variant: "mark" },
  { id: "48", size: 48, variant: "mark" },
  { id: "192", size: 192, variant: "any" },
  { id: "512", size: 512, variant: "any" },
  { id: "maskable", size: 512, variant: "maskable" },
] as const;

export function generateImageMetadata() {
  return SPECS.map((s) => ({ id: s.id, size: { width: s.size, height: s.size }, contentType: "image/png", alt: "kettellbro" }));
}

export default async function Icon({ id }: { id: Promise<string> | string }) {
  const key = await id;
  const spec = SPECS.find((s) => s.id === key) ?? SPECS[4];
  return new ImageResponse(<IconArt size={spec.size} variant={spec.variant} />, { width: spec.size, height: spec.size });
}
