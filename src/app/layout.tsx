import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Anybody, Barlow, Barlow_Condensed } from "next/font/google";
import { ProvidersGate } from "@/components/ProvidersGate";
import { RegisterSW } from "@/components/RegisterSW";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// Condensada deportiva en cursiva: titulares, nombres de tarjetas y botones.
const display = Barlow_Condensed({ weight: ["600", "700", "800"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-display", display: "swap" });
// Grotesca variable (peso + ancho): números de datos; el peso sube con el esfuerzo.
const anybody = Anybody({ subsets: ["latin"], axes: ["wdth"], variable: "--font-anybody", display: "swap" });
// Texto corrido e interfaz.
const body = Barlow({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-body-sans", display: "swap" });

/**
 * URL pública del sitio: define las URLs absolutas de la portada para redes (og:image).
 * Configura NEXT_PUBLIC_SITE_URL en producción (p. ej. https://kettellbro.app); en Vercel se usa el dominio del proyecto.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const TITLE = `${APP_NAME} · entrenador de pesas rusas`;
const DESCRIPTION = "Un entrenamiento nuevo cada día: rutinas de pesa rusa con respaldo científico, acompañante en cada serie y tu historial siempre contigo.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: TITLE, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "es_MX", siteName: APP_NAME, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#0b0e14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${anybody.variable} ${body.variable}`} suppressHydrationWarning>

      <body>
        {/* Evita el destello de color: aplica la última tinta del día antes del primer pintado */}
        <Script id="kb-ink" strategy="beforeInteractive">{"try{var f=localStorage.getItem('kb:focus');if(f)document.documentElement.setAttribute('data-focus',f);if(localStorage.getItem('kb:auth-hint')||localStorage.getItem('kb:v1:demo:user'))document.documentElement.setAttribute('data-returning','1')}catch(e){}"}</Script>
        <ProvidersGate>{children}</ProvidersGate>
        <RegisterSW />
      </body>
    </html>
  );
}
