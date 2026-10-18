"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cuenta atrás sin deriva: se basa en marcas de tiempo (performance.now), no en acumular intervalos,
 * así sigue exacta aunque el navegador frene el timer con la pantalla apagada.
 *  - `key` reinicia la cuenta (un paso nuevo).
 *  - `running=false` la congela (pausa) sin perder el tiempo restante.
 */
export function useCountdown({
  key,
  durationSec,
  running,
  onDone,
  onSecond,
}: {
  key: string | number;
  durationSec: number;
  running: boolean;
  onDone: () => void;
  onSecond?: (remainingWholeSec: number) => void;
}) {
  const [remaining, setRemaining] = useState(durationSec);
  const remainingRef = useRef(durationSec);
  const endAt = useRef(0);
  const doneRef = useRef(false);
  const lastWhole = useRef(Math.ceil(durationSec));
  const onDoneRef = useRef(onDone);
  const onSecondRef = useRef(onSecond);
  useEffect(() => {
    onDoneRef.current = onDone;
    onSecondRef.current = onSecond;
  });

  // Reinicio al cambiar de paso
  useEffect(() => {
    remainingRef.current = durationSec;
    doneRef.current = false;
    lastWhole.current = Math.ceil(durationSec);
    setRemaining(durationSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!running || doneRef.current) return;
    endAt.current = performance.now() + remainingRef.current * 1000;
    const tick = () => {
      const rem = Math.max(0, (endAt.current - performance.now()) / 1000);
      remainingRef.current = rem;
      setRemaining(rem);
      const whole = Math.ceil(rem);
      if (whole !== lastWhole.current) {
        lastWhole.current = whole;
        onSecondRef.current?.(whole);
      }
      if (rem <= 0 && !doneRef.current) {
        doneRef.current = true;
        window.clearInterval(id);
        onDoneRef.current();
      }
    };
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [running, key]);

  const addSeconds = useCallback((n: number) => {
    remainingRef.current = Math.max(1, remainingRef.current + n);
    endAt.current += n * 1000;
    setRemaining(remainingRef.current);
  }, []);

  return { remaining, fraction: durationSec > 0 ? 1 - remaining / durationSec : 1, addSeconds };
}
