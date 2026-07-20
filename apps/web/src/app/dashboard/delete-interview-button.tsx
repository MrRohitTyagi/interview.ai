"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// Only ever rendered for cancelled (abandoned) interviews — the API route
// itself also enforces this, so there's no path to deleting a completed
// interview's report or an active session out from under someone.
export function DeleteInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, { method: "DELETE" });
      const text = await res.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (e) {}
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete interview");
      toast.success("Interview deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete interview");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      className="gap-1.5"
      onClick={handleConfirm}
      disabled={deleting}
    >
      {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      {deleting ? "Deleting…" : "Delete"}
    </Button>
  );
}
