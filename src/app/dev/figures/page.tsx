import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { FigureGallery } from "@/components/figure/FigureGallery";

export const metadata: Metadata = { title: "Figuras (dev)", robots: { index: false, follow: false } };

/** Página de verificación SOLO de desarrollo: todas las figuras animadas de ejercicios. */
export default function FiguresDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <FigureGallery />
    </Suspense>
  );
}
