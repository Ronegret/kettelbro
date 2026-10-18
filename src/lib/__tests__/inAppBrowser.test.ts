import { describe, expect, it } from "vitest";
import { externalOpenUrl, isInAppBrowser } from "../inAppBrowser";

describe("navegador integrado", () => {
  it("detecta los visores internos más comunes", () => {
    const uas = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.20.113",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.38.109]",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 musical_ly_33.1.0 BytedanceWebview/d8a21c6",
      "Mozilla/5.0 (Linux; Android 13; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36",
    ];
    for (const ua of uas) expect(isInAppBrowser(ua)).toBe(true);
  });
  it("no marca los navegadores normales", () => {
    const uas = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
    ];
    for (const ua of uas) expect(isInAppBrowser(ua)).toBe(false);
  });
  it("el enlace para abrir fuera lleva la marca de origen", () => {
    expect(externalOpenUrl("https://kettellbro.vercel.app")).toBe("https://kettellbro.vercel.app/?utm_source=inapp");
  });
});
