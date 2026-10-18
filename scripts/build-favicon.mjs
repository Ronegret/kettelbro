// Genera src/app/favicon.ico (16, 32 y 48 px) desde las rutas /icon/16, /icon/32 y /icon/48 de un servidor en marcha.
// Uso:  npm run dev   (en otra terminal)   y luego   node scripts/build-favicon.mjs [http://localhost:3000]
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const sizes = [16, 32, 48];

const pngs = [];
for (const s of sizes) {
  const res = await fetch(`${base}/icon/${s}`);
  if (!res.ok) throw new Error(`No se pudo leer ${base}/icon/${s}: ${res.status}`);
  pngs.push(Buffer.from(await res.arrayBuffer()));
}

// Contenedor ICO con imágenes PNG (lo soportan todos los navegadores y Windows desde Vista).
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reservado
header.writeUInt16LE(1, 2); // tipo: ícono
header.writeUInt16LE(sizes.length, 4);

let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); // ancho
  e.writeUInt8(s, 1); // alto
  e.writeUInt8(0, 2); // colores en paleta
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); // planos
  e.writeUInt16LE(32, 6); // bits por píxel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});

const out = new URL("../src/app/favicon.ico", import.meta.url);
writeFileSync(out, Buffer.concat([header, ...entries, ...pngs]));
console.log(`favicon.ico escrito (${sizes.join(", ")} px, ${offset} bytes)`);
