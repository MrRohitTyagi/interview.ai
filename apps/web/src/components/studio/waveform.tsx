"use client";

import { useEffect, useRef } from "react";

/**
 * Canvas bar-waveform. Without an `analyser` it simulates activity by
 * jittering toward random targets ("active" jitters wide, "idle" jitters
 * small). Pass a live `AnalyserNode` (from getUserMedia + Web Audio) and it
 * switches to rendering real frequency data instead — same visual language,
 * genuinely reactive to a real voice.
 */
export function Waveform({
  state,
  analyser,
  className,
  bars = 36,
  onLevel,
}: {
  state: "active" | "idle";
  analyser?: AnalyserNode | null;
  className?: string;
  bars?: number;
  /** Called every frame with the current average bar height (0-1). Pass a
   * `useCallback`-memoized function — it's an effect dependency, so a new
   * identity every render would restart the whole loop. Intended for cheap
   * imperative DOM writes (e.g. a glow's opacity), not setState. */
  onLevel?: (avg: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heightsRef = useRef<number[]>([]);
  const targetsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    if (heightsRef.current.length !== bars) {
      heightsRef.current = new Array(bars).fill(0.15);
      targetsRef.current = new Array(bars).fill(0.15);
    }
    const heights = heightsRef.current;
    const targets = targetsRef.current;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cssW = 0;
    let cssH = 0;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      canvas!.width = cssW * dpr;
      canvas!.height = cssH * dpr;
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function retarget() {
      if (analyser) return; // real data drives targets instead, see draw()
      for (let i = 0; i < bars; i++) {
        targets[i] = state === "active" ? 0.22 + Math.random() * 0.78 : 0.08 + Math.random() * 0.3;
      }
    }
    retarget();
    const retargetInterval = reduce ? null : window.setInterval(retarget, 130);

    function getVar(name: string) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
    const activeColor = getVar("--primary");
    const idleColor = getVar("--muted-foreground");

    let freqData: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;

    function draw() {
      if (analyser) {
        if (!freqData || freqData.length !== analyser.frequencyBinCount) {
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freqData);
        for (let i = 0; i < bars; i++) {
          const idx = Math.floor((i / bars) * freqData.length);
          targets[i] = Math.min(1, (freqData[idx] / 255) * 1.4);
        }
      }

      context!.clearRect(0, 0, cssW, cssH);
      const gap = 3;
      const barW = Math.max(1.5, (cssW - gap * (bars - 1)) / bars);
      context!.fillStyle = analyser || state === "active" ? activeColor : idleColor;
      let sum = 0;
      for (let i = 0; i < bars; i++) {
        heights[i] += (targets[i] - heights[i]) * (reduce ? 1 : 0.3);
        sum += heights[i];
        const bh = Math.max(2, heights[i] * cssH);
        const x = i * (barW + gap);
        const y = (cssH - bh) / 2;
        const r = Math.min(2, barW / 2);
        context!.beginPath();
        context!.roundRect(x, y, barW, bh, r);
        context!.fill();
      }
      onLevel?.(sum / bars);
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (retargetInterval) window.clearInterval(retargetInterval);
      cancelAnimationFrame(raf);
    };
  }, [state, analyser, bars, onLevel]);

  return <canvas ref={canvasRef} className={className} />;
}
