"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { buildIcs, downloadIcs, nextDay, type ReminderDays } from "@/lib/reminder";

const KEY = "kb:reminder";
const HOURS = [6, 7, 12, 18, 20] as const;
const DAYS: Array<{ id: ReminderDays; label: string }> = [
  { id: "daily", label: "Todos los días" },
  { id: "weekdays", label: "Lunes a viernes" },
];

interface Saved {
  hour: number;
  days: ReminderDays;
}

function read(): Saved | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Saved | null;
    return v && typeof v.hour === "number" && (v.days === "daily" || v.days === "weekdays") ? v : null;
  } catch {
    return null;
  }
}

const chip = (on: boolean) =>
  `press h-12 min-w-[64px] rounded-[14px] border-2 px-3 font-num text-[17px] font-bold ${on ? "border-ink bg-ink text-on-ink" : "border-seam bg-night-2 text-paper-dim"}`;

/**
 * Recordatorio por calendario tras cumplir una carta: un evento recurrente en el calendario del teléfono, con alarma.
 * Es honesto sobre lo que es: no una notificación de la app (esas necesitan un servidor que todavía no existe).
 */
export function ReminderCard({ nextDayNumber, minutes, today }: { nextDayNumber: number; minutes: number; today: string }) {
  // Se lee en el cliente (localStorage); el servidor siempre pinta la tarjeta sin guardar.
  const [saved, setSaved] = useState<Saved | null>(() => (typeof window === "undefined" ? null : read()));
  const [editing, setEditing] = useState(false);
  const [hour, setHour] = useState<number>(saved?.hour ?? 7);
  const [days, setDays] = useState<ReminderDays>(saved?.days ?? "daily");
  const [failed, setFailed] = useState(false);

  function add() {
    const ics = buildIcs({ hour, days, minutes, startDate: nextDay(today), url: `${window.location.origin}/hoy` });
    if (!downloadIcs(ics)) return setFailed(true);
    setFailed(false);
    const next = { hour, days };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento: la tarjeta volverá a salir, no pasa nada */
    }
    setSaved(next);
    setEditing(false);
  }

  if (saved && !editing) {
    return (
      <section aria-label="Recordatorio" className="flex items-center justify-between gap-3 rounded-[20px] bg-night-2 p-4">
        <p className="flex items-center gap-3 text-[15px] leading-snug text-paper-dim">
          <Icon name="check" size={20} className="shrink-0 text-paper" />
          Recordatorio: {saved.days === "daily" ? "todos los días" : "de lunes a viernes"} a las {saved.hour}:00.
        </p>
        <button type="button" onClick={() => setEditing(true)} className="press inline-flex h-11 shrink-0 items-center px-3 font-medium text-ink-lift underline underline-offset-4">
          Cambiar
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="rec-h" className="rounded-[20px] bg-night-2 p-5">
      <h2 id="rec-h" className="font-slab text-2xl">
        Mañana, Día {nextDayNumber}: ponle hora.
      </h2>
      <p className="mt-1 text-[14.5px] leading-snug text-paper-dim">Un recordatorio en tu calendario, con alarma, para que tu carta no se te pase.</p>
      <div role="radiogroup" aria-label="Hora del recordatorio" className="mt-4 flex flex-wrap gap-2">
        {HOURS.map((h) => (
          <button key={h} type="button" role="radio" aria-checked={hour === h} onClick={() => setHour(h)} className={chip(hour === h)}>
            {h}:00
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Días" className="mt-3 flex flex-wrap gap-2">
        {DAYS.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={days === d.id} onClick={() => setDays(d.id)} className={chip(days === d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <Button className="mt-4 w-full whitespace-nowrap" onClick={add}>
        Añadir al calendario
      </Button>
      <p className="mt-3 text-[14px] leading-snug text-paper-mute" role={failed ? "alert" : undefined}>
        {failed
          ? "Tu navegador no dejó descargar el archivo. Ábrelo en Safari o Chrome e inténtalo de nuevo."
          : "Es un recordatorio de tu calendario, no una notificación de la app."}
      </p>
    </section>
  );
}
