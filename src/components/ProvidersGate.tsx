"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isPublicPath } from "@/lib/publicRoutes";

// Carga diferida: en las páginas públicas este módulo (y con él Firebase) ni siquiera se descarga.
const AppProviders = dynamic(() => import("@/components/AppProviders").then((m) => m.AppProviders));

/** Monta los proveedores de sesión y datos salvo en las páginas públicas. */
export function ProvidersGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPath(pathname)) return <>{children}</>;
  return <AppProviders>{children}</AppProviders>;
}
