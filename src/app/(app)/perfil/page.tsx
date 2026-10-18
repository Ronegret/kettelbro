"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { useReadyProgram } from "@/components/RequireProgram";
import { OnboardingFlow } from "@/components/screens/Onboarding";
import { Button } from "@/components/ui/Button";
import { InstructorPicker } from "@/components/figure3d/InstructorPicker";
import { set3dEnabled, use3dEnabled } from "@/components/figure3d/prefs";
import { Switch } from "@/components/ui/Controls";
import { Icon } from "@/components/ui/Icon";
import { rankFor } from "@/lib/engine";
import type { UserSettings } from "@/lib/engine/types";
import { APP_NAME } from "@/lib/config";
import evidence from "@/content/evidence.json";
import { nf } from "@/lib/format";

const LEVEL_ES = { novice: "Novato", intermediate: "Intermedio", advanced: "Avanzado" } as const;
const GOAL_ES = { balanced: "Equilibrado", strength: "Fuerza", power: "Potencia", endurance: "Resistencia" } as const;

export default function Perfil() {
  const p = useReadyProgram();
  const { signOut, isDemo } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [lib, setLib] = useState(false);
  const rank = rankFor(p.state.xp);
  const s = p.settings;
  const fig3d = use3dEnabled();

  const patch = (v: Partial<UserSettings>) => void p.saveSettings({ ...s, ...v });

  if (editing) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-night">
        <OnboardingFlow
          mode="edit"
          initial={s}
          onCancel={() => setEditing(false)}
          onDone={async (next) => {
            await p.saveSettings(next);
            setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 pb-6 pt-safe">
      <header className="flex items-center gap-4 pt-6">
        {p.user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.user.photoURL} alt="" width={64} height={64} referrerPolicy="no-referrer" className="h-16 w-16 rounded-full border-[3px] border-paper object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-paper bg-ink font-slab text-2xl text-on-ink">{p.user.displayName.slice(0, 1).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-slab text-[28px] leading-tight">{p.user.displayName}</h1>
          <p className="truncate text-[14px] text-paper-dim">{p.user.email ?? (isDemo ? "Modo demo (solo este navegador)" : "Cuenta de Google")}</p>
        </div>
      </header>

      <section className="mt-6 rounded-[20px] bg-night-2 p-4" aria-label="Resumen">
        <div className="flex items-baseline justify-between">
          <p className="font-slab text-xl">{rank.name}</p>
          <p className="font-num text-sm text-paper-dim">{nf(p.state.xp)} XP</p>
        </div>
        <p className="mt-1 text-[14.5px] text-paper-dim">
          Día {p.state.dayIndex} · {p.state.totals.sessions} sesiones · racha actual {p.state.streak}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="plan">
        <div className="flex items-center justify-between">
          <h2 id="plan" className="font-slab text-2xl">
            Tu plan
          </h2>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
          {[
            ["Nivel", LEVEL_ES[s.level]],
            ["Meta", GOAL_ES[s.primaryGoal]],
            ["Duración", `${s.minutes} min`],
            ["Referencia", `${s.referenceKg} kg`],
            ["Pesas", s.bells.join(", ") + " kg"],
            ["Dos iguales", s.hasPairs ? "Sí" : "No"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[14px] text-paper-mute">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8" aria-labelledby="instructor">
        <h2 id="instructor" className="font-slab text-2xl">
          Tu instructor
        </h2>
        <p className="mt-1 text-[15px] text-paper-dim">Quién te muestra cada ejercicio durante la sesión.</p>
        <div className="mt-3 space-y-2.5">
          <InstructorPicker />
          <Switch checked={fig3d} onChange={set3dEnabled} label="Figuras en 3D" description="Si tu teléfono va justo, apágalo y verás la figura sencilla de siempre." />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="pesas">
        <h2 id="pesas" className="font-slab text-2xl">
          Mis pesas y mi cuerpo
        </h2>
        <p className="mt-1 text-[15px] text-paper-dim">Registra qué pesas tienes, recibe una sugerencia según tu peso y estatura y programa tus pesajes.</p>
        <Link href="/pesas" className="press mt-3 inline-flex h-12 items-center gap-2 rounded-[14px] border-2 border-paper/25 bg-night-2/60 px-5 font-slab text-[15px] caps">
          <Icon name="weight" size={20} /> Abrir
        </Link>
      </section>

      <section className="mt-8 space-y-2.5" aria-labelledby="ajustes">
        <h2 id="ajustes" className="font-slab text-2xl">
          Acompañante y cuidados
        </h2>
        <Switch checked={s.sound} onChange={(v) => patch({ sound: v })} label="Sonidos" description="Cuenta atrás y metrónomo." />
        <Switch checked={s.voice} onChange={(v) => patch({ voice: v })} label="Voz del coach" description="Habla tu instructor: voz de mujer con Princess y de hombre con Bro, según las voces de tu teléfono." />
        <Switch checked={s.haptics} onChange={(v) => patch({ haptics: v })} label="Vibración" />
        <Switch checked={Boolean(s.lowBackCare)} onChange={(v) => patch({ lowBackCare: v })} label="Cuidado de espalda baja" description="Sin ejercicios balísticos como el swing." />
      </section>

      <section className="mt-8" aria-labelledby="ciencia">
        <h2 id="ciencia" className="font-slab text-2xl">
          Cómo se arma tu rutina
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-paper-dim">
          Cada día se genera con un calendario de 4 semanas (acumular, construir, pico y descarga), formatos documentados de entrenamiento con pesa rusa y tu esfuerzo
          percibido de la sesión anterior. Los estudios tienen limitaciones y las citas se muestran tal cual.
        </p>
        <button type="button" onClick={() => setLib(true)} className="press mt-3 inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink-lift/60 px-4 text-[14.5px] font-medium text-ink-lift">
          <Icon name="book" size={18} /> Biblioteca de estudios ({evidence.length})
        </button>
      </section>

      <section className="mt-8" aria-labelledby="invitar">
        <h2 id="invitar" className="font-slab text-2xl">
          Invita a un bro
        </h2>
        <p className="mt-2 text-[15px] leading-snug text-paper-dim">Entrenar acompañado engancha más. Comparte {APP_NAME} y cada uno juega su propia carta del día.</p>
        <Button
          variant="secondary"
          className="mt-3"
          icon={<Icon name="share" size={20} />}
          onClick={async () => {
            const url = window.location.origin;
            const text = `Entreno con ${APP_NAME}: una sesión nueva cada día, pesa rusa con respaldo científico.`;
            try {
              if (navigator.share) await navigator.share({ title: APP_NAME, text, url });
              else await navigator.clipboard.writeText(`${text} ${url}`);
            } catch {
              /* cancelado por el usuario */
            }
          }}
        >
          Compartir {APP_NAME}
        </Button>
      </section>

      <section className="mt-8 rounded-[16px] bg-night-2 p-4 text-[14px] leading-snug text-paper-dim" aria-label="Aviso de salud">
        {APP_NAME} no sustituye el consejo médico. Detén la sesión si sientes dolor agudo, mareo, hormigueo o dolor en el pecho, y consulta a un profesional.
      </section>

      <div className="mt-8">
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          icon={<Icon name="logout" size={20} />}
          onClick={async () => {
            await signOut();
            router.replace("/");
          }}
        >
          Cerrar sesión
        </Button>
        {p.pending > 0 && <p className="mt-3 text-center text-sm text-paper-mute">Aún hay cambios sincronizándose; tu historial queda a salvo en la nube.</p>}
      </div>

      <EvidenceSheet open={lib} onClose={() => setLib(false)} ids={(evidence as Array<{ id: string }>).map((e) => e.id)} title="Biblioteca de estudios" />
    </div>
  );
}
