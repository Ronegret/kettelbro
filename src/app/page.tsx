import type { Metadata } from "next";
import { EntryGate } from "@/components/landing/EntryGate";
import { JsonLd } from "@/components/landing/JsonLd";
import { Landing } from "@/components/landing/Landing";
import { APP_NAME } from "@/lib/config";
import { SITE_URL, landing, liveFaq } from "@/lib/landing";

const { seo } = landing;

export const metadata: Metadata = {
  // `absolute`: la portada no hereda la plantilla «%s · kettellbro» del layout.
  title: { absolute: seo.title },
  description: seo.description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "es_MX", siteName: APP_NAME, url: "/", title: seo.ogTitle, description: seo.ogDescription },
  twitter: { card: "summary_large_image", title: seo.ogTitle, description: seo.ogDescription },
  robots: { index: true, follow: true },
};

/**
 * Portada pública, renderizada en el servidor. Datos estructurados: descripción de la app SIN precio ni calificaciones
 * (no existen todavía y no se inventan) y las preguntas frecuentes ya publicables.
 */
export default function Home() {
  const faq = liveFaq();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: APP_NAME, inLanguage: "es" },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: APP_NAME,
        url: SITE_URL,
        description: seo.description,
        applicationCategory: "HealthApplication",
        operatingSystem: "Cualquier navegador web (Android, iOS, Windows, macOS)",
        inLanguage: "es",
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={graph} />
      {/* `landing-root`: se oculta por CSS en la app instalada y si vuelve alguien que ya había entrado (ver globals.css) */}
      <main className="landing-root">
        <Landing />
      </main>
      <EntryGate />
    </>
  );
}
