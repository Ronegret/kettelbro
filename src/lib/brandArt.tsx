import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Arte de marca para las imágenes que genera Next en build (íconos, portada para redes).
 * Está dibujado con SVG/JSX simple (lo que Satori/ImageResponse entiende) y colores en hex.
 * Misma mascota y paleta que la app: la tarjeta del día con "El Bro".
 */
export const BRAND = {
  night: "#0b0e14",
  night2: "#121722",
  paper: "#f4f6fa",
  vermilion: "#f2432d",
  vermilionDeep: "#8f1d10",
  cobalt: "#2a4de8",
  jade: "#00a878",
  marigold: "#ffb41f",
  rose: "#ff5fa2",
} as const;

/** Fuentes de marca para ImageResponse (archivos .woff de @fontsource: Satori no lee woff2). */
export async function brandFonts() {
  const root = path.join(process.cwd(), "node_modules", "@fontsource");
  const [display, body] = await Promise.all([
    readFile(path.join(root, "barlow-condensed", "files", "barlow-condensed-latin-800-italic.woff")),
    readFile(path.join(root, "barlow", "files", "barlow-latin-600-normal.woff")),
  ]);
  return [
    { name: "Barlow Condensed", data: display, weight: 800 as const, style: "italic" as const },
    { name: "Barlow", data: body, weight: 600 as const, style: "normal" as const },
  ];
}

/** El Bro de frente: cuerpo de papel, rasgos en noche. Legible desde 48 px hasta una portada de 1200 px. */
export function BroFace({ size, bodyColor = BRAND.paper, accent = BRAND.vermilion, detail = BRAND.vermilionDeep }: { size: number; bodyColor?: string; accent?: string; detail?: string }) {
  const n = BRAND.night;
  return (
    <svg width={size} height={(size * 124) / 120} viewBox="0 0 120 124">
      <ellipse cx="60" cy="116" rx="34" ry="5" fill={n} opacity="0.3" />
      <path d="M36 52C32 22 88 22 84 52" fill="none" stroke={n} strokeWidth="19" strokeLinecap="round" />
      <path d="M36 52C32 22 88 22 84 52" fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round" />
      <circle cx="65" cy="81" r="35" fill={detail} />
      <circle cx="60" cy="76" r="35" fill={bodyColor} stroke={n} strokeWidth="5.5" />
      <path d="M35 64a27 27 0 0 1 18-21" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      <path d="M35 63l17 6M85 63l-17 6" stroke={n} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="46" cy="77" rx="7.5" ry="9" fill={n} />
      <ellipse cx="74" cy="77" rx="7.5" ry="9" fill={n} />
      <circle cx="48.5" cy="73.5" r="2.6" fill={BRAND.paper} />
      <circle cx="76.5" cy="73.5" r="2.6" fill={BRAND.paper} />
      <path d="M44 93q16 17 32 0Z" fill={n} stroke={n} strokeWidth="4" strokeLinejoin="round" />
      <path d="M51 99q9 6 18 0q-9-3-18 0Z" fill={BRAND.rose} />
    </svg>
  );
}

/** Solo la silueta de la pesa: para el favicon de 16-48 px, donde la cara no se distingue. */
export function BellMark({ size }: { size: number }) {
  const n = BRAND.night;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M30 44C25 8 75 8 70 44" fill="none" stroke={n} strokeWidth="16" strokeLinecap="round" />
      <path d="M30 44C25 8 75 8 70 44" fill="none" stroke={BRAND.paper} strokeWidth="6" strokeLinecap="round" />
      <circle cx="53" cy="67" r="30" fill={BRAND.vermilionDeep} />
      <circle cx="50" cy="64" r="30" fill={BRAND.paper} stroke={n} strokeWidth="7" />
    </svg>
  );
}

/**
 * Ícono de la app. `variant`:
 *  - "any": carta inclinada sobre noche (la forma que ven la mayoría de dispositivos).
 *  - "maskable": mismo arte reducido al 80 % central, con fondo a sangre, para máscaras circulares/squircle de Android.
 *  - "mark": solo la pesa sobre bermellón, para favicons pequeños.
 */
export function IconArt({ size, variant }: { size: number; variant: "any" | "maskable" | "mark" }) {
  if (variant === "mark") {
    return (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.vermilion }}>
        <BellMark size={Math.round(size * 0.86)} />
      </div>
    );
  }
  const scale = variant === "maskable" ? 0.78 : 1;
  const cw = Math.round(size * 0.66 * scale);
  const ch = Math.round(cw * 1.38);
  const pad = Math.max(3, Math.round(cw * 0.06));
  const iw = cw - pad * 2;
  const ih = ch - pad * 2;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.night }}>
      <div
        style={{
          width: cw,
          height: ch,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.paper,
          borderRadius: Math.round(cw * 0.14),
          transform: "rotate(-6deg)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: iw,
            height: ih,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: BRAND.vermilion,
            borderRadius: Math.round(cw * 0.09),
          }}
        >
          <Rays width={iw} height={ih} />
          <div style={{ display: "flex", marginTop: Math.round(ih * 0.03) }}>
            <BroFace size={Math.round(iw * 1.12)} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Franjas de velocidad de la tarjeta (formas planas, como en la app). */
export function Rays({ width, height, color = BRAND.vermilionDeep, opacity = 0.34 }: { width: number; height: number; color?: string; opacity?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 100 138" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", left: 0, top: 0 }}>
      <g fill={color} opacity={opacity}>
        <polygon points="-12,102 42,-8 66,-8 12,102" />
        <polygon points="38,150 100,28 118,28 56,150" />
      </g>
    </svg>
  );
}
