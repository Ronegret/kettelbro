"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ProgramProvider } from "@/components/ProgramProvider";

/** Montaje único de contextos: sesión de Google → datos del usuario (resume). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProgramProvider>{children}</ProgramProvider>
    </AuthProvider>
  );
}
