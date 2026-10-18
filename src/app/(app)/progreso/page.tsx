"use client";

import { useEffect, useMemo, useState } from "react";
import { useReadyProgram } from "@/components/RequireProgram";
import { BroBell } from "@/components/ui/BroBell";
import { EXERCISES, FOCUS_LABEL_ES } from "@/lib/engine";
import type { PersonalRecord } from "@/lib/data/repository";
import type { Focus, SessionLog } from "@/lib/engine/types";
import { daysBetween } from "@/lib/engine/calendar";
import { fmtClock, nf } from "@/lib/format";
import { localDateKey } from "@/lib/engine/defaults";

function mondayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = (dt.getUTCDay() + 6) % 7; // lunes = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

function weekBuckets(sessions: SessionLog[], today: string, n = 8) {
  const thisMonday = mondayOf(today);
  const buckets = Array.from({ length: n }, (_, i) => {
    const [y, m, d] = thisMonday.split("-").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d - 7 * (n - 1 - i)));
    return { key: dt.toISOString().slice(0, 10), label: `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`, kg: 0, sessions: 0 };
  });
  for (const s of sessions) {
    if (s.restDay) continue;
    const b = buckets.find((x) => x.key === mondayOf(s.date));
    if (b) {
      b.kg += s.tonnageKg;
      b.sessions += 1;
    }
  }
  return buckets;
}

