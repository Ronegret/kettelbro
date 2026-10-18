import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { getEvidence, gradeOf } from "@/lib/evidence";
import { landing, liveFaq, liveFooterLinks, isLive } from "@/lib/landing";
import { CardFan } from "./CardFan";
import { GoogleCta } from "./GoogleCta";

/**
 * Portada pública de kettellbro. Se renderiza en el servidor: el HTML inicial ya contiene todo el texto (lo leen los
 * buscadores y quien llega por primera vez). Solo el botón de Google y la puerta de entrada (EntryGate) son de cliente.
 *
 * No se publica nada marcado como pendiente en landing.es.json (precio, datos, funcionamiento sin conexión, personajes).
 */

const wrap = "mx-auto w-full max-w-5xl px-5";
const h2 = "font-slab text-[clamp(28px,6vw,40px)] leading-[1.05] text-balance";

function Dot() {
  return <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-paper" aria-hidden="true" />;
}

export function Landing() {
  const { hero, howItWorks, whyDifferent, science, install, cta, legal } = landing;
  const faq = liveFaq();
  const footerLinks = liveFooterLinks();

  return (
    // overflow-x-clip: el abanico de tarjetas sobresale unos píxeles en pantallas estrechas y no debe crear scroll horizontal
    <div className="overflow-x-clip text-paper">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-night">
        Saltar al contenido
      </a>

      {/* ───── Hero ───── */}
      <div data-focus="power" className="bg-night" style={{ backgroundImage: "linear-gradient(165deg, var(--ink-deep) 0%, var(--night) 62%)" }}>
        <header className={`${wrap} flex items-center justify-between gap-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]`}>
          <span className="inline-block [zoom:0.8] max-[359px]:[zoom:0.62]" aria-label="kettellbro">
            <Wordmark size="md" plate />
          </span>
          <GoogleCta variant="compact" />
        </header>

        <section id="contenido" className={`${wrap} grid gap-10 pb-16 pt-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-12`}>
          <div>
            <h1 className="font-slab text-[clamp(34px,9vw,58px)] leading-[1.04] text-balance">{hero.h1}</h1>
            <p className="mt-4 max-w-xl text-[17px] leading-snug text-paper/90">{hero.subtitle}</p>
            <div className="mt-6 max-w-sm">
              <GoogleCta label={hero.primaryCta.label} />
            </div>
            <p className="mt-3 max-w-sm text-[14px] leading-snug text-paper/80">{hero.microcopy}</p>
            <a href={hero.secondaryCta.href} className="press mt-2 inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
              {hero.secondaryCta.label}
            </a>
            <ul className="mt-5 space-y-2 text-[15.5px]">
              {hero.highlights.map((h) => (
                <li key={h} className="flex gap-3">
                  <Dot />
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center py-2">
            <CardFan />
          </div>
        </section>
      </div>

      {/* ───── Cómo funciona ───── */}
      <section id={howItWorks.id} className="bg-night py-16" aria-labelledby="como-h">
        <div className={wrap}>
          <h2 id="como-h" className={h2}>
            {howItWorks.title}
          </h2>
          <p className="mt-2 text-[17px] text-paper-dim">{howItWorks.intro}</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {howItWorks.steps.map((s) => (
              <li key={s.n} className="flex gap-4 rounded-[20px] bg-night-2 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink font-slab text-[22px] leading-none text-on-ink" data-focus="power" aria-hidden="true">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-slab text-[22px] leading-tight">{s.title}</h3>
                  <p className="mt-1.5 text-[16px] leading-snug text-paper-dim">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── Por qué es distinto ───── */}
      <section id={whyDifferent.id} data-focus="strength" className="bg-ink-deep py-16" aria-labelledby="distinto-h">
        <div className={wrap}>
          <h2 id="distinto-h" className={h2}>
            {whyDifferent.title}
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {whyDifferent.points.map((p) => (
              <li key={p.id} className="rounded-[20px] bg-night/45 p-5">
                <h3 className="font-slab text-[22px] leading-tight">{p.title}</h3>
                <p className="mt-2 text-[16px] leading-snug text-paper/90">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── La ciencia sin humo ───── */}
      <section id={science.id} className="bg-night py-16" aria-labelledby="ciencia-h">
        <div className={wrap}>
          <h2 id="ciencia-h" className={h2}>
            {science.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[17px] leading-snug text-paper-dim">{science.intro}</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {science.claims.map((c) => {
              const ev = getEvidence([c.evidenceId])[0];
              const level = ev ? gradeOf(ev) : c.level;
              return (
                <li key={c.id} className="flex flex-col rounded-[20px] bg-night-2 p-5">
                  <p className="text-[16.5px] leading-snug">{c.claimEs}</p>
                  <p className="mt-3 text-[14px] leading-snug text-paper-mute">
                    {level ? <span className="mr-2 inline-block rounded-md bg-paper px-2 py-0.5 font-num text-[13px] font-extrabold text-night">Nivel {level}</span> : null}
                    <a href={ev?.url ?? c.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {c.refShortEs}
                    </a>
                    <span className="block pt-1">{c.designEs}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[14px] leading-snug text-paper-mute">{science.levelLegendEs}</p>

          <div className="mt-8 rounded-[20px] border-2 border-dashed border-paper-mute/60 p-5">
            <h3 className="font-slab text-[22px]">{science.notClaimedTitle}</h3>
            <ul className="mt-3 space-y-2 text-[16px] leading-snug text-paper-dim">
              {science.notClaimed.map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-paper-mute" aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
          {isLive(science.moreLink.href) && (
            <Link href={science.moreLink.href} className="press mt-6 inline-flex min-h-11 items-center font-medium text-ink-lift underline underline-offset-4" data-focus="power">
              {science.moreLink.label}
            </Link>
          )}
        </div>
      </section>

      {/* ───── Preguntas frecuentes ───── */}
      <section id="preguntas" data-focus="endurance" className="bg-ink-deep py-16" aria-labelledby="faq-h">
        <div className={wrap}>
          <h2 id="faq-h" className={h2}>
            Preguntas frecuentes
          </h2>
          <div className="mt-8 space-y-3">
            {faq.map((f) => (
              <details key={f.id} className="group rounded-[18px] bg-night/45 p-5 open:bg-night/60">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-slab text-[19px] leading-snug [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper font-num text-[22px] leading-none text-night transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[16px] leading-snug text-paper/90">{f.a}</p>
                {f.link && (
                  <Link href={f.link.href} className="mt-3 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                    {f.link.label}
                  </Link>
                )}
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Instalar ───── */}
      <section id={install.id} className="bg-night py-16" aria-labelledby="instalar-h">
        <div className={wrap}>
          <h2 id="instalar-h" className={h2}>
            {install.title}
          </h2>
          <p className="mt-2 max-w-2xl text-[17px] leading-snug text-paper-dim">{install.intro}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[install.android, install.ios].map((g) => (
              <div key={g.title} className="rounded-[20px] bg-night-2 p-5">
                <h3 className="font-slab text-[22px] leading-tight">{g.title}</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-[16px] leading-snug text-paper-dim marker:font-bold marker:text-paper">
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p className="mt-3 text-[14.5px] leading-snug text-paper-mute">{g.note}</p>
              </div>
            ))}
          </div>
          <details className="mt-4 rounded-[18px] bg-night-2 p-5">
            <summary className="min-h-11 cursor-pointer font-slab text-[19px] leading-snug">{install.desktop.title}</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[16px] leading-snug text-paper-dim marker:font-bold marker:text-paper">
              {install.desktop.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="mt-3 text-[14.5px] leading-snug text-paper-mute">{install.desktop.note}</p>
          </details>
        </div>
      </section>

      {/* ───── Llamada final ───── */}
      <section data-focus="power" className="bg-ink-deep py-16" aria-labelledby="cta-h">
        <div className={`${wrap} max-w-xl text-center`}>
          <h2 id="cta-h" className={h2}>
            {cta.title}
          </h2>
          <p className="mt-3 text-[17px] leading-snug text-paper/90">{cta.text}</p>
          <div className="mx-auto mt-6 max-w-sm">
            <GoogleCta label={cta.button.label} />
          </div>
          <p className="mt-3 text-[14px] text-paper/80">{cta.note}</p>
        </div>
      </section>

      {/* ───── Pie ───── */}
      <footer className="bg-night py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className={wrap}>
          <p className="max-w-2xl text-[14.5px] leading-snug text-paper-dim">{legal.healthNoticeEs}</p>
          {footerLinks.length > 0 && (
            <nav aria-label="Más páginas" className="mt-4 flex flex-wrap gap-x-6">
              {footerLinks.map((l) => (
                <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center text-[15px] font-medium underline underline-offset-4">
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
          <p className="mt-2 text-[14px] text-paper-mute">kettellbro · Una sesión nueva cada día.</p>
        </div>
      </footer>
    </div>
  );
}
