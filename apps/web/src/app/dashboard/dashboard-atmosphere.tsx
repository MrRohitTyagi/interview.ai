"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

// Same drifting-mote effect as the landing hero (page.tsx), at lower density
// and confined to sitting behind the welcome header instead of full-page —
// the dashboard is a tool you return to often, not a one-time impression,
// so the atmosphere here is a quiet accent, not a repeat of the hero.
export function DashboardAtmosphere() {
  const reduce = useReducedMotion();
  const [motes, setMotes] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; duration: number; delay: number }[]
  >([]);

  useEffect(() => {
    if (reduce) return;
    // Randomized client-side after mount — doing this during SSR would
    // produce different random values on the server vs. the client's first
    // render and hydration would mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMotes(
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        dx: -30 + Math.random() * 60,
        dy: -90 - Math.random() * 60,
        duration: 10 + Math.random() * 8,
        delay: Math.random() * 10,
      }))
    );
  }, [reduce]);

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {motes.map((m) => (
        <span
          key={m.id}
          className="studio-mote"
          style={
            {
              left: `${m.left}%`,
              top: `${m.top}%`,
              "--dx": `${m.dx}px`,
              "--dy": `${m.dy}px`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
