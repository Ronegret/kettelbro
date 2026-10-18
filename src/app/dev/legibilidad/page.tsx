import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Legibilidad } from "./Legibilidad";

export const metadata: Metadata = { title: "Legibilidad de los ejercicios (dev)", robots: { index: false, follow: false } };

/** Banco de pruebas visual SOLO de desarrollo (404 en producción). */
export default function LegibilidadPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Legibilidad />
    </Suspense>
  );
}
