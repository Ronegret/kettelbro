import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/landing/JsonLd";
import { PublicShell } from "@/components/landing/PublicShell";
import { APP_NAME } from "@/lib/config";
import { getAllGuides, getGuide } from "@/lib/guides";
import { SITE_URL } from "@/lib/landing";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: g.title,
    description: g.description,
    alternates: { canonical: `/guias/${g.slug}` },
    openGraph: {
      type: "article",
      locale: "es_MX",
      siteName: APP_NAME,
      url: `/guias/${g.slug}`,
      title: g.title,
      description: g.description,
      publishedTime: g.date,
      ...(g.updated ? { modifiedTime: g.updated } : {}),
    },
    twitter: { card: "summary_large_image", title: g.title, description: g.description },
  };
}

export default async function Guia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const url = `${SITE_URL}/guias/${g.slug}`;

  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              headline: g.title,
              description: g.description,
              datePublished: g.date,
              dateModified: g.updated ?? g.date,
              inLanguage: "es",
              mainEntityOfPage: url,
              publisher: { "@type": "Organization", name: APP_NAME, url: SITE_URL },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: APP_NAME, item: `${SITE_URL}/` },
                { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE_URL}/guias` },
                { "@type": "ListItem", position: 3, name: g.title, item: url },
              ],
            },
          ],
        }}
      />
      <nav aria-label="Migas de pan" className="text-[14px] text-paper-mute">
        <Link href="/guias" className="inline-flex min-h-11 items-center underline underline-offset-4">
          ← Todas las guías
        </Link>
      </nav>
      <article>
        <h1 className="font-slab text-[clamp(30px,7.5vw,44px)] leading-[1.06] text-balance">{g.title}</h1>
        <p className="mt-3 text-[14px] text-paper-mute">{g.updated ? `Actualizada el ${g.updated}` : `Publicada el ${g.date}`}</p>
        <div className="prose-kb mt-6" dangerouslySetInnerHTML={{ __html: g.html }} />
      </article>
      <aside className="mt-12 rounded-[20px] bg-night-2 p-5">
        <p className="font-slab text-[22px] leading-tight">Prueba {APP_NAME}</p>
        <p className="mt-1.5 text-[15.5px] leading-snug text-paper-dim">Una sesión nueva cada día, con sesiones de 10 a 25 minutos que la app guía serie por serie.</p>
        <Link href="/" className="press mt-4 inline-flex h-12 items-center rounded-[14px] bg-paper px-5 text-[15px] font-semibold text-night">
          Ver cómo funciona
        </Link>
      </aside>
    </PublicShell>
  );
}
