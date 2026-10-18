import { ImageResponse } from "next/og";
import { APP_NAME_DISPLAY } from "@/lib/config";
import { BRAND, BroFace, Rays, brandFonts } from "@/lib/brandArt";

export const alt = "kettellbro: una sesión nueva cada día. Entrenador de pesas rusas con respaldo científico.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Una tarjeta de entrenamiento en miniatura para la portada. */
function Card({ left, top, rot, ink, deep, title, on, children }: { left: number; top: number; rot: number; ink: string; deep: string; title: string; on: string; children?: React.ReactNode }) {
  const w = 300;
  const h = 426;
  const pad = 14;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        display: "flex",
        padding: 0,
        border: "2px solid rgba(255,255,255,0.18)",
        background: ink,
        borderRadius: 34,
        transform: `rotate(${rot}deg)`,
        boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ position: "relative", display: "flex", width: w - 4, height: h - 4, backgroundImage: `linear-gradient(165deg, ${ink} 20%, ${deep} 140%)`, borderRadius: 32, overflow: "hidden" }}>
        <Rays width={w - 4} height={h - 4} color={deep} opacity={0.45} />
        <div style={{ position: "absolute", left: 0, top: 70, width: w - pad * 2, display: "flex", justifyContent: "center" }}>{children}</div>
        <div style={{ position: "absolute", left: 16, bottom: 16, right: 16, height: 66, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(11,14,20,0.82)", borderRadius: 16 }}>
          <div style={{ fontFamily: "Barlow Condensed", fontStyle: "italic", fontWeight: 800, fontSize: 38, color: BRAND.paper, letterSpacing: 1 }}>{title}</div>
        </div>
        <div style={{ position: "absolute", left: 20, top: 6, fontFamily: "Barlow Condensed", fontStyle: "italic", fontWeight: 800, fontSize: 84, color: on, display: "flex" }}>{title === "EL BRO" ? "1" : title === "EL RELOJ" ? "9" : "22"}</div>
      </div>
    </div>
  );
}

/** Portada para redes (WhatsApp, X, Facebook, Slack...): aparece cuando se comparte el dominio. */
export default async function OpengraphImage() {
  const fonts = await brandFonts();
  const inks = [BRAND.vermilion, BRAND.cobalt, BRAND.jade, BRAND.marigold, BRAND.rose, "#4fc9e8"];
  return new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", background: BRAND.night, overflow: "hidden" }}>
        {/* mano de cartas */}
        <Card left={705} top={130} rot={-12} ink={BRAND.cobalt} deep="#14257f" on={BRAND.paper} title="EL GET-UP" />
        <Card left={915} top={118} rot={11} ink={BRAND.jade} deep="#00583f" on={BRAND.night} title="EL RELOJ" />
        <Card left={815} top={76} rot={-3} ink={BRAND.vermilion} deep={BRAND.vermilionDeep} on={BRAND.night} title="EL BRO">
          <BroFace size={250} />
        </Card>

        {/* texto */}
        <div style={{ position: "absolute", left: 64, top: 104, width: 600, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", fontFamily: "Barlow Condensed", fontStyle: "italic", fontWeight: 800, fontSize: 96, lineHeight: 1, color: BRAND.paper, letterSpacing: 1 }}><div style={{ display: "flex", width: 22, height: 74, background: BRAND.vermilion, transform: "skewX(-18deg)", marginRight: 22, borderRadius: 3 }} />{APP_NAME_DISPLAY}</div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 34, fontFamily: "Barlow Condensed", fontStyle: "italic", fontWeight: 800, fontSize: 70, lineHeight: 1.02, color: BRAND.marigold }}>
            <div style={{ display: "flex" }}>UNA SESIÓN NUEVA</div>
            <div style={{ display: "flex" }}>CADA DÍA.</div>
          </div>
          <div style={{ display: "flex", marginTop: 26, fontFamily: "Barlow", fontWeight: 600, fontSize: 32, lineHeight: 1.3, color: "#b3bccd" }}>
            Rutinas de pesa rusa con respaldo científico, que te acompañan en cada serie.
          </div>
          <div style={{ display: "flex", marginTop: 40, gap: 10 }}>
            {inks.map((c) => (
              <div key={c} style={{ display: "flex", width: 54, height: 16, borderRadius: 8, background: c }} />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
