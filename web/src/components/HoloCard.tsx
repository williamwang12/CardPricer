"use client";

import { useRef, useCallback, useEffect, useState } from "react";

export function HoloCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion) return;
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      card.style.setProperty("--holo-x", `${x}%`);
      card.style.setProperty("--holo-y", `${y}%`);

      const rotateX = ((y - 50) / 50) * -6;
      const rotateY = ((x - 50) / 50) * 6;
      card.style.setProperty("--rotate-x", `${rotateX}deg`);
      card.style.setProperty("--rotate-y", `${rotateY}deg`);
    },
    [reducedMotion]
  );

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--holo-x", "50%");
    card.style.setProperty("--holo-y", "50%");
    card.style.setProperty("--rotate-x", "0deg");
    card.style.setProperty("--rotate-y", "0deg");
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="holo-card"
      aria-hidden="true"
    >
      <div className="relative z-10 flex h-full flex-col justify-center p-7">
        <span className="font-mono text-xs text-slate-400 tracking-wide">
          085 / 165
        </span>

        <h3 className="mt-2 font-heading text-xl font-bold text-slate-900">
          Charizard ex
        </h3>

        <div className="mt-5">
          <span className="font-mono text-3xl font-bold tracking-tight text-slate-900">
            $42.17
          </span>
        </div>
        <span className="mt-1.5 text-xs font-semibold text-emerald-600">
          +$3.20 since last export
        </span>

        <div className="mt-6 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            TCGPlayer Market
          </span>
        </div>
      </div>
    </div>
  );
}
