import raw from "@/content/evidence.json";

export interface Evidence {
  id: string;
  authors: string;
  year: number;
  title: string;
  journal: string;
  url: string;
  design: string;
  n: number | null;
  findingEs: string;
}

const MAP = new Map<string, Evidence>((raw as Evidence[]).map((e) => [e.id, e]));

export function getEvidence(ids: readonly string[]): Evidence[] {
  return ids.map((id) => MAP.get(id)).filter((e): e is Evidence => Boolean(e));
}

/**
 * Nivel de evidencia (juicio cualitativo, NO es una evaluación GRADE formal):
 *  A = posición oficial o meta-análisis de entrenamiento de fuerza general
 *  B = ensayo controlado (RCT o similar) con kettlebell
 *  C = laboratorio agudo, biomecánica o EMG
 *  D = consenso de expertos, encuesta, revisión narrativa, informe o caso
 */
export type EvidenceGrade = "A" | "B" | "C" | "D";

export function gradeOf(e: Pick<Evidence, "design">): EvidenceGrade {
  const d = e.design.toLowerCase();
  if (/(position|meta-an|meta-reg|sistem|practice guideline|posici)/.test(d)) return "A";
  if (/(consenso|encuesta|delphi|caso|narrativa|informe|compendio|alcance|scoping|aplicaci|retrospectiv|no revisado)/.test(d)) return "D";
  if (/(rct|ensayo|controlad|dos grupos|pre-post|experimento)/.test(d)) return "B";
  return "C";
}

export const GRADE_TEXT: Record<EvidenceGrade, string> = {
  A: "Guía oficial o meta-análisis (entrenamiento de fuerza en general)",
  B: "Ensayo controlado",
  C: "Laboratorio, biomecánica o EMG",
  D: "Consenso, encuesta, revisión narrativa o caso",
};
