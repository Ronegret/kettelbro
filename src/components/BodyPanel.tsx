"use client";

import type { BellRecommendation } from "@/lib/engine/body";

/** Valida peso y estatura escritos a mano. Devuelve null si falta alguno o no es plausible. */
export function parseBody(height: string, weight: string): { heightCm: number; weightKg: number } | null {
  const h = Number(height.replace(",", "."));
  const w = Number(weight.replace(",", "."));
  if (!Number.isFinite(h) || !Number.isFinite(w)) return null;
  if (h < 120 || h > 230 || w < 30 || w > 250) return null;
  return { heightCm: Math.round(h), weightKg: Math.round(w * 10) / 10 };
}

/** Entradas de estatura y peso (teclado numérico, 16 px para que iOS no haga zoom). */
export function BodyFields({
  height,
  weight,
  onHeight,
  onWeight,
}: {
  height: string;
  weight: string;
  onHeight: (v: string) => void;
  onWeight: (v: string) => void;
}) {
  const invalid = (height !== "" || weight !== "") && !parseBody(height, weight);
  const field = "h-14 w-full rounded-[14px] border-2 border-seam bg-night-2 px-4 font-num text-[22px] font-bold text-paper placeholder:text-paper-mute focus:border-ink-lift focus:outline-none";
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[15px] font-medium text-paper-dim">Estatura (cm)</span>
          <input className={field} inputMode="decimal" autoComplete="off" placeholder="172" value={height} onChange={(e) => onHeight(e.target.value)} aria-invalid={invalid} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[15px] font-medium text-paper-dim">Peso (kg)</span>
          <input className={field} inputMode="decimal" autoComplete="off" placeholder="72" value={weight} onChange={(e) => onWeight(e.target.value)} aria-invalid={invalid} />
        </label>
      </div>
      {invalid && (
        <p role="alert" className="mt-2 text-[14.5px] text-[#ffb3c8]">
          Revisa los datos: estatura entre 120 y 230 cm y peso entre 30 y 250 kg.
        </p>
      )}
    </div>
  );
}

/** Qué pesas usar según tu cuerpo y nivel, con su set de partida y las notas de honestidad. */
export function RecommendationPanel({ rec, compact = false }: { rec: BellRecommendation; compact?: boolean }) {
  return (
    <section aria-label="Pesas sugeridas para ti" className="rounded-[18px] bg-night-2 p-4 text-paper">
      <p className="font-slab text-xl leading-tight">Tu pesa de referencia: {rec.referenceKg} kg</p>
      <p className="mt-1 text-[15px] text-paper-dim">
        Rango razonable: {rec.rangeKg[0] === rec.rangeKg[1] ? `${rec.rangeKg[0]} kg` : `${rec.rangeKg[0]} a ${rec.rangeKg[1]} kg`}. Ligera para get-up, press y acarreos: {rec.lightKg} kg. Siguiente meta: {rec.nextKg} kg.
      </p>
      <p className="mt-3 text-[15px]">
        <span className="font-slab">Si vas a comprar: </span>
        set de {rec.starterSet.join(" + ")} kg.
      </p>
      {!compact && (
        <ul className="mt-3 space-y-2 border-t border-seam pt-3 text-[14.5px] leading-snug text-paper-dim">
          {rec.notesEs.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
