"use client";

import { useEffect, useState } from "react";
import { renderShareCard } from "@/lib/shareCard";
import type { Focus } from "@/lib/engine/types";

const FOCI: Focus[] = ["power", "strength", "endurance"];

/** Dibuja la imagen de compartir con datos de ejemplo en tres tintas (para revisar su diseño). */
export function TarjetaLab() {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    (async () => {
      for (const focus of FOCI) {
        const blob = await renderShareCard({ day: 12, focus, title: "El peso muerto", streak: 6, tonnageKg: 1860, minutes: 20, rank: "Aprendiz", appName: "kettellbro" });
        made.push(URL.createObjectURL(blob));
      }
      if (alive) setUrls(made);
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
  return (
    <main className="flex gap-3 bg-night p-3">
      {urls.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="Imagen para compartir" className="h-[760px] w-auto rounded-xl" />
      ))}
    </main>
  );
}
