"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Mic, Target } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Tailwind can only see literal class strings at build time — a template
// literal like `bg-${tint}/12` never gets generated, so each combination
// has to be spelled out here rather than assembled from a token name.
const ENTRIES = [
  {
    href: "/analyze",
    icon: Target,
    // chart-1/chart-2 are the same accent family used across score charts
    // elsewhere (report gauges, avg-score bars) — reused here just to tell
    // the two peer entries apart, not a second brand color.
    iconWrapClassName: "bg-chart-1/12 text-chart-1",
    ctaClassName: "text-chart-1",
    title: "Know your fit",
    description: "Upload your resume, compare it to a job description, and see exactly where you stand.",
    cta: "Analyze",
  },
  {
    href: "/interview/new",
    icon: Mic,
    iconWrapClassName: "bg-chart-2/12 text-chart-2",
    ctaClassName: "text-chart-2",
    title: "Take the stage",
    description: "A live, adaptive mock interview — spoken, adaptive, and scored like the real thing.",
    cta: "Start interview",
  },
] as const;

// The dashboard's entry point: two clear next moves instead of one generic
// button, so the page reads as "pick where you're starting" rather than a
// wall of stats with a CTA bolted on top.
export function FlowEntry() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ENTRIES.map(({ href, icon: Icon, iconWrapClassName, ctaClassName, title, description, cta }, i) => (
        <motion.div
          key={href}
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link href={href} className="group/entry block">
            <Card className="studio-panel h-full transition-all group-hover/entry:-translate-y-0.5 group-hover/entry:border-primary/40 group-hover/entry:studio-glow">
              <CardHeader>
                <div className={`flex size-10 items-center justify-center rounded-full ${iconWrapClassName}`}>
                  <Icon className="size-4.5" />
                </div>
                <CardTitle className="mt-2.5 text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className={`flex items-center gap-1.5 text-sm font-medium ${ctaClassName}`}>
                  {cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover/entry:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
