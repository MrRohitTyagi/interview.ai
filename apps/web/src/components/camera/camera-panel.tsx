"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";

import { tileFrameClassName, tileLabelClassName, tileStatusDotClassName } from "@/components/studio";

import { CameraConsentDialog } from "./camera-consent-dialog";

type Status = "idle" | "requesting" | "active" | "denied" | "unsupported" | "error";

/**
 * Client-side camera preview.
 * The camera feed never leaves the device: no recording, no upload, no
 * frames or derived signals sent anywhere. Only a boolean consent flag is
 * persisted.
 */
export function CameraPanel({
  interviewId,
  active,
  variant = "fixed",
}: {
  interviewId: string;
  active?: boolean;
  variant?: "fixed" | "fill";
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [consentOpen, setConsentOpen] = useState(false);
  const [consenting, setConsenting] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // getUserMedia and the face-landmarker load are both async and can resolve
  // after the component has already unmounted (e.g. the candidate navigates
  // away while the camera prompt or the multi-MB model download is still in
  // flight). Without this guard, a stream obtained post-unmount never gets
  // assigned to anything the cleanup effect stops, and a post-unmount
  // requestAnimationFrame loop would just keep rescheduling itself forever —
  // together, exactly what leaves the camera indicator on after leaving the
  // interview page.
  const mountedRef = useRef(true);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }

  async function startCamera() {
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      setStatus("active");
    } catch (err) {
      console.error("Camera access failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to access camera");
      if (mountedRef.current) setStatus("denied");
    }
  }

  async function handleToggle() {
    if (status === "active") {
      stopCamera();
      return;
    }
    if (!hasConsented) {
      setConsentOpen(true);
      return;
    }
    await startCamera();
  }

  async function handleConsentAccept() {
    setConsenting(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/camera-consent`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to record consent");
      setHasConsented(true);
      setConsentOpen(false);
      await startCamera();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't enable the camera");
    } finally {
      setConsenting(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Camera defaults to on, not hidden behind a manual toggle click — but
  // never bypasses consent. A returning candidate who's consented before
  // (in any interview) gets the camera started immediately; a first-time
  // candidate gets the consent dialog opened proactively instead of having
  // to discover the toggle button themselves.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}/camera-consent`);
        if (!res.ok) throw new Error("Database check failed");
        const data = await res.json();
        if (cancelled) return;
        if (data.hasConsented) {
          setHasConsented(true);
          await startCamera();
        } else {
          setConsentOpen(true);
        }
      } catch (err) {
        console.error("Camera consent check failed, falling back to dialog:", err);
        if (!cancelled) {
          setConsentOpen(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={tileFrameClassName(!!active, variant)}>
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute inset-0 size-full scale-x-[-1] object-cover"
        style={{ display: status === "active" ? "block" : "none" }}
      />
      {status !== "active" && (
        <div className="absolute inset-0 flex size-full flex-col items-center justify-center gap-2 text-center">
          <CameraOff className="size-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {status === "denied" ? "Camera access denied" : status === "requesting" ? "Requesting…" : "Camera off"}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={status === "active" ? "Turn off camera" : "Turn on camera"}
        aria-pressed={status === "active"}
        title={status === "active" ? "Turn off camera" : "Turn on camera"}
        className="absolute top-2 right-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary hover:text-primary"
      >
        {status === "active" ? <CameraOff className="size-3.5" /> : <Camera className="size-3.5" />}
      </button>

      <span className={tileLabelClassName}>
        <span className={tileStatusDotClassName(!!active)} />
        You
      </span>

      <CameraConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onAccept={handleConsentAccept}
        loading={consenting}
      />
    </div>
  );
}
