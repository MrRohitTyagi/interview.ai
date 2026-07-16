"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RedeemCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to redeem code");
      toast.success(`+${data.credited} credits added`);
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to redeem code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <Label htmlFor="redeemCode">Redeem a code</Label>
      <div className="flex gap-2">
        <Input
          id="redeemCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. BETA50"
          className="font-mono uppercase"
          required
        />
        <Button type="submit" disabled={submitting} className="shrink-0 gap-1.5">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
          Redeem
        </Button>
      </div>
    </form>
  );
}
