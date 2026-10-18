"use client";

import { useEffect } from "react";
import { useReadyProgram } from "@/components/RequireProgram";
import { focusOfDay } from "@/lib/engine/generator";

/**
 * Tiñe TODA la app (barra inferior, hojas, controles) con la tinta del enfoque del día.
 * Escribe data-focus en <html>: las variables --ink* se resuelven desde ahí.
 */
export function DayInk() {
  const { state, settings } = useReadyProgram();
  const focus = focusOfDay(state.dayIndex, settings);
  useEffect(() => {
    document.documentElement.setAttribute("data-focus", focus);
    try {
      localStorage.setItem("kb:focus", focus);
    } catch {
      /* sin almacenamiento: solo se pierde la optimización del primer pintado */
    }
  }, [focus]);
  return null;
}
