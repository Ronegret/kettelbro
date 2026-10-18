import type { Focus } from "@/lib/engine/types";
import { FOCUS_LABEL_ES } from "@/lib/engine/calendar";
import { INKS, NIGHT, PAPER } from "@/lib/inks";

export interface ShareCardData {
  day: number;
  focus: Focus;
  title: string;
  streak: number;
  tonnageKg: number;
  minutes: number;
  rank: string;
  appName: string;
  /** SVG serializado de la figura (con colores en hex, sin var()). */
  figureSvg?: string;
}

const W = 1080;
const H = 1920;

function fam(varName: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

async function loadSvg(svg: string): Promise<HTMLImageElement | null> {
  try {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.src = url;
    await img.decode();
    URL.revokeObjectURL(url);
    return img;
  } catch {
    return null;
  }
}

/**
 * Genera la imagen vertical (1080×1920) para compartir en historias: la tarjeta del día más tus números.
 * Es el "Wrapped" diario de kettellbro: cada día una tarjeta distinta, lista para publicar.
 */
export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  const slab = fam("--font-display", "sans-serif");
  const num = fam("--font-anybody", "sans-serif");
  const body = fam("--font-body-sans", "sans-serif");
  try {
    await Promise.all([document.fonts.load(`italic 800 80px ${slab}`), document.fonts.load(`800 80px ${num}`), document.fonts.load(`600 40px ${body}`)]);
  } catch {
    /* seguimos con las de respaldo */
  }

  const ink = INKS[d.focus];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;

  // Fondo: tinta profunda del día
  const bg = c.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, ink.deep);
  bg.addColorStop(0.7, NIGHT);
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // Marca
  c.fillStyle = PAPER;
  c.font = `italic 800 84px ${slab}`;
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.fillText(d.appName.toUpperCase(), W / 2, 150);

  // Tarjeta
  const cw = 760;
  const ch = 1080;
  const cx = (W - cw) / 2;
  const cy = 230;
  c.save();
  c.shadowColor = "rgba(0,0,0,0.5)";
  c.shadowBlur = 80;
  c.shadowOffsetY = 40;
  c.fillStyle = ink.ink;
  c.beginPath();
  c.roundRect(cx, cy, cw, ch, 64);
  c.fill();
  c.restore();

  const pad = 0;
  const fx = cx + pad;
  const fy = cy + pad;
  const fw = cw - pad * 2;
  const fh = ch - pad * 2;
  c.save();
  c.beginPath();
  c.roundRect(fx, fy, fw, fh, 64);
  c.clip();
  const field = c.createLinearGradient(fx, fy, fx + fw * 0.5, fy + fh);
  field.addColorStop(0, ink.lift);
  field.addColorStop(0.4, ink.ink);
  field.addColorStop(1, ink.deep);
  c.fillStyle = field;
  c.fillRect(fx, fy, fw, fh);
  // franjas de velocidad
  const sx = fw / 100;
  const sy = fh / 140;
  const poly = (pts: Array<[number, number]>, color: string, alpha: number) => {
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(fx + x * sx, fy + y * sy) : c.moveTo(fx + x * sx, fy + y * sy)));
    c.closePath();
    c.fill();
  };
  poly([[-12, 104], [42, -8], [66, -8], [12, 104]], ink.deep, 0.38);
  poly([[38, 152], [100, 28], [118, 28], [56, 152]], ink.deep, 0.38);
  poly([[26, 150], [88, 18], [96, 18], [34, 150]], "#ffffff", 0.1);
  c.globalAlpha = 1;

  // número del día
  c.fillStyle = ink.on;
  c.textAlign = "left";
  c.font = `800 200px ${num}`;
  c.fillText(String(d.day), fx + 48, fy + 200);

  // etiqueta del enfoque
  const label = FOCUS_LABEL_ES[d.focus].toUpperCase();
  c.font = `italic 800 44px ${slab}`;
  const tw = c.measureText(label).width + 84;
  c.fillStyle = "rgba(11,14,20,0.78)";
  c.beginPath();
  c.roundRect(fx + fw - tw - 40, fy + 48, tw, 76, 38);
  c.fill();
  c.fillStyle = ink.lift;
  c.beginPath();
  c.arc(fx + fw - tw - 40 + 34, fy + 86, 9, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = PAPER;
  c.textAlign = "center";
  c.fillText(label, fx + fw - tw / 2 - 40 + 14, fy + 98);

  // figura
  if (d.figureSvg) {
    const img = await loadSvg(d.figureSvg);
    if (img) {
      const s = 600;
      c.drawImage(img, fx + (fw - s) / 2, fy + 230, s, s);
    }
  }
  c.restore();

  // banner del nombre
  c.fillStyle = "rgba(11,14,20,0.84)";
  c.beginPath();
  c.roundRect(fx + 30, fy + fh - 200, fw - 60, 170, 36);
  c.fill();
  c.fillStyle = PAPER;
  c.textAlign = "center";
  c.font = `italic 800 112px ${slab}`;
  c.fillText(d.title.toUpperCase(), W / 2, fy + fh - 78, fw - 100);

  // estadísticas
  const stats: Array<[string, string]> = [
    [String(d.streak), d.streak === 1 ? "día de racha" : "días de racha"],
    [new Intl.NumberFormat("es-MX").format(d.tonnageKg), "kg movidos"],
    [String(d.minutes), "minutos"],
  ];
  const colW = W / 3;
  stats.forEach(([n, l], i) => {
    const x = colW * i + colW / 2;
    c.fillStyle = PAPER;
    c.textAlign = "center";
    c.font = `800 118px ${num}`;
    c.fillText(n, x, 1500);
    c.fillStyle = ink.lift;
    c.font = `600 38px ${body}`;
    c.fillText(l, x, 1556);
  });

  c.fillStyle = PAPER;
  c.font = `italic 800 72px ${slab}`;
  c.fillText(d.rank.toUpperCase(), W / 2, 1700);
  c.fillStyle = ink.lift;
  c.font = `600 36px ${body}`;
  c.fillText("Una sesión nueva cada día · entrena con ciencia", W / 2, 1790);
  c.fillStyle = PAPER;
  c.globalAlpha = 0.7;
  c.fillText(window.location.host, W / 2, 1850);

  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo crear la imagen"))), "image/png"));
}

/** Comparte con la hoja nativa del teléfono; si no hay, descarga el PNG. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return "shared";
    }
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
