"use client";

import { useEffect, useMemo, useState } from "react";
import { localDateKey } from "@/lib/engine/defaults";
import { planForToday } from "@/lib/engine/index";
import type { ActiveSessionDraft, ProgramState, SessionPlan, UserSettings } from "@/lib/engine/types";

/** Fecha local (YYYY-MM-DD) que se refresca sola al pasar la medianoche o al volver a la app. */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => localDateKey());
  useEffect(() => {
    const refresh = () => setKey(localDateKey());
    const id = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return key;
}

/**
 * La carta de hoy. Si hay una sesión a medias (borrador), se usa SU plan congelado:
 * así reanudar nunca cambia los ejercicios aunque el usuario haya modificado sus ajustes.
 */
export function useTodayPlan(
  uid: string,
  state: ProgramState,
  settings: UserSettings,
  draft: ActiveSessionDraft | null,
): { plan: SessionPlan; resuming: boolean; today: string } {
  const today = useTodayKey();
  const plan = useMemo(() => {
    if (draft && draft.plan.dayIndex === state.dayIndex) return draft.plan;
    return planForToday(uid, state, settings, today);
  }, [uid, state, settings, today, draft]);
  return { plan, resuming: Boolean(draft && draft.plan.dayIndex === state.dayIndex), today };
}
