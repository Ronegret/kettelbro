import raw from "@/content/landing.es.json";
import { getAllGuides } from "@/lib/guides";

/**
 * Contenido de la portada (src/content/landing.es.json). Aquí se filtra lo que NO debe publicarse todavía:
 * elementos marcados `pending` o con verificación pendiente, y enlaces a rutas que aún no existen.
 */

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  link?: { label: string; href: string };
  pending?: boolean;
  pendingVerification?: string;
}

export const landing = raw;

/** Rutas públicas que ya existen. Se amplía cuando se publica una página nueva (guías, términos...). */
export const LIVE_ROUTES: ReadonlySet<string> = new Set(["/ciencia", "/guias", ...getAllGuides().map((g) => `/guias/${g.slug}`)]);

export const isLive = (href: string): boolean => href.startsWith("#") || LIVE_ROUTES.has(href.split("#")[0] ?? href) || LIVE_ROUTES.has(href);

/** Preguntas frecuentes publicables: sin pendientes de decisión ni de verificación. */
export function liveFaq(): FaqItem[] {
  return (raw.faq.items as FaqItem[])
    .filter((i) => !i.pending && !i.pendingVerification)
    .map((i) => (i.link && !isLive(i.link.href) ? { ...i, link: undefined } : i));
}

export function liveFooterLinks() {
  return raw.legal.footerLinks.filter((l) => isLive(l.href));
}

/** Dirección pública del sitio (misma regla que el layout). */
export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://kettellbro.vercel.app");