function dateLabel(dateKey: string, today: string) {
  const diff = daysBetween(dateKey, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const [, m, d] = dateKey.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export default function Progreso() {
  const p = useReadyProgram();
  const [sessions, setSessions] = useState<SessionLog[] | null>(null);
  const [records, setRecords] = useState<PersonalRecord[] | null>(null);
  const [err, setErr] = useState(false);
  const today = localDateKey();

  useEffect(() => {
    let alive = true;
    Promise.all([p.listSessions(80), p.listPersonalRecords()])
      .then(([s, r]) => {
        if (!alive) return;
        setSessions(s);
        setRecords(r);
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.state.totals.sessions, p.state.totals.restDays]);

  const weeks = useMemo(() => weekBuckets(sessions ?? [], today), [sessions, today]);
  const maxKg = Math.max(1, ...weeks.map((w) => w.kg));
  // El mazo: cada carta distinta que has jugado, con cuántas veces
  const deck = useMemo(() => {
    const m = new Map<string, { title: string; focus: Focus; count: number }>();
    for (const s of sessions ?? []) {
      if (s.restDay) continue;
      const cur = m.get(s.title);
      if (cur) cur.count += 1;
      else m.set(s.title, { title: s.title, focus: s.focus as Focus, count: 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [sessions]);
  const t = p.state.totals;
  const empty = t.sessions + t.restDays === 0;

  return (
    <div className="mx-auto max-w-md px-5 pb-6 pt-safe">
      <h1 className="pt-6 font-slab text-[34px] leading-none">Progreso</h1>

      {empty ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <BroBell mood="sleep" size={140} />
          <p className="mt-4 font-slab text-2xl">Aún no hay sesiones</p>
          <p className="mt-1 max-w-[18rem] text-paper-dim">Cuando completes tu primera sesión, aquí verás tu volumen, récords e historial.</p>
        </div>
      ) : (
        <>
          <dl className="mt-5 divide-y divide-seam rounded-[20px] bg-night-2 px-4">
            {[
              [nf(t.sessions), t.sessions === 1 ? "sesión completa" : "sesiones completas"],
              [nf(t.tonnageKg), "kg movidos en total"],
              [nf(t.minutes), t.minutes === 1 ? "minuto entrenado" : "minutos entrenados"],
              [String(p.state.bestStreak), p.state.bestStreak === 1 ? "día: mejor racha" : "días: mejor racha"],
            ].map(([v, l]) => (
              <div key={l} className="flex items-baseline justify-between gap-4 py-3.5">
                <dt className="text-[16px] text-paper-dim">{l}</dt>
                <dd className="heat-num text-[26px] leading-none" style={{ ["--heat" as string]: 0.75 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <section className="mt-8" aria-labelledby="vol">
            <h2 id="vol" className="font-slab text-2xl">
              Volumen por semana
            </h2>
            <p className="text-sm text-paper-mute">Kilos movidos (repeticiones × peso) en las últimas 8 semanas.</p>
            <figure className="mt-4 rounded-[20px] bg-night-2 p-4" aria-label="Gráfica de kilos movidos por semana">
              <svg viewBox="0 0 320 150" className="w-full" role="img" aria-label={weeks.map((w) => `semana del ${w.label}: ${w.kg} kilos`).join(", ")}>
                {[0.5, 1].map((g) => (
                  <line key={g} x1="0" x2="320" y1={118 - g * 96} y2={118 - g * 96} stroke="var(--seam)" strokeWidth="1" strokeDasharray="3 5" />
                ))}
                {weeks.map((w, i) => {
                  const h = Math.max(w.kg > 0 ? 4 : 0, (w.kg / maxKg) * 96);
                  const x = 8 + i * 39;
                  const last = i === weeks.length - 1;
                  return (
                    <g key={w.key}>
                      <rect x={x} y={118 - h} width="26" height={h} rx="5" fill={last ? "var(--ink-lift)" : "var(--ink)"} opacity={last ? 1 : 0.8} />
                      {w.kg > 0 && (
                        <text x={x + 13} y={112 - h} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--paper)" style={{ fontFamily: "var(--font-num)" }}>
                          {w.kg >= 1000 ? `${(w.kg / 1000).toFixed(1)}k` : w.kg}
                        </text>
                      )}
                      <text x={x + 13} y="141" textAnchor="middle" fontSize="13" fill="var(--paper-dim)" style={{ fontFamily: "var(--font-num)" }}>
                        {w.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </figure>
          </section>

          {deck.length > 0 && (
            <section className="mt-8" aria-labelledby="mazo">
              <h2 id="mazo" className="font-slab text-2xl">
                Tus sesiones
              </h2>
              <p className="text-sm text-paper-mute">
                {deck.length} {deck.length === 1 ? "sesión distinta completada" : "sesiones distintas completadas"}. Cada día puede traer una nueva.
              </p>
              <ul className="mt-4 grid grid-cols-3 gap-3">
                {deck.map((c) => (
                  <li
                    key={c.title}
                    data-focus={c.focus}
                    className="relative flex aspect-[5/7] flex-col justify-between rounded-[10px] bg-paper p-[5px] shadow-[0_10px_18px_-12px_rgba(0,0,0,0.7)]"
                  >
                    <span className="flex flex-1 items-start justify-between rounded-[6px] bg-ink px-1.5 pt-1 text-on-ink">
                      <span className="font-num text-[17px] font-extrabold leading-none">×{c.count}</span>
                    </span>
                    <span className="px-0.5 pb-0.5 pt-1 text-center font-slab text-[15px] leading-[1.05] text-night">{c.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8" aria-labelledby="prs">
            <h2 id="prs" className="font-slab text-2xl">
              Récords personales
            </h2>
            {records === null ? (
              <p className="mt-2 text-paper-dim">{err ? "No pudimos cargar tus récords." : "Cargando…"}</p>
            ) : records.length === 0 ? (
              <p className="mt-2 text-paper-dim">Tus mejores series aparecerán aquí.</p>
            ) : (
              <ul className="mt-3 divide-y divide-seam">
                {[...records]
                  .sort((a, b) => b.bellKg - a.bellKg || b.reps - a.reps)
                  .slice(0, 12)
                  .map((r) => (
                    <li key={r.exerciseId} className="flex items-baseline justify-between gap-3 py-3">
                      <span className="font-medium">{EXERCISES[r.exerciseId]?.nameEs ?? r.exerciseId}</span>
                      <span className="font-num text-[17px] font-bold text-ink-lift">
                        {r.bellKg} kg × {r.reps}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="mt-8" aria-labelledby="hist">
            <h2 id="hist" className="font-slab text-2xl">
              Historial
            </h2>
            {sessions === null ? (
              <p className="mt-2 text-paper-dim">{err ? "No pudimos cargar tu historial. Revisa tu conexión." : "Cargando…"}</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {sessions.slice(0, 30).map((s) => (
                  <li key={s.id} data-focus={s.focus} className="flex items-center gap-3.5 rounded-[16px] bg-night-2 p-3">
                    <span className="grid h-14 w-12 shrink-0 place-items-center rounded-[8px] bg-paper text-night">
                      <span className="font-num text-[20px] font-extrabold leading-none">{s.dayIndex}</span>
                      <span className="-mt-3 h-1.5 w-8 rounded-full bg-ink" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-slab text-[17px] leading-tight">{s.restDay ? "Descanso" : s.title}</span>
                      <span className="block text-[14px] text-paper-dim">
                        {dateLabel(s.date, today)} · {FOCUS_LABEL_ES[s.focus as Focus]}
                        {s.restDay ? "" : ` · ${fmtClock(s.durationSec)}`}
                      </span>
                    </span>
                    {!s.restDay && (
                      <span className="text-right font-num text-sm text-paper-dim">
                        <span className="block font-bold text-paper">{nf(s.tonnageKg)} kg</span>
                        RPE {s.rpe}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
