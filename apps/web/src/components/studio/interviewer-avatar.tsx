"use client";

import { useEffect, useRef } from "react";

/**
 * Abstract, calm avatar for the AI interviewer's tile. The mouth opens and
 * closes while `active` (speaking) using two overlapping sine waves rather
 * than randomized targets — that randomness is exactly what made the old
 * bar-waveform orb read as jittery. Motion is continuous and smoothly
 * ramps in/out via `energyRef`, which survives across re-runs of the
 * effect below (a plain useRef, not reset on state changes).
 */
export function InterviewerAvatar({ active }: { active: boolean }) {
  const mouthRef = useRef<SVGEllipseElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef(0);

  useEffect(() => {
    const mouth = mouthRef.current;
    const ring = ringRef.current;
    if (!mouth || !ring) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      mouth.setAttribute("ry", active ? "5" : "2");
      mouth.setAttribute("rx", "9");
      ring.style.opacity = active ? "0.2" : "0.1";
      return;
    }

    let raf = 0;
    function frame() {
      const target = active ? 1 : 0;
      energyRef.current += (target - energyRef.current) * 0.06;
      const t = performance.now() / 1000;
      const wobble = (0.5 + 0.5 * Math.sin(t * 8.6)) * (0.5 + 0.5 * Math.sin(t * 13.1));
      const ry = 2 + energyRef.current * wobble * 8;
      mouth!.setAttribute("ry", ry.toFixed(2));
      mouth!.setAttribute("rx", (10 - energyRef.current * wobble * 1.5).toFixed(2));
      ring!.style.opacity = (0.1 + energyRef.current * 0.22).toFixed(2);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="relative size-full">
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-full bg-primary opacity-10 blur-xl"
      />
      <svg viewBox="0 0 104 104" className="relative size-full" aria-hidden="true">
        <circle cx="52" cy="52" r="50" className="fill-secondary" />
        <circle cx="41" cy="45" r="2.8" className="studio-avatar-blink fill-muted-foreground" />
        <circle cx="63" cy="45" r="2.8" className="studio-avatar-blink fill-muted-foreground" />
        <ellipse ref={mouthRef} cx="52" cy="65" rx="10" ry="2" className="fill-primary" />
      </svg>
    </div>
  );
}
