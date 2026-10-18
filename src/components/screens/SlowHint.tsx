"use client";

import { useEffect, useState } from "react";

/** Si la carga tarda demasiado, ofrece recargar en lugar de dejar al usuario mirando una pantalla quieta. */
export function SlowHint({ afterMs = 9000 }: { afterMs?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSlow(true), afterMs);
    return () => window.clearTimeout(t);
  }, [afterMs]);
  if (!slow) return null;
  return (
    <div role="status" className="mt-1 flex flex-col items-center gap-3">
      <p className="max-w-[17rem] text-[15px] text-paper-dim">Está tardando más de lo normal. Revisa tu conexión.</p>
      <button type="button" onClick={() => window.location.reload()} className="press h-12 rounded-[14px] border-2 border-paper/30 px-6 font-slab text-[15px] caps">
        Recargar
      </button>
    </div>
  );
}
