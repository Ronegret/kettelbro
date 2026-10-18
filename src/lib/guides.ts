import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/**
 * Guías públicas: archivos Markdown de docs/SEO-GUIAS con cabecera (title, description, slug, date...).
 * Solo se usa en el servidor, al construir las páginas (nunca se importa desde componentes de cliente).
 * El contenido es propio del repositorio (de confianza): el HTML que genera marked no se sanea.
 */
const DIR = join(process.cwd(), "docs", "SEO-GUIAS");

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Fecha de publicación YYYY-MM-DD y, si existe, de la última actualización. */
  date: string;
  updated?: string;
  illustrations: string[];
  html: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

marked.use({
  renderer: {
    // Los enlaces externos (estudios) se abren aparte y sin dar pistas al sitio de destino.
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:/.test(href);
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    },
  },
});

/** Cabecera `clave: valor` con valores JSON (texto entre comillas o lista). */
function parseFrontmatter(src: string): { meta: Record<string, unknown>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { meta: {}, body: src };
  const meta: Record<string, unknown> = {};
  for (const line of (m[1] ?? "").split(/\r?\n/)) {
    const kv = /^([A-Za-z]\w*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    try {
      meta[kv[1] as string] = JSON.parse(kv[2] as string);
    } catch {
      meta[kv[1] as string] = kv[2];
    }
  }
  return { meta, body: src.slice(m[0].length) };
}

function load(file: string): Guide {
  const { meta, body } = parseFrontmatter(readFileSync(join(DIR, file), "utf8"));
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : "");
  const html = (marked.parse(body, { async: false }) as string).replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>");
  return {
    slug: str("slug") || file.replace(/\.md$/, ""),
    title: str("title"),
    description: str("description"),
    date: str("date"),
    ...(str("updated") ? { updated: str("updated") } : {}),
    illustrations: Array.isArray(meta.illustrations) ? (meta.illustrations as string[]) : [],
    html,
  };
}

/** Todas las guías, de la más reciente a la más antigua. */
export function getAllGuides(): Guide[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map(load)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function getGuide(slug: string): Guide | undefined {
  return getAllGuides().find((g) => g.slug === slug);
}
