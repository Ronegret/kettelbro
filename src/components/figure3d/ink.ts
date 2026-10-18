/** Tinta del día leída de las variables CSS (--ink, --ink-deep, --ink-lift de globals.css; data-focus las reescribe). */

export interface InkTheme {
  ink: string;
  deep: string;
  lift: string;
  paper: string;
  night: string;
}

const FALLBACK: InkTheme = { ink: "#f2432d", deep: "#8f1d10", lift: "#ff7a62", paper: "#f4f6fa", night: "#0b0e14" };

export function readInk(el: Element): InkTheme {
  const cs = getComputedStyle(el);
  const g = (name: string, d: string): string => cs.getPropertyValue(name).trim() || d;
  return {
    ink: g("--ink", FALLBACK.ink),
    deep: g("--ink-deep", FALLBACK.deep),
    lift: g("--ink-lift", FALLBACK.lift),
    paper: g("--paper", FALLBACK.paper),
    night: g("--night", FALLBACK.night),
  };
}

/** Avisa cuando cambia data-focus en cualquier punto del documento (solo ese atributo: barato). */
export function watchInk(el: Element, cb: (t: InkTheme) => void): () => void {
  let prev = JSON.stringify(readInk(el));
  const mo = new MutationObserver(() => {
    const t = readInk(el);
    const s = JSON.stringify(t);
    if (s === prev) return;
    prev = s;
    cb(t);
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-focus"], subtree: true });
  return () => mo.disconnect();
}
