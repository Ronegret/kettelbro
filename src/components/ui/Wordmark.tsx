/**
 * La marca: KETTELLBRO en condensada cursiva con una franja de velocidad en tinta. Con `plate` va sobre una placa
 * inclinada de la tinta del día, para que destaque en cualquier fondo.
 */
const SIZES = {
  md: { text: "text-[32px]", pad: "px-3 py-1.5", bar: "h-[0.78em] w-[0.28em]" },
  lg: { text: "text-[44px]", pad: "px-4 py-2", bar: "h-[0.78em] w-[0.28em]" },
  xl: { text: "text-[clamp(38px,12vw,60px)]", pad: "px-5 py-2.5", bar: "h-[0.78em] w-[0.28em]" },
} as const;

export function Wordmark({ size = "lg", plate = false, className = "" }: { size?: keyof typeof SIZES; plate?: boolean; className?: string }) {
  const s = SIZES[size];
  if (!plate) {
    return (
      <span className={`inline-flex items-center gap-[0.18em] font-slab leading-none ${s.text} ${className}`}>
        <span aria-hidden="true" className={`inline-block -skew-x-[18deg] rounded-[2px] bg-ink-lift ${s.bar}`} />
        KETTELLBRO
      </span>
    );
  }
  return (
    <span className={`inline-block -skew-x-[10deg] rounded-[10px] bg-ink text-on-ink shadow-[0_14px_30px_-16px_rgba(0,0,0,0.8)] ${s.pad} ${className}`}>
      <span className={`block skew-x-[10deg] font-slab leading-none ${s.text}`}>KETTELLBRO</span>
    </span>
  );
}
