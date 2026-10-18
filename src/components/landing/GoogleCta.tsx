"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { InAppBrowserNote } from "@/components/screens/InAppBrowserNote";

function GoogleG() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

/**
 * Botón de acceso con Google de la portada. Es la única parte de cliente de la portada junto a la puerta de entrada;
 * todo lo demás se renderiza en el servidor.
 *  - `hero`: botón grande con el aviso de navegador integrado y el error de acceso.
 *  - `compact`: píldora «Entrar» de la cabecera.
 */
export function GoogleCta({ label = "Continuar con Google", variant = "hero" }: { label?: string; variant?: "hero" | "compact" }) {
  const { signInWithGoogle, busy, error, isDemo } = useAuth();

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={busy}
        className="press inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-[15px] font-semibold text-night disabled:opacity-60"
      >
        {busy ? "Conectando…" : "Entrar"}
      </button>
    );
  }

  return (
    <div>
      <InAppBrowserNote />
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={busy}
        className="press flex h-16 w-full items-center justify-center gap-3 rounded-[18px] bg-paper font-body text-[17px] font-semibold text-night shadow-[0_14px_30px_-14px_rgba(0,0,0,0.8)] disabled:opacity-60"
      >
        {busy ? <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-night/30 border-t-night" aria-hidden="true" /> : <GoogleG />}
        {busy ? "Conectando…" : isDemo ? "Entrar en modo demo" : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-[#3a1424] px-4 py-3 text-sm text-[#ffb3c8]">
          {error}
        </p>
      )}
      {isDemo && (
        <p className="mx-auto mt-3 w-fit rounded-md border-2 border-dashed border-paper-mute px-2.5 py-1 font-num text-[14px] font-bold caps text-paper-mute">Modo demo · solo desarrollo</p>
      )}
    </div>
  );
}
