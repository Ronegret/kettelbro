/**
 * La marca de «día hecho»: una insignia redonda con su visto. Se coloca sobre cada día completado
 * (el nombre del componente y su animación de caída se conservan por sus usos).
 */
export function Bean({ drop = false, className = "", size = 22 }: { drop?: boolean; className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      style={drop ? { animation: "bean-drop 0.8s var(--ease-out) both" } : undefined}
      aria-hidden="true"
    >
      <circle cx="12" cy="12.8" r="10" fill="#000" opacity="0.28" />
      <circle cx="12" cy="12" r="10" fill="var(--paper)" />
      <path d="m7.2 12.4 3.3 3.3 6.3-6.6" fill="none" stroke="var(--ink-deep)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
