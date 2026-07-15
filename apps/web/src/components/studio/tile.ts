import { cn } from "@/lib/utils";

/** Shared chrome for the interviewer/candidate video-call tiles so the two
 * stay visually identical — sizing, border, shadow, and the active-speaker
 * ring all live here once instead of duplicated per tile.
 *
 * `variant` controls how size is determined:
 * - "fixed": a constant aspect-ratio box (w-80, 4:3) — used in compact
 *   contexts (a preview panel, a modal) where the tile sits among other
 *   content and shouldn't dictate the layout.
 * - "fill": `size-full`, no aspect-ratio — the tile takes whatever size its
 *   parent gives it. Used when a flex/grid ancestor is what's actually
 *   responsible for making two tiles equal (e.g. two `flex-1` rows stacked
 *   in a column) — matching class names alone can't guarantee equal
 *   rendered size once the tiles sit inside independently-animated
 *   `motion.div` wrappers, which is exactly what produced mismatched tile
 *   sizes in practice before this variant existed. */
export function tileFrameClassName(active: boolean, variant: "fixed" | "fill" = "fixed") {
  return cn(
    "relative overflow-hidden rounded-md border bg-card shadow-[0_14px_34px_-22px_rgba(0,0,0,0.4)] transition-colors",
    variant === "fixed" ? "aspect-[4/3] w-80" : "size-full",
    active ? "border-primary/55 shadow-[0_0_0_1px_var(--primary)]" : "border-border"
  );
}

export const tileLabelClassName =
  "absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 text-xs font-medium backdrop-blur-sm";

export function tileStatusDotClassName(active: boolean) {
  return cn("size-1.5 rounded-full", active ? "studio-tally" : "bg-muted-foreground");
}
