"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

// A score is the same kind of number everywhere it shows up (the report's
// overall score, a dashboard average) — one instrument, reused, rather than
// a bespoke chart invented per screen. "sm" fits inside a dashboard stat
// tile; "lg" is the report page's hero gauge.
// Label sizes snap to DESIGN.md's documented ramp (label-sm 0.62rem / label
// 0.68rem) rather than inventing a new in-between step just for this gauge.
const SIZES = {
  sm: { box: 72, stroke: 6, valueClass: "text-lg", labelClass: "text-[0.62rem] tracking-[0.05em]" },
  lg: { box: 112, stroke: 8, valueClass: "text-2xl", labelClass: "text-[0.68rem] tracking-[0.12em]" },
} as const;

export function ScoreGauge({
  value,
  size = "lg",
  label,
}: {
  value: number | null;
  size?: keyof typeof SIZES;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  const { box, stroke, valueClass, labelClass } = SIZES[size];
  const radius = box / 2 - stroke / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = value !== null ? Math.max(0, Math.min(100, value)) : null;
  const offset = clamped !== null ? circumference * (1 - clamped / 100) : circumference;

  return (
    <div className="relative shrink-0" style={{ width: box, height: box }}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle cx={box / 2} cy={box / 2} r={radius} fill="none" stroke="var(--secondary)" strokeWidth={stroke} />
        <motion.circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-mono font-semibold tabular-nums", valueClass)}>{value ?? "—"}</span>
        {label && (
          <span className={cn("text-muted-foreground text-center uppercase", labelClass)}>{label}</span>
        )}
      </div>
    </div>
  );
}
