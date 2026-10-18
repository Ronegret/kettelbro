// Compacta docs/research/evidence.json en src/content/evidence.json (solo lo que la app muestra).
// Uso: node scripts/build-evidence.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync(new URL("../docs/research/evidence.json", import.meta.url), "utf8"));
const short = (authors) => {
  const first = String(authors).split(/[;,]/)[0]?.trim() ?? authors;
  const more = String(authors).split(";").length > 1 || String(authors).split(",").length > 3;
  return more ? `${first} et al.` : String(authors);
};
const out = src
  .filter((e) => e.verified)
  .map((e) => ({
    id: e.id,
    authors: short(e.authors),
    year: e.year,
    title: e.title,
    journal: e.journal,
    url: e.url,
    design: e.design,
    n: e.n,
    findingEs: e.findingEs,
  }));
writeFileSync(new URL("../src/content/evidence.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(`evidence.json: ${out.length} entradas`);
