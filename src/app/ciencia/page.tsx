import type { Metadata } from "next";
import { JsonLd } from "@/components/landing/JsonLd";
import { PublicShell } from "@/components/landing/PublicShell";
import { APP_NAME } from "@/lib/config";
import evidenceRaw from "@/content/evidence.json";
import { GRADE_TEXT, gradeOf, type Evidence, type EvidenceGrade } from "@/lib/evidence";
import { SITE_URL, landing } from "@/lib/landing";

const TITLE = "La ciencia detrás de la pesa rusa, sin humo";
const DESCRIPTION = "Qué dice la ciencia sobre la pesa rusa, con estudios verificados, su nivel de evidencia (A a D) y lo que no afirmamos: sin humo ni promesas.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/ciencia" },
  openGraph: { type: "article", locale: "es_MX", siteName: APP_NAME, url: "/ciencia", title: TITLE, description: "Estudios verificados y lo que no prometemos." },
  twitter: { card: "summary_large_image", title: TITLE, description: "Estudios verificados y lo que no prometemos." },
};

const GRADES: EvidenceGrade[] = ["A", "B", "C", "D"];

/** Cita corta: «Apellido y cols.» (varios autores o «et al.»), «Apellido y Apellido» (dos) o «Apellido» (uno). */
function shortAuthors(authors: string): string {
  const etAl = /\bet al\.?/i.test(authors);
  const list = authors
    .replace(/\bet al\.?/i, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.split(" ")[0] ?? s);
  const first = list[0] ?? authors;
  if (etAl || list.length > 2) return `${first} y cols.`;
  return list.length === 2 ? `${first} y ${list[1]}` : first;
}

export default function Ciencia() {
  const all = evidenceRaw as Evidence[];
  const byGrade = GRADES.map((g) => ({ g, items: all.filter((e) => gradeOf(e) === g).sort((a, b) => b.year - a.year) }));
  const { science } = landing;

  return (
    <PublicShell>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: APP_NAME, item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: TITLE, item: `${SITE_URL}/ciencia` },
          ],
        }}
      />
      <h1 className="font-slab text-[clamp(32px,8vw,46px)] leading-[1.05] text-balance">{TITLE}</h1>
      <p className="mt-4 text-[17px] leading-snug text-paper-dim">
        Cada bloque de tu rutina puede mostrar su respaldo. Aquí está todo junto: {all.length} referencias revisadas una por una contra PubMed, su DOI o la fuente original, cada una con su diseño de estudio y un nivel de evidencia de la A a la D.
        Es nuestro juicio cualitativo para que sepas cuánto pesa cada dato; no es una evaluación GRADE formal. Y recuerda: la evidencia específica de pesa rusa todavía es pequeña.
      </p>

      <section aria-labelledby="niveles" className="mt-10">
        <h2 id="niveles" className="font-slab text-[28px] leading-tight">
          Cómo leer los niveles
        </h2>
        <dl className="mt-4 grid gap-3">
          {GRADES.map((g) => (
            <div key={g} className="flex items-start gap-4 rounded-[18px] bg-night-2 p-4">
              <dt className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-paper font-num text-[20px] font-extrabold text-night">{g}</dt>
              <dd className="pt-1.5 text-[16px] leading-snug text-paper-dim">{GRADE_TEXT[g]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="no-prometemos" className="mt-10 rounded-[20px] border-2 border-dashed border-paper-mute/60 p-5">
        <h2 id="no-prometemos" className="font-slab text-[26px] leading-tight">
          {science.notClaimedTitle}
        </h2>
        <ul className="mt-3 space-y-2 text-[16px] leading-snug text-paper-dim">
          {science.notClaimed.map((n) => (
            <li key={n} className="flex gap-3">
              <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-paper-mute" aria-hidden="true" />
              {n}
            </li>
          ))}
        </ul>
      </section>

      {byGrade.map(({ g, items }) => (
        <section key={g} aria-labelledby={`nivel-${g}`} className="mt-12">
          <h2 id={`nivel-${g}`} className="font-slab text-[28px] leading-tight">
            Nivel {g} <span className="font-body text-[16px] text-paper-mute">· {GRADE_TEXT[g]} · {items.length}</span>
          </h2>
          <ul className="mt-4 space-y-3">
            {items.map((e) => (
              <li key={e.id} className="rounded-[18px] bg-night-2 p-4">
                <p className="text-[16px] leading-snug">{e.findingEs}</p>
                <p className="mt-2 text-[14px] leading-snug text-paper-mute">
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                    {shortAuthors(e.authors)}, {e.year} · {e.journal}
                  </a>
                  <span className="block pt-0.5">
                    {e.design}
                    {e.n ? ` (n = ${e.n})` : ""}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PublicShell>
  );
}
