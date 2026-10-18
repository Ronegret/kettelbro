"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Hoja inferior accesible sobre <dialog> nativo: foco atrapado, Esc cierra, toque fuera cierra. */
export function Sheet({ open, onClose, title, children, tone }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tone?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      data-focus={tone}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="sheet-body flex max-h-[88dvh] flex-col rounded-t-[24px] bg-night-2 pb-safe text-paper shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-slab text-2xl leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="press grid h-11 w-11 place-items-center rounded-full bg-night-3">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
      </div>
    </dialog>
  );
}
