"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useProgram } from "@/components/ProgramProvider";
import { LoadError } from "@/components/screens/LoadError";
import { LoginScreen } from "@/components/screens/LoginScreen";
import { SetupScreen } from "@/components/screens/SetupScreen";
import { Splash } from "@/components/screens/Splash";

const noop = () => () => {};

/** ¿Corre como app instalada? Entonces la portada no tiene sentido: se ve el acceso a pantalla completa. */
function useStandalone(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(display-mode: standalone)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

/** Pista (puesta antes del primer pintado por el script del layout) de que esta persona ya había entrado. */
function useReturningHint(): boolean {
  return useSyncExternalStore(noop, () => document.documentElement.getAttribute("data-returning") === "1", () => false);
}

function Overlay({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-night">{children}</div>;
}

/**
 * Puerta de entrada de `/`. La portada se renderiza en el servidor (la ven los buscadores y quien llega por primera vez);
 * esta isla de cliente solo decide qué hacer según la sesión:
 *   con sesión          → recupera el historial y redirige a Hoy (o al onboarding de una cuenta nueva)
 *   app instalada       → acceso a pantalla completa en lugar de la portada
 *   ya había entrado    → pantalla de carga en lugar de un destello de portada
 *   sin sesión          → no hace nada: se ve la portada
 */
export function EntryGate() {
  const { status } = useAuth();
  const program = useProgram();
  const router = useRouter();
  const standalone = useStandalone();
  const returning = useReturningHint();

  useEffect(() => {
    if (status !== "signedIn" || program.status !== "ready") return;
    router.replace(program.settings?.onboardedAt ? "/hoy" : "/bienvenida");
  }, [status, program.status, program.settings, router]);

  // Sin sesión: se retira la pista para que la portada se vea (estaba oculta por si volvía alguien con sesión).
  useEffect(() => {
    if (status === "signedOut") document.documentElement.removeAttribute("data-returning");
  }, [status]);

  if (status === "misconfigured") {
    return (
      <Overlay>
        <SetupScreen />
      </Overlay>
    );
  }
  if (status === "signedIn" && program.status === "error") {
    return (
      <Overlay>
        <LoadError message={program.error} />
      </Overlay>
    );
  }
  if (status === "signedIn" || (status === "loading" && (standalone || returning))) {
    return (
      <Overlay>
        <Splash message={status === "loading" ? "Abriendo kettellbro…" : "Recuperando tu historial…"} />
      </Overlay>
    );
  }
  if (status === "signedOut" && standalone) {
    return (
      <Overlay>
        <LoginScreen />
      </Overlay>
    );
  }
  return null;
}
