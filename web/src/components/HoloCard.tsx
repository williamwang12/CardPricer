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
      {/* Card image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://tcgplayer-cdn.tcgplayer.com/product/517017_400w.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover z-0 rounded-[inherit]"
      />

      {/* Price overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-5 pt-12 rounded-b-[inherit]">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-white/70 text-xs font-medium">Charizard ex · 183/165</p>
            <span className="font-mono text-2xl font-bold tracking-tight text-white">
              $45.08
            </span>
          </div>
          <span className="text-xs font-semibold text-emerald-400 mb-1">
            +$2.41
          </span>
        </div>
      </div>
    </div>
  );
}
