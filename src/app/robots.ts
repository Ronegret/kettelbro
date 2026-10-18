import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/landing";

/** La portada y las páginas públicas se indexan; la app vive detrás del login con Google y no. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/hoy", "/progreso", "/metas", "/perfil", "/pesas", "/sesion", "/bienvenida", "/dev", "/__/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
