"use client";

import { Camera, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CameraConsentDialog({
  open,
  onOpenChange,
  onAccept,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            Turn on your camera?
          </DialogTitle>
          <DialogDescription>
            This gives you live feedback on your presence during practice: whether your face is
            visible and how much you&apos;re looking at the screen.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Everything runs on your device. Your video is never recorded, uploaded, or seen by
            anyone, including us.
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            Only you see the feedback. It&apos;s never part of your report or shown to anyone
            else.
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            You can turn it off any time; the interview works fine without it.
          </li>
        </ul>
        <DialogFooter className="items-center sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={onAccept} disabled={loading} className="gap-2">
            <Camera className="size-4" />
            {loading ? "Enabling…" : "Enable camera"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
