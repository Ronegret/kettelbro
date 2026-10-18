"use client";

/**
 * Laboratorio de los personajes 3D (SOLO desarrollo).
 *
 * Parámetros de URL (todos opcionales): char=bro|princess · ex=<exerciseId> · view=side|front|three-quarter|auto|angle|<grados>
 * (sin view = la mejor vista del ejercicio) · rep=<segundos por repetición> · ink=power|strength|endurance|hybrid|skill|recovery
 * side=left|right|both · tone=dark|light · ground=0|1 · playing=0|1 · keep=1 · grid=1 (cuatro vistas a la vez) · cmp=1 (junto a la 2D)
 * nogl=1 (simula que no hay WebGL: debe verse la 2D) · size=<px>
 *
 * El motor (three) se pide con import() dinámico: así esta página mide lo mismo que verá una pantalla real (el visor es un trozo aparte).
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExerciseArt } from "@/components/figure/ExerciseArt";
import { FIGURE_IDS, FIGURE_LABEL_ES } from "@/components/figure/poses";
import { Figure3D } from "@/components/figure3d/Figure3D";
import { gate } from "@/components/figure3d/gate";
import {
  CHARACTERS,
  FIGURE_VIEW_OPTIONS,
  isCharacterId,
  parseView,
  readCharacter,
  saveCharacter,
  saveFigView,
  type CharacterId,
  type Figure3DStatus,
  type FigureSide,
  type FigureViewInput,
} from "@/components/figure3d/types";
import type { ExerciseId, Focus } from "@/lib/engine/types";

const FOCI: Focus[] = ["power", "strength", "endurance", "hybrid", "skill", "recovery"];
const FOCUS_DOT: Record<Focus, string> = { power: "#f2432d", strength: "#2a4de8", endurance: "#00a878", hybrid: "#ffb41f", skill: "#ff5fa2", recovery: "#4fc9e8" };
const SIDES: FigureSide[] = ["right", "left", "both"];

interface Stats {
  rafFps: number;
  renderFps: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  gpu: string;
  gl: string;
  views: number;
  losses: number;
}

type Engine = typeof import("@/components/figure3d/engine");
type Assets = typeof import("@/components/figure3d/assets");

declare global {
  interface Window {
    __fig3dLab?: {
      stress(n?: number): Promise<unknown>;
      loseContext(restoreAfterMs: number | null): Promise<boolean>;
      restoreContext(): Promise<boolean>;
      stats(): Promise<unknown>;
      status(): Figure3DStatus | null;
      /** performance.now() (desde el inicio de la navegación) del primer estado "ready". */
      readyAt(): number | null;
    };
  }
}

const num = (v: string | null, d: number): number => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? n : d;
};

