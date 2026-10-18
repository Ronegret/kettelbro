/**
 * Recordatorio por calendario (.ics). No es una notificación de la app: es un evento recurrente en el calendario del
 * teléfono, con alarma a la hora elegida. Funciona sin backend ni permisos y es la forma honesta de recordar hoy
 * (las notificaciones push requieren un servidor que todavía no existe).
 */

export type ReminderDays = "daily" | "weekdays";

export interface ReminderInput {
  /** Hora local de inicio (0-23) y minuto (0-59). */
  hour: number;
  minute?: number;
  days: ReminderDays;
  /** Duración de la sesión elegida, en minutos (10, 15, 20 o 25). */
  minutes: number;
  /** Primer día del evento, fecha local YYYY-MM-DD (normalmente mañana). */
  startDate: string;
  /** Dirección que se abre desde el evento. */
  url: string;
  /** Momento de creación (para DTSTAMP); se inyecta para poder probar. */
  now?: Date;
  /** Identificador estable: reimportar el archivo actualiza el evento en vez de duplicarlo. */
  uid?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Escapa texto según RFC 5545 (coma, punto y coma, barra y saltos de línea). */
function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Pliega líneas largas a 75 octetos como pide RFC 5545 (continuación con un espacio). */
function fold(line: string): string[] {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return [line];
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // la línea de continuación empieza con un espacio
    if (bytes + b > limit) {
      out.push(out.length === 0 ? cur : ` ${cur}`);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(out.length === 0 ? cur : ` ${cur}`);
  return out;
}

/** Fecha YYYY-MM-DD → YYYYMMDD. */
function compactDate(date: string): string {
  return date.replace(/-/g, "");
}

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function buildIcs(input: ReminderInput): string {
  const hour = Math.min(23, Math.max(0, Math.round(input.hour)));
  const minute = Math.min(59, Math.max(0, Math.round(input.minute ?? 0)));
  const minutes = Math.min(60, Math.max(5, Math.round(input.minutes)));
  const rrule = input.days === "weekdays" ? "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" : "RRULE:FREQ=DAILY";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kettellbro//recordatorio//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid ?? "kettellbro-recordatorio"}@kettellbro`,
    `DTSTAMP:${utcStamp(input.now ?? new Date())}`,
    // hora flotante: la que marque el reloj local, vaya donde vaya el teléfono
    `DTSTART:${compactDate(input.startDate)}T${pad(hour)}${pad(minute)}00`,
    `DURATION:PT${minutes}M`,
    rrule,
    `SUMMARY:${esc("kettellbro · tu carta del día")}`,
    `DESCRIPTION:${esc(`Abre kettellbro y toca Empezar: tu sesión dura ${minutes} minutos.\n${input.url}`)}`,
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc("kettellbro · tu carta del día")}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.flatMap(fold).join("\r\n")}\r\n`;
}

/** Día siguiente (fecha local YYYY-MM-DD) a partir de otra. Evita saltos por horario de verano usando mediodía. */
export function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const t = new Date(y, m - 1, d, 12);
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** Descarga el .ics en el navegador. Devuelve false si el entorno no lo permite. */
export function downloadIcs(ics: string, filename = "kettellbro-recordatorio.ics"): boolean {
  try {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}
