import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Figures3DLab } from "./Figures3DLab";

export const metadata: Metadata = { title: "Figuras 3D (dev)", robots: { index: false, follow: false } };

/** Página de verificación SOLO de desarrollo: personajes 3D con controles de personaje, ejercicio, vista, velocidad, tinta y lado. */
export default function Figures3DDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <Figures3DLab />
    </Suspense>
  );
}
