"use client";

import { useEffect, useRef } from "react";

export function InterviewerAvatar({ active }: { active: boolean }) {
  const energyRef = useRef(0);
  const coreRef = useRef<SVGCircleElement>(null);
  const ring1Ref = useRef<SVGCircleElement>(null);
  const ring2Ref = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    const core = coreRef.current;
    const ring1 = ring1Ref.current;
    const ring2 = ring2Ref.current;
    if (!core || !ring1 || !ring2) return;

    function frame() {
      const target = active ? 1 : 0;
      energyRef.current += (target - energyRef.current) * 0.1;
      const t = performance.now() / 1000;

      // Smooth breathing scale
      const breathe = 1 + Math.sin(t * 2.2) * 0.04;
      
      // Dynamic speech scale
      const speakWobble = active 
        ? Math.sin(t * 18) * 0.08 + Math.cos(t * 26) * 0.05 
        : 0;

      const scale = breathe + energyRef.current * speakWobble;
      
      core!.setAttribute("r", (18 * scale).toFixed(2));
      ring1!.setAttribute("r", (28 * (breathe + energyRef.current * (0.15 + Math.sin(t * 12) * 0.06))).toFixed(2));
      ring2!.setAttribute("r", (38 * (breathe + energyRef.current * (0.25 + Math.cos(t * 8) * 0.08))).toFixed(2));

      ring1!.style.opacity = (0.25 + energyRef.current * 0.4).toFixed(2);
      ring2!.style.opacity = (0.12 + energyRef.current * 0.3).toFixed(2);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="relative size-full flex items-center justify-center bg-card">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-primary/5 blur-3xl" />
      
      <svg viewBox="0 0 100 100" className="w-[60%] h-[60%] max-w-[120px] max-h-[120px]" aria-hidden="true">
        {/* Outer Ring */}
        <circle
          ref={ring2Ref}
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        {/* Inner Ring */}
        <circle
          ref={ring1Ref}
          cx="50"
          cy="50"
          r="28"
          fill="none"
          stroke="currentColor"
          className="text-primary"
          strokeWidth="1.5"
        />
        {/* Glowing Core Particle */}
        <circle
          ref={coreRef}
          cx="50"
          cy="50"
          r="18"
          className="fill-primary text-primary"
        />
      </svg>
    </div>
  );
}
