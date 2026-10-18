"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useProgram, type ProgramContextValue } from "@/components/ProgramProvider";
import { LoadError } from "@/components/screens/LoadError";
import { Splash } from "@/components/screens/Splash";
import type { ProgramState, UserSettings } from "@/lib/engine/types";

type Ready = ProgramContextValue & { state: ProgramState; settings: UserSettings };

/**
 * Guardia de rutas: solo muestra la app con sesión de Google, historial recuperado y onboarding hecho.
 * Si falta algo, redirige a la puerta de entrada ("/") o al onboarding.
 */
export function RequireProgram({ children }: { children: (p: Ready) => ReactNode }) {
  const { status } = useAuth();
  const program = useProgram();
  const router = useRouter();

  useEffect(() => {
    if (status === "signedOut" || status === "misconfigured") router.replace("/");
    else if (status === "signedIn" && program.status === "ready" && !program.settings?.onboardedAt) router.replace("/bienvenida");
  }, [status, program.status, program.settings, router]);

  if (status === "signedIn" && program.status === "error") {
    return <LoadError message={program.error} />;
  }
  if (status !== "signedIn" || program.status !== "ready" || !program.state || !program.settings?.onboardedAt) {
    return <Splash />;
  }
  return <>{children(program as Ready)}</>;
}

/** Para páginas dentro de <RequireProgram>: devuelve el programa ya listo (nunca null). */
export function useReadyProgram(): Ready & { user: NonNullable<ProgramContextValue["user"]> } {
  const p = useProgram();
  if (!p.state || !p.settings || !p.user) throw new Error("useReadyProgram se usó fuera de <RequireProgram>");
  return p as Ready & { user: NonNullable<ProgramContextValue["user"]> };
}
