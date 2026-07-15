"use client";

import { useEffect, useRef } from "react";

/**
 * Global "on air" atmosphere: film grain, a soft edge vignette, and a stage
 * spotlight that follows the pointer (drifting slowly on its own when idle).
 * Mounted once in the root layout — everything is fixed/pointer-events:none
 * so it never interferes with the page underneath.
 */
export function StageAtmosphere() {
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const spot = spotRef.current;
    if (!spot) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.22;
    let curX = targetX;
    let curY = targetY;
    let lastMove = 0;
    let frame = 0;

    function onPointerMove(e: PointerEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      lastMove = performance.now();
    }

    function loop(t: number) {
      if (performance.now() - lastMove > 3500) {
        targetX = window.innerWidth * 0.5 + Math.sin(t / 4200) * window.innerWidth * 0.16;
        targetY = window.innerHeight * 0.2 + Math.cos(t / 5000) * 70;
      }
      curX += (targetX - curX) * 0.055;
      curY += (targetY - curY) * 0.055;
      spot!.style.setProperty("--x", `${curX}px`);
      spot!.style.setProperty("--y", `${curY}px`);
      frame = requestAnimationFrame(loop);
    }

    window.addEventListener("pointermove", onPointerMove);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="studio-vignette" />
      <div ref={spotRef} className="studio-spotlight" />
      <div className="studio-grain" />
    </>
  );
}
