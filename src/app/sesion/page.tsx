"use client";

import { RequireProgram } from "@/components/RequireProgram";
import { SessionPlayer } from "@/components/session/SessionPlayer";

/** La sesión vive fuera del shell con barra inferior: pantalla completa, sin distracciones. */
export default function Sesion() {
  return <RequireProgram>{() => <SessionPlayer />}</RequireProgram>;
}
