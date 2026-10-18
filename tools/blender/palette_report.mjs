#!/usr/bin/env node
/**
 * Informe de contraste de la paleta de los personajes contra los fondos de las cartas.
 *
 *   node tools/blender/palette_report.mjs [hex ...]   # con hex sueltos: compara candidatos
 *
 * Dos medidas por par: contraste WCAG (luminancia) y ΔE2000 (diferencia de color percibida, incluye tono).
 * Criterio de lectura de una prenda sobre la carta: WCAG ≥ 3 o ΔE2000 ≥ 20 (con el contorno oscuro del visor).
 */
import { readFileSync } from "node:fs";

const spec = JSON.parse(readFileSync(new URL("./spec/characters.json", import.meta.url), "utf8"));
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rgb = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
const lum = (h) => {
  const [r, g, b] = rgb(h);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const wcag = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
function lab(h) {
  const [r, g, b] = rgb(h);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = xyz.map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}
/** CIEDE2000 (Sharma et al. 2005). */
export function de2000(h1, h2) {
  const [L1, a1, b1] = lab(h1);
  const [L2, a2, b2] = lab(h2);
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1p = hp(b1, ap1);
  const h2p = hp(b2, ap2);
  const dL = L2 - L1;
  const dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) dh = Math.abs(h2p - h1p) <= 180 ? h2p - h1p : h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p + 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2;
  const Cpm = (Cp1 + Cp2) / 2;
  let hm = h1p + h2p;
  if (Cp1 * Cp2 !== 0) hm = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2 : h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTh = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cpm;
  const Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

const cards = spec.fondosDeCarta;
const ok = (h, c) => wcag(h, c) >= 3 || de2000(h, c) >= 20;
function row(name, h) {
  const cells = Object.values(cards).map((c) => `${wcag(h, c).toFixed(2)} / ${de2000(h, c).toFixed(0)}${ok(h, c) ? "" : " ⚠"}`);
  return `| ${name} | ${h} | ${cells.join(" | ")} |`;
}
const head = `| Material | Hex | ${Object.entries(cards).map(([n, h]) => `${n} ${h}`).join(" | ")} |\n|---|---|${Object.keys(cards).map(() => "---").join("|")}|`;

const extra = process.argv.slice(2).filter((a) => a.startsWith("#"));
if (extra.length) {
  console.log(head);
  for (const h of extra) console.log(row("candidato", h));
} else {
  for (const [id, ch] of Object.entries(spec.characters)) {
    console.log(`\n**${id}** (WCAG / ΔE2000; ⚠ = WCAG < 3 y ΔE < 20)\n\n${head}`);
    for (const [m, h] of Object.entries(ch.palette)) if (!m.startsWith("_")) console.log(row(`\`${m}\``, h));
    const p = ch.palette;
    const pairs = [["skin", "top"], ["skin", "bottoms"], ["top", "bottoms"], ["skin", "hair"], ["skin", "tattoo"], ["skin", "earrings"]];
    console.log("\nInternos: " + pairs.map(([a, b]) => `${a}/${b} ${wcag(p[a], p[b]).toFixed(2)} (ΔE ${de2000(p[a], p[b]).toFixed(0)})`).join(" · "));
  }
  const b = spec.bell.palette;
  console.log(`\n${head}\n${row("`bell`", b.bell)}\n${row("`bellHandle`", b.bellHandle)}`);
}
