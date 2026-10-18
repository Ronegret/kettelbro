"use client";

import { useReadyProgram } from "@/components/RequireProgram";
import { Icon } from "@/components/ui/Icon";
import { evaluateGoals } from "@/lib/engine";
import type { GoalKind, GoalProgress } from "@/lib/engine/types";
import { nf } from "@/lib/format";

const GROUPS: Array<{ kind: GoalKind; title: string }> = [
  { kind: "streak", title: "Racha" },
  { kind: "sessions", title: "Sesiones" },
  { kind: "day", title: "Programa" },
  { kind: "swings", title: "Swings" },
  { kind: "benchmark", title: "Get-ups" },
  { kind: "bell", title: "Tu pesa más alta" },
  { kind: "tonnage", title: "Kilos movidos" },
];

export default function Metas() {
  const p = useReadyProgram();
  const goals = evaluateGoals(p.state);
  const done = goals.filter((g) => g.done).length;

  return (
    <div className="mx-auto max-w-md px-5 pb-6 pt-safe">
      <h1 className="pt-6 font-slab text-[34px] leading-none">Metas</h1>
      <p className="mt-2 text-paper-dim">
        <span className="heat-num text-[22px] text-paper" style={{ ["--heat" as string]: 0.9 }}>
          {done}
        </span>{" "}
        de {goals.length} cumplidas. Se calculan solas con tus sesiones reales.
      </p>

      <div className="mt-6 space-y-8">
        {GROUPS.map((g) => {
          const list = goals.filter((x) => x.kind === g.kind);
          if (!list.length) return null;
          // Primero lo que está más cerca de cumplirse
          const sorted = [...list].sort((a, b) => Number(a.done) - Number(b.done) || b.progress / b.target - a.progress / a.target);
          return (
            <section key={g.kind} aria-label={g.title}>
              <h2 className="font-slab text-xl">{g.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {sorted.map((goal) => (
                  <GoalRow key={goal.id} goal={goal} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function GoalRow({ goal }: { goal: GoalProgress }) {
  const pct = Math.round((goal.progress / goal.target) * 100);
  return (
    <li className={`rounded-[18px] p-4 ${goal.done ? "bg-ink/20" : "bg-night-2"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${goal.done ? "bg-ink text-on-ink" : "border-2 border-paper-mute text-transparent"}`} aria-hidden="true">
          <Icon name="check" size={16} strokeWidth={3.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-slab text-[18px] leading-tight">{goal.titleEs}</p>
          <p className="mt-0.5 text-[14.5px] leading-snug text-paper-dim">{goal.descriptionEs}</p>
          {goal.source && <p className="mt-0.5 text-[14px] text-ink-lift">Referencia: {goal.source}</p>}
        </div>
        <p className="shrink-0 font-num text-sm font-bold text-paper-dim">
          {nf(goal.progress)}/{nf(goal.target)}
        </p>
      </div>
      {!goal.done && (
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-night-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.titleEs}: ${pct}%`}>
          <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      )}
    </li>
  );
}
