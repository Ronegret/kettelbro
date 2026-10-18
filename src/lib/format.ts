import { EXERCISES } from "@/lib/engine/exercises";
import type { Focus, Protocol, SessionPlan, WorkBlock } from "@/lib/engine/types";

/** m:ss */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function firstName(displayName: string | null | undefined): string {
  const n = (displayName ?? "").trim().split(/\s+/)[0];
  return n || "bro";
}

/** Resumen corto del protocolo: "10×10 EMOM", "5×5 por lado"... */
export function protocolLabel(p: Protocol, exerciseId: WorkBlock["exerciseId"]): string {
  const ex = EXERCISES[exerciseId];
  switch (p.kind) {
    case "sets":
      return `${p.sets} × ${p.reps}${p.perSide ? " por lado" : ""}`;
    case "emom":
      return `${p.repsPerMinute} × ${p.minutes} EMOM`;
    case "ladder":
      return `Escalera ${p.rungs.join("-")} ×${p.rounds}${p.perSide ? " por lado" : ""}`;
    case "intervals":
      return `${p.rounds}× ${p.workSec}s/${p.restSec}s`;
    case "timed":
      return `${(p.sets ?? 1) > 1 ? `${p.sets}× ` : ""}${p.minutes} min a ${p.targetRpm}/min`;
    case "carry":
      return `${p.sets} × ${p.seconds} s${p.perSide ? " por lado" : ""}`;
    case "flow":
      return p.reps ? `${p.reps} reps${p.perSide ? " por lado" : ""}` : `${p.seconds}s`;
    case "complex":
      return `${p.rounds} rondas${p.perSide ? " por lado" : ""} · ${p.items.length} movimientos`;
  }
  return ex.nameEs;
}

export function bellLabel(b: WorkBlock): string {
  if (b.altBellKg && b.altShare) return `${b.bellKg}→${b.altBellKg} kg`;
  return `${b.bellKg} kg`;
}

/** Versión explicada de la pesa, para la lista de la rutina: "8 kg, con ¼ de las series a 12 kg". */
export function bellLabelLong(b: WorkBlock): string {
  if (!b.altBellKg || !b.altShare) return `${b.bellKg} kg`;
  const frac = b.altShare <= 0.25 ? "¼" : b.altShare <= 0.5 ? "½" : "¾";
  return `${b.bellKg} kg, con ${frac} de las series a ${b.altBellKg} kg`;
}

/** La línea principal de la tarjeta de hoy: "10×10 EMOM · 16 kg · 28 min". */
export function planHeadline(plan: SessionPlan): string {
  const primary = plan.blocks.find((b) => b.role === "primary") ?? plan.blocks[0];
  if (!primary) return `${plan.durationMin} min`;
  if (plan.focus === "recovery") return `${plan.blocks.length} movimientos suaves · ${plan.durationMin} min`;
  return `${protocolLabel(primary.protocol, primary.exerciseId)} · ${bellLabel(primary)} · ${plan.durationMin} min`;
}

export const FOCUS_BLURB: Record<Focus, string> = {
  power: "Explosión de cadera",
  strength: "Fuerza sin fallo",
  endurance: "Motor aeróbico",
  hybrid: "Complejo de cuerpo completo",
  skill: "Técnica y control",
  recovery: "Recuperación activa",
};

const DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function todayLabel(d = new Date()): string {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function nf(n: number): string {
  return new Intl.NumberFormat("es-MX").format(Math.round(n));
}
