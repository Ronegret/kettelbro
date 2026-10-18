import { describe, expect, it } from "vitest";
import { buildIcs, nextDay } from "../reminder";

const base = { hour: 7, minutes: 20, days: "daily" as const, startDate: "2026-10-17", url: "https://kettellbro.vercel.app/hoy", now: new Date("2026-10-16T12:00:00Z") };

describe("recordatorio (.ics)", () => {
  it("genera un evento recurrente diario con la hora local y la duración de la sesión", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261017T070000");
    expect(ics).toContain("DURATION:PT20M");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("TRIGGER:PT0M");
    expect(ics).toContain("DTSTAMP:20261016T120000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("de lunes a viernes usa BYDAY", () => {
    expect(buildIcs({ ...base, days: "weekdays" })).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  });
  it("usa saltos de línea CRLF y ninguna línea pasa de 75 octetos", () => {
    const ics = buildIcs({ ...base, url: `https://kettellbro.vercel.app/hoy?${"x".repeat(200)}` });
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(ics).not.toMatch(/[^\r]\n/);
  });
  it("escapa comas, punto y coma y saltos de línea del texto", () => {
    const ics = buildIcs(base);
    expect(ics).toContain("tu sesión dura 20 minutos.\\n");
    expect(ics.replace(/\r\n /g, "")).toContain("DESCRIPTION:Abre kettellbro y toca Empezar: tu sesión dura 20 minutos.\\nhttps://kettellbro.vercel.app/hoy");
  });
  it("sanea la hora y la duración", () => {
    const ics = buildIcs({ ...base, hour: 31, minute: -5, minutes: 500 });
    expect(ics).toContain("DTSTART:20261017T230000");
    expect(ics).toContain("DURATION:PT60M");
  });
  it("calcula el día siguiente, también al cambiar de mes y de año", () => {
    expect(nextDay("2026-10-16")).toBe("2026-10-17");
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});
