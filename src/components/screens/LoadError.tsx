"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useProgram } from "@/components/ProgramProvider";
import { Button } from "@/components/ui/Button";
import { Splash } from "./Splash";

/** Pantalla de error al recuperar el historial: siempre ofrece reintentar y cerrar sesión. */
export function LoadError({ message }: { message?: string | null }) {
  const { signOut } = useAuth();
  const { refresh } = useProgram();
  return (
    <Splash mood="sweat" showLoader={false} message={message ?? "No pudimos cargar tu historial. Revisa tu conexión e inténtalo de nuevo."}>
      <div className="mt-1 grid w-full max-w-xs gap-3">
        <Button size="lg" onClick={() => void refresh()}>
          Reintentar
        </Button>
        <Button variant="secondary" onClick={() => void signOut()}>
          Cerrar sesión
        </Button>
      </div>
    </Splash>
  );
}
