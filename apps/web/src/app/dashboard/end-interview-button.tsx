"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Lets a candidate end an in-progress/planned interview straight from the
// dashboard list, without having to open the session first. Same hard-stop
// semantics as the in-session cancel button — no pause/resume state.
export function EndInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleConfirm() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to end interview");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end interview");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Ban className="size-3.5" />
        End
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>End this interview?</DialogTitle>
            <DialogDescription>
              This ends the session right away — there&apos;s no pausing or resuming. It won&apos;t count as
              completed and there&apos;s no report for it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="items-center sm:justify-between">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={cancelling} className="gap-2">
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              {cancelling ? "Ending…" : "End interview"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
