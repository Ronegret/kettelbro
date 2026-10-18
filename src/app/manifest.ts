import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

/** PWA instalable: se abre a pantalla completa como una app nativa, con íconos para cualquier dispositivo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/hoy",
    name: `${APP_NAME} · entrenador de pesas rusas`,
    short_name: APP_NAME,
    description: "Una sesión nueva cada día: rutinas de pesa rusa con respaldo científico y tu historial siempre contigo.",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0e14",
    theme_color: "#0b0e14",
    lang: "es",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [
      { src: "/screenshots/hoy.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Tu sesión de hoy" },
      { src: "/screenshots/login.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Entra con Google" },
      { src: "/screenshots/hoy-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "kettellbro en pantalla grande" },
    ],
    shortcuts: [
      { name: "Hoy", short_name: "Hoy", description: "Tu sesión de hoy", url: "/hoy", icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }] },
      { name: "Progreso", short_name: "Progreso", description: "Tu historial y récords", url: "/progreso", icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
