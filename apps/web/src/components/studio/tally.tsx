import { cn } from "@/lib/utils";

export function Tally({
  active = true,
  label,
  className,
}: {
  active?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.12em] uppercase transition-colors",
        active ? "text-primary" : "text-muted-foreground",
        className
      )}
    >
      <span className={cn("size-2 rounded-full", active ? "studio-tally" : "bg-muted-foreground")} />
      {label}
    </div>
  );
}
