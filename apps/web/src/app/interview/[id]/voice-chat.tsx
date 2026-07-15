"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Award, Ban, Loader2, MessagesSquare, Mic, MicOff, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { CameraPanel } from "@/components/camera/camera-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InterviewerAvatar,
  Tally,
  tileFrameClassName,
  tileLabelClassName,
  tileStatusDotClassName,
} from "@/components/studio";

type TranscriptEntry = { question: string; answer: string | null; topic: string };
type Phase = "idle" | "speaking" | "listening" | "thinking" | "done" | "unsupported";

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSpeechRecognitionCtor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// Names of higher-quality voices worth preferring over a browser's default
// (usually a robotic, formant-based local voice). Checked in order.
const PREFERRED_VOICE_NAMES = [
  "Google US English",
  "Google UK English Female",
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
  "Microsoft Guy Online (Natural)",
  "Samantha",
  "Ava",
  "Karen",
  "Daniel",
];

function pickNaturalVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((v) => v.lang.startsWith("en"));
  const pool = english.length > 0 ? english : voices;

  for (const name of PREFERRED_VOICE_NAMES) {
    const match = pool.find((v) => v.name.includes(name));
    if (match) return match;
  }
  // Network-backed voices (localService === false) are almost always neural
  // voices and sound far more natural than the OS's built-in local engine.
  return pool.find((v) => !v.localService) ?? pool[0];
}

