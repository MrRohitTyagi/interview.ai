"use client";

import { motion, useReducedMotion } from "motion/react";

// A thin motion wrapper so the server-rendered profile page can still get
// the same staggered entrance used on the dashboard and interview pages —
// the page itself stays a server component (it does a direct DB read for
// balance/history), so the motion has to live in a small client leaf like
// this rather than at the page root.
export function ProfileSection({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
