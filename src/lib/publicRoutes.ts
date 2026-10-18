/**
 * Páginas públicas (indexables, sin sesión). No montan los proveedores de sesión y datos: así el SDK de Firebase
 * no se descarga para quien llega desde un buscador a una guía. `/` (la portada) sí los monta: ahí vive el botón de Google.
 */
export const PUBLIC_PREFIXES = ["/guias", "/ciencia", "/privacidad", "/terminos", "/sobre"] as const;

export function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
