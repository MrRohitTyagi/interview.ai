"use client";

import { useEffect, useRef } from "react";

/**
 * Fixed left-edge scroll progress rail for long single-page layouts (the
 * marketing page). Ticks light up as their matching section id scrolls
 * into view; the fill line tracks overall scroll percentage. Hidden below
 * 2xl — there isn't enough side margin outside the content column to show
 * it without overlapping content.
 */
export function SignalRail({ sections }: { sections: { id: string; label: string }[] }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const sectionEls = sections.map((s) => document.getElementById(s.id));

    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (fillRef.current) fillRef.current.style.height = `${(pct * 100).toFixed(1)}%`;

      let activeIdx = 0;
      const mid = window.scrollY + window.innerHeight * 0.4;
      sectionEls.forEach((el, i) => {
        if (el && el.offsetTop <= mid) activeIdx = i;
      });
      tickRefs.current.forEach((el, i) => el?.classList.toggle("is-active", i === activeIdx));
    }

    update();
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  return (
    <div className="fixed top-1/2 left-7 z-[15] hidden -translate-y-1/2 flex-col items-center 2xl:flex">
      <div className="relative h-[168px] w-0.5 bg-border">
        <div ref={fillRef} className="absolute top-0 left-0 w-full bg-primary transition-[height] duration-150 ease-linear" />
        <div className="absolute inset-0 flex flex-col justify-between">
          {sections.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                tickRefs.current[i] = el;
              }}
              className="group relative flex -translate-x-0.5 items-center"
            >
              <span className="size-1.5 shrink-0 rounded-full border-2 border-border bg-background transition-colors group-[.is-active]:border-primary group-[.is-active]:bg-primary" />
              <span className="ml-3 -translate-x-1 font-mono text-[0.62rem] tracking-[0.1em] whitespace-nowrap text-muted-foreground opacity-0 transition-all group-[.is-active]:translate-x-0 group-[.is-active]:text-primary group-[.is-active]:opacity-100">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
