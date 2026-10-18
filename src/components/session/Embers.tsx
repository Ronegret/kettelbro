"use client";

import { useEffect, useRef } from "react";

/**
 * Brasas de celebración: chispas de herrería que suben y se apagan. Un solo canvas, ~2.4 s, sin librerías.
 * Respeta prefers-reduced-motion (no dibuja nada).
 */
export function Embers({ colors, count = 90 }: { colors: string[]; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);

    const parts = Array.from({ length: count }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const sp = (4 + Math.random() * 11) * dpr;
      return {
        x: w / 2 + (Math.random() - 0.5) * w * 0.4,
        y: h * 0.78,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: (2 + Math.random() * 4.5) * dpr,
        c: colors[Math.floor(Math.random() * colors.length)] as string,
        life: 0,
        max: 90 + Math.random() * 70,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        bean: Math.random() < 0.35, // frijoles entre el papel picado
      };
    });

    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of parts) {
        p.life++;
        if (p.life > p.max) continue;
        alive = true;
        p.vy += 0.16 * dpr; // gravedad suave
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.bean) {
          ctx.fillStyle = "#4b2f22";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.7, p.r * 1.1, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#9a6a48";
          ctx.fillRect(-p.r, -p.r * 0.5, p.r * 1.1, p.r * 0.35);
        } else {
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); // papel picado
        }
        ctx.restore();
      }
      if (alive) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [colors, count]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 h-full w-full" />;
}
