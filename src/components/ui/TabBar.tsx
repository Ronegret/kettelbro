"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/hoy", label: "Hoy", icon: "card" },
  { href: "/progreso", label: "Progreso", icon: "chart" },
  { href: "/metas", label: "Metas", icon: "flag" },
  { href: "/perfil", label: "Perfil", icon: "user" },
];

/** Barra inferior estándar: cuatro destinos, el activo marcado con la tinta del día. */
export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[460px] border-t border-white/10 bg-night/92 backdrop-blur-md pb-safe md:rounded-t-[22px] md:border-x"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`press relative flex h-[var(--tab-h)] flex-col items-center justify-center gap-0.5 text-[12.5px] font-semibold tracking-wide ${
                  active ? "text-paper" : "text-paper-mute"
                }`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-200 ${active ? "bg-ink/25 text-ink-lift" : ""}`}>
                  <Icon name={t.icon} size={23} />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
