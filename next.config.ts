import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Permite construir en otra carpeta (NEXT_DIST_DIR=.next-check next build) sin pisar la caché del servidor de desarrollo.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // El indicador de desarrollo de Next tapaba la esquina del pulgar en las pruebas visuales.
  devIndicators: false,
  // Probar desde el celular en la misma red wifi (http://192.168.x.x:3000): sin esto Next bloquea el HMR y la página
  // se queda en la pantalla de carga. Solo afecta a `next dev`.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  // Fotos de perfil de Google (lh3.googleusercontent.com) se muestran con <img>, sin optimizador.
  poweredByHeader: false,
  async headers() {
    return [
      // La app (detrás del login) no se indexa. robots.txt ahorra rastreo; esta cabecera lo garantiza si alguien enlaza una ruta.
      {
        source: "/:path(hoy|progreso|metas|perfil|pesas|sesion|bienvenida|dev)/:rest*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path(hoy|progreso|metas|perfil|pesas|sesion|bienvenida|dev)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