export function VoiceChat({
  interviewId,
  initialTranscript,
  initialCompleted,
  startedAt,
  durationMinutes,
}: {
  interviewId: string;
  initialTranscript: TranscriptEntry[];
  initialCompleted: boolean;
  startedAt: string | null;
  durationMinutes: number;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(initialTranscript);
  const [phase, setPhase] = useState<Phase>("idle");
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(initialCompleted);
  const [closingMessage, setClosingMessage] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const currentTopic = transcript[transcript.length - 1]?.topic ?? null;
  const history = transcript.filter((entry) => entry.answer !== null);
  // At least one question already has an answer on the server — this is a
  // reopened session (tab closed/back, not a first-ever entry), even though
  // `started` is false again client-side after the remount.
  const isResuming = history.length > 0;

  useEffect(() => {
    if (!startedAt || completed) return;
    const deadline = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    function tick() {
      setRemainingSeconds(Math.max(0, (deadline - Date.now()) / 1000));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes, completed]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // Voice lists load asynchronously the first time — this warms the
    // cache so the first speak() call already has options to pick from.
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      audioRef.current?.pause();
    };
  }, []);

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    audioRef.current = null;
  }

  // Browser TTS — the original implementation, kept as-is. Used directly
  // when ElevenLabs isn't configured, and as the automatic fallback for any
  // ElevenLabs failure (missing/invalid key, quota exhausted, network
  // error) so a voice API outage never blocks the interview.
  function speakBrowser(text: string, onDone: () => void) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickNaturalVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.onend = onDone;
    utterance.onerror = onDone;
    window.speechSynthesis.speak(utterance);
  }

  async function speak(text: string, onDone: () => void) {
    // Both engines can fail *silently* — a browser can reject or simply
    // drop a play()/speak() call (autoplay policy, stale user-activation
    // after the await below) without ever firing onend/onerror. Without a
    // backstop, that leaves `phase` stuck on "speaking" forever: the mic
    // never turns on and the candidate is stranded with no submit button
    // and no sound. `fireOnce` guarantees onDone always runs exactly once,
    // either from real completion or this timeout, whichever comes first.
    let fired = false;
    const timeout = setTimeout(
      () => fireOnce(),
      Math.min(30000, Math.max(8000, text.length * 90))
    );
    function fireOnce() {
      if (fired) return;
      fired = true;
      clearTimeout(timeout);
      onDone();
    }

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS unavailable");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        fireOnce();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
        speakBrowser(text, fireOnce);
      };
      await audio.play();
    } catch {
      // Covers a non-ok response, a network failure, and browsers that
      // reject audio.play() (e.g. autoplay policy) — either way, the
      // candidate still hears the question via the browser's own voice.
      speakBrowser(text, fireOnce);
    }
  }

  // Builds and wires a fresh recognition instance. Some browsers (notably
  // Chrome) end continuous recognition after a few seconds of silence even
  // though `continuous: true` was requested — far short of a real pause in
  // an interview answer. Rather than trying to resurrect the same (now
  // stopped) instance, onend below spins up a brand new one and keeps
  // listening. Nothing is lost across that swap because the finalized
  // transcript lives in a ref outside the recognition object.
  function createRecognition(): SpeechRecognition | null {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscriptRef.current += result[0].transcript + " ";
        } else {
          interimText += result[0].transcript;
        }
      }
      setLiveTranscript((finalTranscriptRef.current + interimText).trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("Microphone access was denied — allow it and try again.");
        setPhase("idle");
        setStarted(false);
        return;
      }
      toast.error(`Mic error: ${event.error}`);
    };

    recognition.onend = () => {
      // Read phase from a ref, not a setState updater. React's Strict Mode
      // (on by default in dev) invokes updater functions twice to catch
      // impure updaters — and starting a live microphone recognizer is a
      // real side effect, not a pure state transition. Doing it inside
      // setPhase() meant every silence-triggered restart spun up *two* new
      // recognizers, each of which would itself end and double again:
      // exponential growth of live SpeechRecognition instances that pegs
      // the CPU and the mic subsystem until the whole machine bogs down.
      if (phaseRef.current === "listening" && recognitionRef.current === recognition) {
        const next = createRecognition();
        if (next) {
          recognitionRef.current = next;
          try {
            next.start();
          } catch {
            // already starting elsewhere — ignore
          }
        }
      }
    };

    return recognition;
  }

  function startListening() {
    const recognition = createRecognition();
    if (!recognition) {
      setPhase("unsupported");
      return;
    }
    finalTranscriptRef.current = "";
    setLiveTranscript("");
    recognitionRef.current = recognition;
    recognition.start();
    setPhase("listening");
  }

  async function submitAnswer() {
    if (recognitionRef.current) recognitionRef.current.onend = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const answer = liveTranscript.trim();
    if (!answer) {
      toast.error("Didn't catch that — try again.");
      startListening();
      return;
    }

    setPhase("thinking");
    setTranscript((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], answer };
      return copy;
    });

    try {
      const res = await fetch(`/api/interviews/${interviewId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit answer");

      if (data.completed) {
        setCompleted(true);
        setClosingMessage(data.message);
        // Fire-and-forget: kick off report generation now instead of
        // leaving it fully lazy until someone opens the report page. Not
        // awaited — Opus takes 10-30s and there's nothing useful to block
        // on here. The report page's own generate-on-mount logic is
        // idempotent, so this is purely a head start.
        fetch(`/api/interviews/${interviewId}/report`, { method: "POST" }).catch(() => {});
        setPhase("speaking");
        speak(data.message, () => setPhase("done"));
      } else {
        setTranscript((prev) => [...prev, { question: data.message, answer: null, topic: data.topic }]);
        setPhase("speaking");
        speak(data.message, startListening);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setTranscript((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], answer: null };
        return copy;
      });
      startListening();
    }
  }

  function begin() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPhase("unsupported");
      return;
    }
    setStarted(true);
    if (completed) {
      setPhase("done");
      return;
    }
    const last = transcript[transcript.length - 1];
    if (last && last.answer === null) {
      setPhase("speaking");
      speak(last.question, startListening);
    } else {
      startListening();
    }
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel interview");
      recognitionRef.current?.stop();
      stopSpeaking();
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel interview");
      setCancelling(false);
    }
  }

  const lastQuestion = transcript[transcript.length - 1]?.question ?? "";
  const displayText = completed && closingMessage ? closingMessage : lastQuestion;
  const tallyActive = phase === "speaking" || phase === "listening";
  const tallyLabel =
    phase === "speaking" ? "On air" : phase === "listening" ? "Listening" : phase === "thinking" ? "Thinking" : "Standby";

  // Two equal, full-height tiles stacked top/bottom on the left half of the
  // screen. `variant="fill"` (see tile.ts) means each tile is exactly the
  // size its flex-1 wrapper gives it — guaranteed identical width AND
  // height, unlike the previous side-by-side layout where two independently
  // `motion.div`-animated tiles ended up visibly mismatched in practice.
  // Fixed order (interviewer always on top) rather than swapping position
  // on active speaker — a swap here would be exactly the kind of motion
  // that reads as jitter at this size; the border/glow already shows who's
  // talking without moving anything.
  const cameraColumn = (
    <div className="flex min-h-0 max-h-[90vh] flex-1 flex-col gap-3 lg:overflow-hidden">
      <div className="min-h-0 flex-1">
        <div className={tileFrameClassName(phase === "speaking", "fill")}>
          <InterviewerAvatar active={phase === "speaking"} />
          <span className={tileLabelClassName}>
            <span className={tileStatusDotClassName(phase === "speaking")} />
            Interviewer
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CameraPanel interviewId={interviewId} active={phase === "listening"} variant="fill" />
      </div>
    </div>
  );

  // Always rendered at a fixed min-height, even with nothing to show yet —
  // conditionally mounting this box was what made the submit button below
  // it jump around as liveTranscript appeared/disappeared.
  const answerBlock = (
    <div className="flex min-h-18 w-full flex-col justify-center gap-1 rounded-md border border-border bg-card px-4 py-3">
      <span className="font-mono text-[0.62rem] tracking-wider text-muted-foreground uppercase">Your answer</span>
      <p className="text-sm text-muted-foreground italic">
        {phase === "listening" && liveTranscript
          ? `“${liveTranscript}”`
          : phase === "listening"
            ? "Listening…"
            : "—"}
      </p>
    </div>
  );

  // A real dialogue transcript, not chat bubbles — this is a recorded
  // interview, not a messaging thread, so both speakers read top-to-bottom
  // in one column, told apart by label color and weight rather than
  // alternating sides.
  const transcriptRail = (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
        <MessagesSquare className="size-3.5" />
        Transcript so far
      </span>
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border bg-card/50">
        {history.length > 0 ? (
          history.map((entry, i) => (
            <div key={i} className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[0.62rem] tracking-wider text-primary uppercase">Interviewer</span>
                <p className="text-sm leading-relaxed">{entry.question}</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[0.62rem] tracking-wider text-muted-foreground uppercase">You</span>
                <p className="text-sm leading-relaxed text-muted-foreground">{entry.answer}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <MessagesSquare className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing yet — your conversation will show up here.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 p-6 lg:h-screen lg:overflow-hidden lg:py-5">
      <div className="flex shrink-0 items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          {currentTopic && !completed && <Badge variant="secondary">{currentTopic}</Badge>}
          {started && !completed && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setCancelOpen(true)}>
              <Ban className="size-3.5" />
              End
            </Button>
          )}
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>End this interview?</DialogTitle>
            <DialogDescription>
              This ends the session right away — there&apos;s no pausing or resuming. It won&apos;t count as
              completed and there&apos;s no report for it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep going
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm} disabled={cancelling} className="gap-2">
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              {cancelling ? "Ending…" : "End interview"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {phase === "unsupported" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <MicOff className="size-5" />
          <p className="max-w-md font-medium text-foreground">This browser can&apos;t run the interview</p>
          <p className="max-w-md">
            Interviews here are spoken, not typed, and that needs the Web Speech API — supported in Chrome and Edge.
            Try again in one of those.
          </p>
        </div>
      ) : (
        // Two exactly equal halves on a wide viewport: cameras (left),
        // question/answer/transcript (right). Nothing here requires
        // scrolling the page itself — only the transcript list scrolls
        // internally, and only once it grows past the space left for it.
        // Below `lg` this collapses to a single stacked, page-scrollable
        // column instead of forcing the split at a width that can't fit it.
        <div className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-2 lg:overflow-hidden">
          {cameraColumn}

          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-hidden">
            <div className="flex shrink-0 items-center justify-between rounded-md border border-border bg-card px-4 py-2.5">
              <Tally active={tallyActive} label={tallyLabel} />
              {remainingSeconds !== null && !completed && (
                <span
                  className={
                    remainingSeconds <= 60
                      ? "pulse-glow rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-xs text-destructive"
                      : "font-mono text-xs text-muted-foreground"
                  }
                >
                  {formatCountdown(remainingSeconds)}
                </span>
              )}
            </div>

            {!started ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  {isResuming
                    ? `You're picking back up where you left off — ${history.length} question${history.length === 1 ? "" : "s"} already answered. The interviewer will re-ask the current question.`
                    : "This interview is a real spoken conversation — your mic drives it, and the interviewer talks back. Nothing is uploaded except your answers."}
                </p>
                <Button onClick={begin} size="lg" className="studio-glow gap-2">
                  <Mic className="size-4" />
                  {isResuming ? "Resume interview" : "Start interview"}
                </Button>
              </div>
            ) : completed ? (
              phase === "done" && (
                <Card className="studio-panel studio-glow w-full shrink-0">
                  <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                    <p className="font-medium">Interview complete</p>
                    <Button render={<Link href={`/interview/${interviewId}/report`} />} className="studio-glow gap-2">
                      <Award className="size-4" />
                      View report
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="flex shrink-0 flex-col gap-3">
                <div className="flex flex-col items-start gap-2">
                  <span className="flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
                    {phase === "thinking" && <Loader2 className="size-3 animate-spin" />}
                    {phase === "thinking" ? "Thinking" : "Question"}
                  </span>
                  <motion.p
                    key={displayText}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="font-serif text-xl text-balance"
                  >
                    {displayText}
                  </motion.p>
                </div>

                {answerBlock}

                {/* Fixed width so the label swap between phases (different
                    pixel widths for "Submit answer" / "Speaking…" /
                    "Thinking…") never shifts anything around it. */}
                <Button
                  onClick={submitAnswer}
                  disabled={phase !== "listening"}
                  size="lg"
                  variant={phase === "listening" ? "default" : "outline"}
                  className={
                    phase === "listening" ? "studio-glow w-56 justify-center gap-2" : "w-56 justify-center gap-2"
                  }
                >
                  {phase === "listening" ? (
                    <>
                      <Square className="size-4" />
                      Submit answer
                    </>
                  ) : phase === "speaking" ? (
                    <>
                      <Volume2 className="size-4" />
                      Speaking…
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Thinking…
                    </>
                  )}
                </Button>
              </div>
            )}

          </div>
        </div>
      )}
      {transcriptRail}
    </div>
  );
}
