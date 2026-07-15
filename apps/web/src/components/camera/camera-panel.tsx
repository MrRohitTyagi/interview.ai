"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { Camera, CameraOff, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { tileFrameClassName, tileLabelClassName, tileStatusDotClassName } from "@/components/studio";

import { CameraConsentDialog } from "./camera-consent-dialog";

// Versions must match the installed npm package — MediaPipe's WASM binary
// and its JS bindings are not forward/backward compatible across versions.
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const DETECT_INTERVAL_MS = 300;
const ATTENTION_WINDOW = 20;
// How far the nose can drift from the eye midpoint (as a fraction of eye
// span) before we call it "looking away". Tuned loosely — this is practice
// feedback, not a precise gaze tracker.
const LOOKING_AWAY_THRESHOLD = 0.25;

type Status = "idle" | "requesting" | "active" | "denied" | "unsupported" | "error";

// Cached at module scope: the WASM runtime + model are a multi-MB one-time
// download, so toggling the camera off and back on within a session (or
// across interviews in the same tab) reuses the same landmarker instead of
// reloading it.
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    // GPU delegate is faster; fall back to CPU if WebGL isn't usable.
    landmarkerPromise = createLandmarker("GPU").catch(() => createLandmarker("CPU"));
  }
  return landmarkerPromise;
}

/**
 * Self-practice presence feedback — entirely client-side (LLD Section 11).
 * The camera feed never leaves the device: no recording, no upload, no
 * frames or derived signals sent anywhere. Only a boolean consent flag is
 * persisted. Face-detected / looking-away / attention-score are shown to
 * the candidate only and are never part of the report.
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
  const [modelReady, setModelReady] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lookingAway, setLookingAway] = useState(false);
  const [attentionScore, setAttentionScore] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastDetectRef = useRef(0);
  const historyRef = useRef<number[]>([]);
  // getUserMedia and the face-landmarker load are both async and can resolve
  // after the component has already unmounted (e.g. the candidate navigates
  // away while the camera prompt or the multi-MB model download is still in
  // flight). Without this guard, a stream obtained post-unmount never gets
  // assigned to anything the cleanup effect stops, and a post-unmount
  // requestAnimationFrame loop would just keep rescheduling itself forever —
  // together, exactly what leaves the camera indicator on after leaving the
  // interview page.
  const mountedRef = useRef(true);

  function processResult(result: FaceLandmarkerResult) {
    const face = result.faceLandmarks[0];
    const detected = !!face;
    let away = false;
    if (face) {
      const nose = face[1];
      const leftEye = face[33];
      const rightEye = face[263];
      const midX = (leftEye.x + rightEye.x) / 2;
      const span = Math.abs(rightEye.x - leftEye.x) || 1;
      away = Math.abs(nose.x - midX) / span > LOOKING_AWAY_THRESHOLD;
    }
    setFaceDetected(detected);
    setLookingAway(away);

    const history = historyRef.current;
    history.push(detected && !away ? 1 : 0);
    if (history.length > ATTENTION_WINDOW) history.shift();
    const avg = history.reduce((a, b) => a + b, 0) / history.length;
    setAttentionScore(Math.round(avg * 100));
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    historyRef.current = [];
    setFaceDetected(false);
    setLookingAway(false);
    setAttentionScore(null);
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

      getFaceLandmarker()
        .then((landmarker) => {
          if (!mountedRef.current) return;
          function loop() {
            if (!mountedRef.current) return;
            const v = videoRef.current;
            if (v && v.readyState >= 2) {
              const now = performance.now();
              if (now - lastDetectRef.current >= DETECT_INTERVAL_MS) {
                lastDetectRef.current = now;
                processResult(landmarker.detectForVideo(v, now));
              }
            }
            rafRef.current = requestAnimationFrame(loop);
          }
          rafRef.current = requestAnimationFrame(loop);
        })
        .catch(() => {
          // Camera preview still works without the ML model — degrade
          // gracefully to "just a mirror" rather than losing the feature.
          if (mountedRef.current) setModelReady(false);
        });
    } catch {
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
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
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
        const data = await res.json();
        if (cancelled) return;
        if (data.hasConsented) {
          setHasConsented(true);
          await startCamera();
        } else {
          setConsentOpen(true);
        }
      } catch {
        // Couldn't check — leave the camera off and let the manual toggle
        // (which re-asks for consent) be the fallback path.
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
        className="size-full scale-x-[-1] object-cover"
        style={{ display: status === "active" ? "block" : "none" }}
      />
      {status !== "active" && (
        <div className="flex size-full flex-col items-center justify-center gap-2 text-center">
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

      {status === "active" && (
        <span className="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-full bg-card/80 px-2 py-1 text-[0.62rem] text-muted-foreground backdrop-blur-sm">
          {faceDetected && !lookingAway ? <Eye className="size-3 text-primary" /> : <EyeOff className="size-3" />}
          {!modelReady
            ? "Preview only"
            : !faceDetected
              ? "No face"
              : lookingAway
                ? "Look at screen"
                : attentionScore !== null
                  ? `${attentionScore}%`
                  : "Good"}
        </span>
      )}

      <CameraConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onAccept={handleConsentAccept}
        loading={consenting}
      />
    </div>
  );
}
