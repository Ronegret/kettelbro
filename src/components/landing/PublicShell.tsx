import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/Wordmark";
import { landing, liveFooterLinks } from "@/lib/landing";

/** Marco de las páginas públicas (ciencia, guías, privacidad...): cabecera con la marca, contenido y pie con el aviso de salud. */
export function PublicShell({ children }: { children: ReactNode }) {
  const links = liveFooterLinks();
  return (
    <div className="min-h-dvh bg-night text-paper">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-night">
        Saltar al contenido
      </a>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link href="/" aria-label="kettellbro, ir a la portada" className="inline-block [zoom:0.8] max-[359px]:[zoom:0.62]">
          <Wordmark size="md" plate />
        </Link>
        <Link href="/" className="press inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-paper px-5 text-[15px] font-semibold text-night" aria-label="Probar la app">
          Probar
        </Link>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-3xl px-5 pb-16 pt-6">
        {children}
      </main>
      <footer className="border-t border-seam py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-3xl px-5">
          <p className="text-[14.5px] leading-snug text-paper-dim">{landing.legal.healthNoticeEs}</p>
          <nav aria-label="Más páginas" className="mt-4 flex flex-wrap gap-x-6">
            <Link href="/" className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
              Portada
            </Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
