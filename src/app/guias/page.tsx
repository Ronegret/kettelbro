import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/landing/PublicShell";
import { APP_NAME } from "@/lib/config";
import { getAllGuides } from "@/lib/guides";

const TITLE = "Guías de pesa rusa: técnica, pesos y rutinas";
const DESCRIPTION = "Guías de pesa rusa: técnica paso a paso, cómo elegir el peso y rutinas cortas. Cada una cita fuentes verificables y avisos de seguridad.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guias" },
  openGraph: { type: "website", locale: "es_MX", siteName: APP_NAME, url: "/guias", title: "Guías de pesa rusa", description: "Técnica, pesos y rutinas cortas, con fuentes verificables." },
  twitter: { card: "summary_large_image", title: "Guías de pesa rusa", description: "Técnica, pesos y rutinas cortas, con fuentes verificables." },
};

export default function Guias() {
  const guides = getAllGuides();
  return (
    <PublicShell>
      <h1 className="font-slab text-[clamp(32px,8vw,46px)] leading-[1.05] text-balance">Guías de pesa rusa</h1>
      <p className="mt-4 text-[17px] leading-snug text-paper-dim">
        Técnica, pesos y rutinas cortas. Cada guía cita estudios verificables y avisa de sus límites: lo que la ciencia sabe y lo que no.
      </p>
      <ul className="mt-8 space-y-4">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link href={`/guias/${g.slug}`} className="press block rounded-[20px] bg-night-2 p-5">
              <h2 className="font-slab text-[24px] leading-tight text-balance">{g.title}</h2>
              <p className="mt-2 text-[15.5px] leading-snug text-paper-dim">{g.description}</p>
              <p className="mt-3 text-[14px] font-medium text-ink-lift underline underline-offset-4" data-focus="power">
                Leer la guía
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </PublicShell>
  );
}
