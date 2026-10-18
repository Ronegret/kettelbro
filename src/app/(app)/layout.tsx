"use client";

import type { ReactNode } from "react";
import { DayInk } from "@/components/DayInk";
import { RequireProgram } from "@/components/RequireProgram";
import { TabBar } from "@/components/ui/TabBar";

/** Shell de la app: guardia de sesión + barra inferior. La sesión de entrenamiento (/sesion) vive fuera de este shell. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireProgram>
      {() => (
        <>
          <DayInk />
          <div className="pb-[calc(var(--tab-h)+env(safe-area-inset-bottom,0px)+12px)]">{children}</div>
          <TabBar />
        </>
      )}
    </RequireProgram>
  );
}