export function Figures3DLab() {
  const sp = useSearchParams();
  const exParam = sp.get("ex") as ExerciseId | null;
  const [character, setCharacter] = useState<CharacterId>(isCharacterId(sp.get("char")) ? (sp.get("char") as CharacterId) : "bro");
  const [exerciseId, setExerciseId] = useState<ExerciseId>(exParam && FIGURE_IDS.includes(exParam) ? exParam : "goblet-squat");
  const [view, setView] = useState<FigureViewInput | undefined>(parseView(sp.get("view")) ?? undefined);
  const [rep, setRep] = useState<number>(num(sp.get("rep"), 0)); // 0 = ritmo natural del clip
  const [focus, setFocus] = useState<Focus>((FOCI.includes(sp.get("ink") as Focus) ? sp.get("ink") : "power") as Focus);
  const [side, setSide] = useState<FigureSide>((SIDES.includes(sp.get("side") as FigureSide) ? sp.get("side") : "right") as FigureSide);
  const [tone, setTone] = useState<"dark" | "light">(sp.get("tone") === "light" ? "light" : "dark");
  const [ground, setGround] = useState(sp.get("ground") !== "0");
  const [playing, setPlaying] = useState(sp.get("playing") !== "0");
  const [keep, setKeep] = useState(sp.get("keep") === "1");
  const [grid] = useState(sp.get("grid") === "1");
  const [cmp, setCmp] = useState(sp.get("cmp") === "1");
  const [mounted, setMounted] = useState(true);
  const [status, setStatus] = useState<Figure3DStatus | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [report, setReport] = useState<string>("");
  const size = sp.get("size") ?? "min(92vw, 520px)";
  const statusRef = useRef<Figure3DStatus | null>(null);
  const readyAtRef = useRef<number | null>(null);

  if (sp.get("nogl") === "1") gate.dead = true;

  // El personaje guardado (kb:character) solo se lee si la URL no manda: así se prueba la clave que unificará la 2D.
  useEffect(() => {
    if (!sp.get("char")) setCharacter(readCharacter());
  }, [sp]);

  const onStatus = useCallback((s: Figure3DStatus) => {
    statusRef.current = s;
    if (s.state === "ready" && readyAtRef.current === null) readyAtRef.current = performance.now();
    setStatus(s);
  }, []);

  // Contadores: fps del navegador (rAF), fotogramas dibujados por segundo y memoria de GPU.
  useEffect(() => {
    let alive = true;
    let eng: Engine | undefined;
    let raf = 0;
    let rafFrames = 0;
    let lastDrawn = 0;
    let lastT = performance.now();
    const tick = (): void => {
      rafFrames++;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    void import("@/components/figure3d/engine").then((m) => {
      eng = m;
    });
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - lastT) / 1000;
      lastT = now;
      const st = eng?.getStats();
      if (!alive) return;
      setStats({
        rafFps: rafFrames / dt,
        renderFps: st ? (st.frames - lastDrawn) / dt : 0,
        calls: st?.calls ?? 0,
        triangles: st?.triangles ?? 0,
        geometries: st?.geometries ?? 0,
        textures: st?.textures ?? 0,
        dpr: st?.dpr ?? 0,
        gpu: st?.gpu ?? "",
        gl: st?.status ?? "-",
        views: st?.views ?? 0,
        losses: st?.losses ?? 0,
      });
      lastDrawn = st?.frames ?? 0;
      rafFrames = 0;
    }, 1000);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  // Herramientas de prueba para Playwright (esta página no existe en producción).
  useEffect(() => {
    const heap = (): number | null => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    window.__fig3dLab = {
      stats: async () => (await import("@/components/figure3d/engine")).getStats(),
      status: () => statusRef.current,
      readyAt: () => readyAtRef.current,
      loseContext: async (ms) => (await import("@/components/figure3d/engine")).debugLoseContext(ms),
      restoreContext: async () => (await import("@/components/figure3d/engine")).debugRestoreContext(),
      /** Monta y desmonta la figura n veces y compara memoria (heap de JS y recursos de GPU) con el punto de partida. */
      stress: async (n = 20) => {
        const eng: Engine = await import("@/components/figure3d/engine");
        const assets: Assets = await import("@/components/figure3d/assets");
        const gc = (globalThis as { gc?: () => void }).gc;
        gc?.();
        const before = { heap: heap(), ...pick(eng.getStats()) };
        const mid: unknown[] = [];
        for (let i = 0; i < n; i++) {
          setMounted(true);
          await wait(700);
          setMounted(false);
          await wait(250);
          if (i === 0 || i === n - 1) mid.push({ i, heap: heap(), ...pick(eng.getStats()) });
        }
        setMounted(true);
        await wait(900);
        const withOne = { heap: heap(), ...pick(eng.getStats()) };
        setMounted(false);
        await wait(300);
        assets.purge(); // libera geometrías, materiales y textura de gradiente del personaje (el renderer sigue vivo para poder contarlo)
        await wait(400);
        const afterPurge = { heap: heap(), ...pick(eng.getStats()) };
        eng.debugDisposeRenderer();
        return { n, gcExposed: !!gc, before, mid, withOne, afterPurge };
      },
    };
    return () => {
      delete window.__fig3dLab;
    };
  }, []);

  const pickExercise = (id: ExerciseId): void => {
    setExerciseId(id);
  };
  const pickView = (v: FigureViewInput | undefined): void => {
    setView(v);
    if (v !== undefined) saveFigView(exerciseId, v);
  };
  const pickCharacter = (c: CharacterId): void => {
    setCharacter(c);
    saveCharacter(c);
  };

  const repSec = rep > 0 ? rep : undefined;
  const field = tone === "dark" ? "var(--ink)" : "var(--ink-deep)";
  const common = { exerciseId, playing, repSec, tone, showGround: ground, character, side, keepFacing: keep, onStatus } as const;

  return (
    <main data-focus={focus} style={{ background: "#0b0c1d", color: "#f4f6fa", minHeight: "100dvh", padding: 12, fontSize: 13 }}>
      <header style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
        <strong style={{ marginRight: 6 }}>Figuras 3D</strong>
        <select aria-label="Personaje" value={character} onChange={(e) => pickCharacter(e.target.value as CharacterId)} style={sel}>
          {CHARACTERS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Ejercicio" value={exerciseId} onChange={(e) => pickExercise(e.target.value as ExerciseId)} style={{ ...sel, maxWidth: 220 }}>
          {FIGURE_IDS.map((id) => (
            <option key={id} value={id}>
              {FIGURE_LABEL_ES[id]} ({id})
            </option>
          ))}
        </select>
        <select
          aria-label="Vista"
          value={view === undefined ? "default" : typeof view === "number" ? "num" : view}
          onChange={(e) => pickView(e.target.value === "default" ? undefined : e.target.value === "num" ? 20 : (e.target.value as FigureViewInput))}
          style={sel}
        >
          <option value="default">vista por defecto</option>
          {FIGURE_VIEW_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          <option value="angle">angle</option>
          <option value="num">grados…</option>
        </select>
        {typeof view === "number" ? (
          <label style={lbl}>
            yaw {view}°
            <input aria-label="Yaw en grados" type="range" min={-180} max={180} step={5} value={view} onChange={(e) => pickView(Number(e.target.value))} />
          </label>
        ) : null}
        <label style={lbl}>
          {rep > 0 ? `${rep.toFixed(1)} s/rep` : "ritmo natural"}
          <input aria-label="Segundos por repetición" type="range" min={0} max={8} step={0.5} value={rep} onChange={(e) => setRep(Number(e.target.value))} />
        </label>
        <span style={{ display: "inline-flex", gap: 4 }} role="group" aria-label="Tinta del día">
          {FOCI.map((f) => (
            <button key={f} aria-label={`Tinta ${f}`} onClick={() => setFocus(f)} style={{ ...dot, background: FOCUS_DOT[f], outline: focus === f ? "3px solid #f4f6fa" : "none" }} />
          ))}
        </span>
        {SIDES.map((s) => (
          <button key={s} onClick={() => setSide(s)} style={btn(side === s)}>
            {s === "right" ? "derecha" : s === "left" ? "izquierda" : "ambas"}
          </button>
        ))}
        <button onClick={() => setTone((t) => (t === "dark" ? "light" : "dark"))} style={btn(tone === "light")}>
          tono {tone}
        </button>
        <button onClick={() => setGround((g) => !g)} style={btn(ground)}>
          suelo
        </button>
        <button onClick={() => setPlaying((p) => !p)} style={btn(!playing)}>
          {playing ? "pausar" : "reanudar"}
        </button>
        <button onClick={() => setKeep((k) => !k)} style={btn(keep)}>
          mantener mirada
        </button>
        <button onClick={() => setCmp((c) => !c)} style={btn(cmp)}>
          2D al lado
        </button>
        <button onClick={() => setMounted((m) => !m)} style={btn(!mounted)}>
          {mounted ? "desmontar" : "montar"}
        </button>
        <button
          onClick={async () => setReport(JSON.stringify(await window.__fig3dLab?.stress(20), null, 1))}
          style={btn(false)}
        >
          montar/desmontar ×20
        </button>
        <button onClick={() => void window.__fig3dLab?.loseContext(1500)} style={btn(false)}>
          perder contexto (1,5 s)
        </button>
      </header>

      <section
        aria-label="Estado"
        style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", marginBottom: 10, fontFamily: "ui-monospace, monospace", fontSize: 12, opacity: 0.9 }}
      >
        <span data-testid="state">estado {status?.state ?? "-"}</span>
        <span data-testid="clip">
          clip {status?.clip ?? "-"}
          {status?.usedIdle ? " (idle de respaldo)" : ""}
        </span>
        <span data-testid="raf">rAF {stats ? stats.rafFps.toFixed(0) : "-"} fps</span>
        <span data-testid="fps">dibujo {stats ? stats.renderFps.toFixed(0) : "-"} fps</span>
        <span data-testid="calls">llamadas {stats?.calls ?? "-"}</span>
        <span data-testid="tris">triángulos {stats?.triangles ?? "-"}</span>
        <span>geometrías {stats?.geometries ?? "-"}</span>
        <span>texturas {stats?.textures ?? "-"}</span>
        <span>dpr {stats?.dpr ?? "-"}</span>
        <span>gl {stats?.gl ?? "-"} · pérdidas {stats?.losses ?? 0} · vistas {stats?.views ?? 0}</span>
        <span style={{ opacity: 0.7 }}>{stats?.gpu}</span>
        {status?.error ? <span style={{ color: "#ff9ac4" }}>error: {status.error}</span> : null}
      </section>

      {mounted ? (
        grid ? (
          <section style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {(["side", "front", "three-quarter", "auto"] as const).map((v) => (
              <figure key={v} style={{ margin: 0 }}>
                <div style={{ background: field, borderRadius: 12, display: "grid", placeItems: "center", padding: 4 }}>
                  <Figure3D {...common} view={v} size={sp.get("size") ?? "min(44vw, 260px)"} />
                </div>
                <figcaption style={{ textAlign: "center", opacity: 0.7, marginTop: 2 }}>{v}</figcaption>
              </figure>
            ))}
          </section>
        ) : (
          <section style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <div style={{ background: field, borderRadius: 16, display: "grid", placeItems: "center", padding: 4 }}>
              <Figure3D {...common} view={view} size={size} />
            </div>
            {cmp ? (
              <div style={{ background: field, borderRadius: 16, display: "grid", placeItems: "center", padding: 4 }}>
                <ExerciseArt exerciseId={exerciseId} size={size} playing={playing} repSec={repSec} tone={tone} showGround={ground} />
              </div>
            ) : null}
          </section>
        )
      ) : null}

      {report ? (
        <pre data-testid="report" style={{ marginTop: 12, fontSize: 11, whiteSpace: "pre-wrap" }}>
          {report}
        </pre>
      ) : null}
    </main>
  );
}

function pick(s: { geometries: number; textures: number; views: number; status: string }): { geometries: number; textures: number; views: number; status: string } {
  return { geometries: s.geometries, textures: s.textures, views: s.views, status: s.status };
}

const sel: React.CSSProperties = { padding: "5px 8px", borderRadius: 8, border: "1px solid #2c3649", background: "#121722", color: "#f4f6fa", fontSize: 13 };
const lbl: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6 };
const dot: React.CSSProperties = { width: 26, height: 26, borderRadius: 999, border: "2px solid #0b0e14" };
function btn(active: boolean): React.CSSProperties {
  return { padding: "5px 10px", borderRadius: 999, border: "1px solid #2c3649", background: active ? "#f4f6fa" : "transparent", color: active ? "#0b0e14" : "#f4f6fa", fontSize: 13 };
}
