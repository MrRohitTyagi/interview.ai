"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("50");
  const [maxUses, setMaxUses] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          credits: Number(credits),
          maxUses: Number(maxUses),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create code");
      toast.success(`Code ${data.code} created`);
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code (optional)</Label>
        <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated" className="w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="credits">Credits</Label>
        <Input
          id="credits"
          type="number"
          min={1}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className="w-28"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxUses">Max uses</Label>
        <Input
          id="maxUses"
          type="number"
          min={1}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          className="w-28"
        />
      </div>
      <Button type="submit" disabled={submitting} className="gap-1.5">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Create code
      </Button>
    </form>
  );
}
