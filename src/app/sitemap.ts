import type { MetadataRoute } from "next";
import { getAllGuides } from "@/lib/guides";
import { SITE_URL, landing } from "@/lib/landing";

/**
 * Solo páginas públicas e indexables (ninguna ruta de la app). Se añaden aquí al publicarlas: guías, privacidad, términos.
 * `lastModified` es la fecha real de revisión del contenido, no la del build.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const reviewed = new Date(landing.meta.lastReviewed);
  return [
    { url: `${SITE_URL}/`, lastModified: reviewed },
    { url: `${SITE_URL}/ciencia`, lastModified: reviewed },
    { url: `${SITE_URL}/guias`, lastModified: reviewed },
    ...getAllGuides().map((g) => ({ url: `${SITE_URL}/guias/${g.slug}`, lastModified: new Date(g.updated ?? g.date) })),
  ];
}
