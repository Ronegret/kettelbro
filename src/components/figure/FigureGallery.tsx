"use client";

/**
 * Galería de verificación de las figuras (SOLO desarrollo; la sirve src/app/dev/figures/page.tsx).
 *
 * Parámetros de URL:
 *   ?mode=live|strip   live = animadas · strip = tira de fotogramas por ejercicio (inspección rápida)
 *   ?ids=a,b,c         limita a esos ejercicios
 *   ?frames=7          fotogramas por tira (mode=strip)
 *   ?theme=all|light|dark|field
 *   ?phase=0.25        congela todas las figuras (modo live) en esa fase del ciclo
 */

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { ExerciseId } from "@/lib/engine/types";
import { ExerciseFigure } from "./ExerciseFigure";
import { ANIMATIONS, FIGURE_IDS, FIGURE_LABEL_ES, FIGURE_QUALITY } from "./poses";

interface Theme {
  key: string;
  bg: string;
  ink: string;
  accent: string;
  paper: string;
}

// Paleta del proyecto: noche #0b0e14, papel #f4f6fa, tintas planas.
const THEMES: Theme[] = [
  { key: "light", bg: "#f4f6fa", ink: "#0b0e14", accent: "#f2432d", paper: "#f4f6fa" },
  { key: "dark", bg: "#0b0e14", ink: "#f4f6fa", accent: "#ffb41f", paper: "#0b0e14" },
  { key: "field", bg: "#2a4de8", ink: "#f4f6fa", accent: "#ffb41f", paper: "#2a4de8" },
];
const FIELDS: Array<Pick<Theme, "bg" | "ink" | "accent" | "paper">> = [
  { bg: "#2a4de8", ink: "#f4f6fa", accent: "#ffb41f", paper: "#2a4de8" },
  { bg: "#ffb41f", ink: "#0b0e14", accent: "#f2432d", paper: "#ffb41f" },
  { bg: "#00a878", ink: "#0b0e14", accent: "#f4f6fa", paper: "#00a878" },
  { bg: "#ff5fa2", ink: "#0b0e14", accent: "#f4f6fa", paper: "#ff5fa2" },
  { bg: "#4fc9e8", ink: "#0b0e14", accent: "#f2432d", paper: "#4fc9e8" },
  { bg: "#f2432d", ink: "#0b0e14", accent: "#f4f6fa", paper: "#f2432d" },
];

function pickThemes(sel: string, index: number): Theme[] {
  const field = { key: "field", ...(FIELDS[index % FIELDS.length] as (typeof FIELDS)[number]) };
  if (sel === "light") return [THEMES[0] as Theme];
  if (sel === "dark") return [THEMES[1] as Theme];
  if (sel === "field") return [field];
  return [THEMES[0] as Theme, THEMES[1] as Theme, field];
}

function stripPhases(id: ExerciseId, frames: number): number[] {
  const anim = ANIMATIONS[id];
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    out.push(anim.loop === "pingpong" ? (i / Math.max(1, frames - 1)) * 0.5 : i / frames);
  }
  return out;
}

export function FigureGallery() {
  const sp = useSearchParams();
  const mode = sp.get("mode") === "strip" ? "strip" : "live";
  const themeSel = sp.get("theme") ?? (mode === "strip" ? "light" : "all");
  const frames = Math.max(2, Math.min(14, Number(sp.get("frames") ?? 7) || 7));
  const cols = Math.max(1, Math.min(frames, Number(sp.get("cols")) || frames));
  const fixedPhase = sp.get("phase") !== null ? Number(sp.get("phase")) : undefined;
  const idsParam = sp.get("ids");
  const [playing, setPlaying] = useState(true);
  const [ground, setGround] = useState(true);

  const ids = useMemo<ExerciseId[]>(() => {
    if (!idsParam) return FIGURE_IDS;
    const wanted = idsParam.split(",").map((s) => s.trim());
    return FIGURE_IDS.filter((id) => wanted.includes(id));
  }, [idsParam]);

  const setParam = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString());
    q.set(k, v);
    window.location.search = q.toString();
  };

  return (
    <main style={{ background: "#0b0c1d", color: "#f4f6fa", minHeight: "100dvh", padding: 16 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginRight: 12 }}>Figuras · {ids.length} ejercicios</h1>
        {(["live", "strip"] as const).map((m) => (
          <button key={m} onClick={() => setParam("mode", m)} style={btn(mode === m)}>
            {m === "live" ? "Animadas" : "Tiras de fotogramas"}
          </button>
        ))}
        {(["all", "light", "dark", "field"] as const).map((t) => (
          <button key={t} onClick={() => setParam("theme", t)} style={btn(themeSel === t)}>
            {t}
          </button>
        ))}
        <button onClick={() => setPlaying((p) => !p)} style={btn(!playing)}>
          {playing ? "Pausar" : "Reanudar"}
        </button>
        <button onClick={() => setGround((g) => !g)} style={btn(ground)}>
          Suelo
        </button>
      </header>

      {mode === "live" ? (
        <section style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
          {ids.map((id, i) => (
            <article key={id} style={{ border: "1px solid #2c3649", borderRadius: 12, padding: 8 }}>
              <h2 style={{ fontSize: 13, margin: "0 0 6px", display: "flex", justifyContent: "space-between" }}>
                <span>
                  {FIGURE_LABEL_ES[id]} <code style={{ opacity: 0.55 }}>{id}</code>
                </span>
                <span style={{ opacity: 0.6 }}>
                  {FIGURE_QUALITY[id]} · {ANIMATIONS[id].cycleSec}s
                </span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${pickThemes(themeSel, i).length}, 1fr)`, gap: 6 }}>
                {pickThemes(themeSel, i).map((t) => (
                  <div key={t.key} style={{ background: t.bg, borderRadius: 8 }}>
                    <ExerciseFigure
                      exerciseId={id}
                      ink={t.ink}
                      accent={t.accent}
                      paper={t.paper}
                      playing={playing}
                      showGround={ground}
                      {...(fixedPhase !== undefined ? { phase: fixedPhase } : {})}
                    />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section style={{ display: "grid", gap: 18 }}>
          {ids.map((id, i) => {
            const themes = pickThemes(themeSel, i);
            const ph = stripPhases(id, frames);
            return (
              <article key={id}>
                <h2 style={{ fontSize: 13, margin: "0 0 4px" }}>
                  {FIGURE_LABEL_ES[id]} <code style={{ opacity: 0.55 }}>{id}</code>{" "}
                  <span style={{ opacity: 0.6 }}>
                    {ANIMATIONS[id].loop} · {FIGURE_QUALITY[id]}
                  </span>
                </h2>
                {themes.map((t) => (
                  <div
                    key={t.key}
                    style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, marginBottom: 3 }}
                  >
                    {ph.map((p, k) => (
                      <div key={k} style={{ background: t.bg, borderRadius: 6, position: "relative" }}>
                        <ExerciseFigure
                          exerciseId={id}
                          ink={t.ink}
                          accent={t.accent}
                          paper={t.paper}
                          showGround={ground}
                          phase={p}
                        />
                        <span style={{ position: "absolute", left: 4, top: 2, fontSize: 9, color: t.ink, opacity: 0.6 }}>
                          {p.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function btn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid #2c3649",
    background: active ? "#f4f6fa" : "transparent",
    color: active ? "#0b0e14" : "#f4f6fa",
    fontSize: 13,
  };
}
