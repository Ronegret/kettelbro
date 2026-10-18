import { BroBell } from "@/components/ui/BroBell";

/** Se muestra solo si faltan las variables de Firebase y no es modo demo: guía clara para configurarlo. */
export function SetupScreen() {
  return (
    <main data-focus="hybrid" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-center gap-4">
        <BroBell mood="sweat" size={88} />
        <h1 className="font-slab text-3xl leading-tight">Falta conectar Firebase</h1>
      </div>
      <p className="text-paper-dim">
        kettellbro guarda tu historial con tu cuenta de Google en Firebase. Aún no hay credenciales en este entorno.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-[15px] text-paper">
        <li>Crea un proyecto en la consola de Firebase y activa <b>Authentication → Google</b>.</li>
        <li>Crea una app web y copia sus datos a <code className="rounded bg-night-3 px-1.5 py-0.5 text-[14px]">.env.local</code> (ver <code className="rounded bg-night-3 px-1.5 py-0.5 text-[14px]">.env.example</code>).</li>
        <li>Activa <b>Firestore</b> y despliega <code className="rounded bg-night-3 px-1.5 py-0.5 text-[14px]">firestore.rules</code>.</li>
        <li>Reinicia el servidor. Para solo previsualizar la interfaz usa <code className="rounded bg-night-3 px-1.5 py-0.5 text-[14px]">NEXT_PUBLIC_DEMO_MODE=1</code> (nunca en producción).</li>
      </ol>
    </main>
  );
}
