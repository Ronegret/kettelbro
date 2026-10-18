"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "paper";
type Size = "md" | "lg";

interface Common {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
  /** Icono a la izquierda */
  icon?: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  // La tinta del enfoque del día: se hereda de data-focus del contenedor.
  primary: "bg-ink text-on-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_12px_28px_-12px_var(--ink-deep)]",
  paper: "bg-paper text-night shadow-[0_12px_28px_-14px_rgba(0,0,0,0.7)]",
  secondary: "border border-paper/20 text-paper bg-night-3",
  ghost: "text-paper-dim",
};

const SIZE: Record<Size, string> = {
  md: "h-12 px-5 text-[17px] rounded-[14px]",
  lg: "h-16 px-6 text-[22px] rounded-[18px]",
};

function cls({ variant = "primary", size = "md", className = "" }: Pick<Common, "variant" | "size" | "className">) {
  return [
    "press inline-flex items-center justify-center gap-2.5 font-slab select-none disabled:opacity-40 disabled:pointer-events-none",
    VARIANT[variant],
    SIZE[size],
    className,
  ].join(" ");
}

export function Button({ variant, size, className, icon, children, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cls({ variant, size, className })} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size, className, icon, children, href }: Common & { href: string }) {
  return (
    <Link href={href} className={cls({ variant, size, className })}>
      {icon}
      {children}
    </Link>
  );
}
