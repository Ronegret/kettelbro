/**
 * Navegadores integrados (el visor interno de TikTok, Instagram, Facebook...). Google bloquea el inicio de sesión OAuth
 * dentro de ellos, así que quien llega desde un enlace compartido puede quedarse sin poder entrar.
 *
 * La detección es por user agent y es una heurística: conviene validarla en teléfonos reales. No se guarda nada.
 */
const IN_APP = /(Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|BytedanceWebview|Snapchat|\bLine\/|LinkedInApp|MicroMessenger)/i;
/** En Android, un WebView genérico declara `; wv)`. */
const ANDROID_WEBVIEW = /; wv\)/i;

export function isInAppBrowser(ua: string): boolean {
  return IN_APP.test(ua) || ANDROID_WEBVIEW.test(ua);
}

/** Dirección que se copia para abrirla en el navegador de verdad, marcada para medir cuánta gente llega por aquí. */
export function externalOpenUrl(origin: string): string {
  return `${origin}/?utm_source=inapp`;
}

/** Copia texto al portapapeles; devuelve si funcionó (los navegadores integrados a veces lo impiden). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
