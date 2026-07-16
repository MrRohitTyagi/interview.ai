import { History } from "lucide-react";

type Transaction = {
  id: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  createdAt: Date;
};

const REASON_LABELS: Record<string, string> = {
  resume_analysis: "Resume analysis",
  jd_analysis: "Job description analysis",
  gap_analysis: "Gap analysis",
  interview_plan: "Interview started",
  interview_turn: "Interview question",
  report_generation: "Report generated",
  signup_grant: "Welcome bonus",
  redeem_code: "Code redeemed",
  admin_grant: "Manual adjustment",
};

function formatRelativeTime(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

export function CreditHistory({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
        <History className="size-3.5" />
        Recent activity
      </span>
      {transactions.length > 0 ? (
        <div className="studio-panel flex flex-col divide-y divide-border rounded-md">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>{REASON_LABELS[t.reason] ?? t.reason}</span>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`font-mono text-xs ${t.delta >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {t.delta >= 0 ? `+${t.delta}` : t.delta}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{formatRelativeTime(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="studio-panel flex flex-col items-center gap-1.5 rounded-md py-8 text-center">
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </div>
      )}
    </div>
  );
}
