/**
 * Elección de la voz del instructor: mujer para Princess, hombre para Bro.
 *
 * La Web Speech API no dice de qué género es cada voz, así que se reconoce por el nombre con el que cada sistema las
 * publica (Microsoft, Apple y Google). Si el teléfono no trae una voz del género pedido (en Android suele haber una sola,
 * femenina), se usa la que haya y se ajusta el tono para que suene claramente distinta.
 */
export type VoiceGender = "female" | "male";

export interface VoiceLike {
  name: string;
  lang: string;
}

const FEMALE = /(helena|laura|sabina|elvira|dalia|m[oó]nica|paulina|marisol|ang[eé]lica|paloma|luc[ií]a|esperanza|elena|camila|catalina|salom[eé]|ximena|valentina|soledad|francisca|mar[ií]a|female|mujer)/i;
const MALE = /(alvaro|álvaro|pablo|raul|raúl|jorge|diego|juan|carlos|gonzalo|jaime|tom[aá]s|andr[eé]s|alonso|ernesto|enrique|manuel|male|hombre)/i;

const isGender = (v: VoiceLike, g: VoiceGender): boolean => (g === "female" ? FEMALE : MALE).test(v.name) && !(g === "female" ? MALE : FEMALE).test(v.name);

/** Tonos: con una voz del género pedido casi natural; sin ella, desplazado para acercarse. */
const PITCH = {
  natural: { female: 1.05, male: 0.9 },
  /** Solo hay voces del otro género o sin identificar. */
  shifted: { female: 1.15, male: 0.62 },
  /** Solo hay una voz masculina y se pide mujer: hay que subirla bastante. */
  maleToFemale: 1.35,
  /** Sin género pedido (comportamiento anterior). */
  neutral: 0.95,
};

export function chooseVoice<T extends VoiceLike>(voices: readonly T[], deviceLang: string, gender?: VoiceGender): { voice: T | undefined; pitch: number } {
  const es = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("es"));
  const dev = deviceLang.toLowerCase();
  // Preferencia dentro de los candidatos: el mismo idioma que el dispositivo, luego es-MX, luego cualquier español.
  const rank = (v: VoiceLike) => (v.lang.toLowerCase() === dev ? 0 : v.lang.toLowerCase().startsWith("es-mx") ? 1 : 2);
  const best = (list: readonly T[]): T | undefined => [...list].sort((a, b) => rank(a) - rank(b))[0];

  if (!gender) return { voice: best(es), pitch: PITCH.neutral };
  const same = es.filter((v) => isGender(v, gender));
  if (same.length) return { voice: best(same), pitch: PITCH.natural[gender] };
  const fallback = best(es);
  if (gender === "female") {
    const maleOnly = fallback ? isGender(fallback, "male") : false;
    return { voice: fallback, pitch: maleOnly ? PITCH.maleToFemale : PITCH.shifted.female };
  }
  return { voice: fallback, pitch: PITCH.shifted.male };
}
