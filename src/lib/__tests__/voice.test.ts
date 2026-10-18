import { describe, expect, it } from "vitest";
import { chooseVoice } from "../voice";

const v = (name: string, lang: string) => ({ name, lang });

describe("voz del instructor", () => {
  const windows = [v("Microsoft Helena - Spanish (Spain)", "es-ES"), v("Microsoft Pablo - Spanish (Spain)", "es-ES"), v("Microsoft Sabina - Spanish (Mexico)", "es-MX"), v("Microsoft Raul - Spanish (Mexico)", "es-MX"), v("Microsoft Zira - English (US)", "en-US")];

  it("Princess usa una voz de mujer y Bro una de hombre cuando el sistema las trae", () => {
    expect(chooseVoice(windows, "es-ES", "female").voice?.name).toContain("Helena");
    expect(chooseVoice(windows, "es-ES", "male").voice?.name).toContain("Pablo");
  });
  it("prefiere el español del dispositivo y luego es-MX", () => {
    expect(chooseVoice(windows, "es-MX", "female").voice?.name).toContain("Sabina");
    expect(chooseVoice(windows, "es-MX", "male").voice?.name).toContain("Raul");
    expect(chooseVoice(windows, "es-AR", "male").voice?.name).toContain("Raul"); // sin es-AR, cae a es-MX
  });
  it("ignora las voces que no son españolas", () => {
    expect(chooseVoice([v("Microsoft Zira - English (US)", "en-US")], "es-ES", "female").voice).toBeUndefined();
  });
  it("con una sola voz (Android) la usa y baja el tono para Bro, sin tocar casi el de Princess", () => {
    const android = [v("Google español", "es-ES")];
    const bro = chooseVoice(android, "es-ES", "male");
    const princess = chooseVoice(android, "es-ES", "female");
    expect(bro.voice?.name).toBe("Google español");
    expect(princess.voice?.name).toBe("Google español");
    expect(bro.pitch).toBeLessThan(0.7);
    expect(princess.pitch).toBeGreaterThan(1);
    expect(princess.pitch).toBeGreaterThan(bro.pitch + 0.4);
  });
  it("si solo hay voces masculinas y se pide mujer, sube mucho el tono", () => {
    const r = chooseVoice([v("Microsoft Pablo - Spanish (Spain)", "es-ES")], "es-ES", "female");
    expect(r.voice?.name).toContain("Pablo");
    expect(r.pitch).toBeGreaterThan(1.3);
  });
  it("sin género pedido conserva el comportamiento anterior", () => {
    expect(chooseVoice(windows, "es-ES").pitch).toBe(0.95);
  });
  it("reconoce las voces de Apple", () => {
    const apple = [v("Mónica", "es-ES"), v("Jorge", "es-ES"), v("Paulina", "es-MX"), v("Juan", "es-MX")];
    expect(chooseVoice(apple, "es-ES", "female").voice?.name).toBe("Mónica");
    expect(chooseVoice(apple, "es-ES", "male").voice?.name).toBe("Jorge");
    expect(chooseVoice(apple, "es-MX", "female").voice?.name).toBe("Paulina");
    expect(chooseVoice(apple, "es-MX", "male").voice?.name).toBe("Juan");
  });
});
