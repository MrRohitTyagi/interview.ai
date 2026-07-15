"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import {
  AudioLines,
  Award,
  Ban,
  Camera,
  Code2,
  History,
  Mic,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  InterviewerAvatar,
  SignalRail,
  Tally,
  tileFrameClassName,
  tileLabelClassName,
  tileStatusDotClassName,
  Waveform,
} from "@/components/studio";

type Turn = {
  who: "Interviewer" | "Candidate";
  text: string;
  phase: "speaking" | "listening";
  topic?: string;
};

const SCRIPT: Turn[] = [
  {
    who: "Interviewer",
    phase: "speaking",
    topic: "Backend Architecture · Hard",
    text: "Okay — what pushed the team to break the monolith into microservices?",
  },
  {
    who: "Candidate",
    phase: "listening",
    text: "Deploys kept taking down unrelated features, so we needed real isolation.",
  },
  {
    who: "Interviewer",
    phase: "speaking",
    topic: "Backend Architecture · Hard",
    text: "Got it. How'd you keep data consistent across the new services?",
  },
  {
    who: "Candidate",
    phase: "listening",
    text: "We leaned on event sourcing and accepted eventual consistency where it was safe.",
  },
  {
    who: "Interviewer",
    phase: "speaking",
    topic: "System Design · Hard",
    text: "Different question — how would you design a rate limiter for a public API?",
  },
  {
    who: "Candidate",
    phase: "listening",
    text: "Token bucket per client, backed by Redis so it works across instances.",
  },
];

// Same story as SCRIPT above, told as {question, answer} pairs — the sample
// session dialog reuses it so the two demos feel like one consistent
// narrative rather than two unrelated scripts.
const DEMO_TURNS = [
  { question: SCRIPT[0].text, answer: SCRIPT[1].text },
  { question: SCRIPT[2].text, answer: SCRIPT[3].text },
  { question: SCRIPT[4].text, answer: SCRIPT[5].text },
];

const CHANNELS = [
  { code: "CH.01 · INTAKE", title: "Resume & JD", fill: 65, body: "Parsed and cross-referenced for gaps before a single question is asked." },
  { code: "CH.02 · ADAPTIVE", title: "Live follow-ups", fill: 85, body: "Vague answer, it digs in. Solid answer, it moves on — no fixed script." },
  { code: "CH.03 · VOICE", title: "A real conversation", fill: 50, body: "Spoken, not typed — you talk, the interviewer listens and talks back, just like the real thing." },
  { code: "CH.04 · REPORT", title: "Scored transcript", fill: 92, body: "A calibrated, hiring-style writeup the moment the session ends." },
];

const RAIL_SECTIONS = [
  { id: "sec-hero", label: "ON AIR" },
  { id: "sec-signal", label: "SIGNAL" },
  { id: "sec-rig", label: "THE RIG" },
  { id: "sec-score", label: "SCORE" },
  { id: "sec-end", label: "END" },
];

const RIG_FEATURES = [
  {
    icon: Camera,
    title: "Camera, entirely local",
    body: "See yourself the way an interviewer would. Nothing is recorded or uploaded — the feed never leaves your device.",
    soon: false,
  },
  {
    icon: AudioLines,
    title: "A voice that sounds real",
    body: "Natural spoken responses, with an automatic fallback built in so the interviewer is never left silent.",
    soon: false,
  },
  {
    icon: Ban,
    title: "End it, no questions asked",
    body: "Cancel any session mid-interview. It's logged honestly in your history instead of hanging forever.",
    soon: false,
  },
  {
    icon: RotateCcw,
    title: "Pick up where you left off",
    body: "Close the tab, come back later — your next question is waiting exactly where you left it.",
    soon: false,
  },
  {
    icon: History,
    title: "A history that means something",
    body: "Every attempt, scored and kept — see the trend across sessions, not just the last one.",
    soon: false,
  },
  {
    icon: Code2,
    title: "Coding round",
    body: "JavaScript problem-solving, graded the moment you submit, right in the browser.",
    soon: true,
  },
] as const;

function formatTimecode(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    // matchMedia only exists client-side; defaulting to false during SSR and
    // correcting after mount is the standard hydration-safe pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduce;
}

// Runs the same question -> listening -> committed-to-transcript cycle the
// real interview page does (voice-chat.tsx), just scripted instead of
// driven by actual speech — a live simulation, not a static screenshot.
// Keyed on `open` so it always restarts fresh and stops burning cycles
// while the dialog is closed.
// Mirrors the real session page's two-block shape (voice-chat.tsx): cameras
// on the left, current question + current answer on the right, nothing
// else — no transcript history here either, same as the real page keeps
// out of the immediate view.
function SampleSessionDemo({ open }: { open: boolean }) {
  const [turnIndex, setTurnIndex] = useState(0);
  const [demoPhase, setDemoPhase] = useState<"speaking" | "listening">("speaking");
  const [displayText, setDisplayText] = useState("");
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTurnIndex(0);
      setDemoPhase("speaking");
      setDisplayText("");
      return;
    }
    if (reduce) {
      setDisplayText(DEMO_TURNS[0].question);
      return;
    }
    let cancelled = false;
    async function run() {
      let i = 0;
      while (!cancelled) {
        const turn = DEMO_TURNS[i % DEMO_TURNS.length];
        setTurnIndex(i);
        setDemoPhase("speaking");
        setDisplayText("");
        for (let c = 1; c <= turn.question.length && !cancelled; c++) {
          await new Promise((r) => setTimeout(r, 22));
          setDisplayText(turn.question.slice(0, c));
        }
        await new Promise((r) => setTimeout(r, 500));
        if (cancelled) return;

        setDemoPhase("listening");
        setDisplayText("");
        for (let c = 1; c <= turn.answer.length && !cancelled; c++) {
          await new Promise((r) => setTimeout(r, 18));
          setDisplayText(turn.answer.slice(0, c));
        }
        await new Promise((r) => setTimeout(r, 900));
        if (cancelled) return;

        i++;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, reduce]);

  const currentQuestion = DEMO_TURNS[turnIndex % DEMO_TURNS.length].question;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className={tileFrameClassName(demoPhase === "speaking", "fill")}>
          <InterviewerAvatar active={demoPhase === "speaking"} />
          <span className={tileLabelClassName}>
            <span className={tileStatusDotClassName(demoPhase === "speaking")} />
            Interviewer
          </span>
        </div>
        <div className={tileFrameClassName(demoPhase === "listening", "fill")}>
          <div className="flex size-full items-center justify-center bg-secondary">
            <Mic className="size-5 text-muted-foreground" />
          </div>
          <span className={tileLabelClassName}>
            <span className={tileStatusDotClassName(demoPhase === "listening")} />
            You
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Tally
          active={demoPhase === "speaking" || demoPhase === "listening"}
          label={demoPhase === "speaking" ? "On air" : "Listening"}
        />
        <span className="font-mono text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
          Question
        </span>
        <p className="min-h-[3.4em] font-serif text-lg text-balance">
          {demoPhase === "speaking" ? displayText || " " : currentQuestion}
        </p>
        <div className="flex min-h-[4.5rem] flex-1 flex-col justify-center gap-1 rounded-md border border-border bg-card px-4 py-3">
          <span className="font-mono text-[0.62rem] tracking-wider text-muted-foreground uppercase">
            Your answer
          </span>
          <p className="text-sm text-muted-foreground italic">
            {demoPhase === "listening" ? displayText : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const reduce = useReducedMotion();
  const { data: session } = useSession();
  const ctaHref = session?.user ? "/dashboard" : "/sign-in";
  const ctaLabel = session?.user ? "Go to dashboard" : "Start free interview";
  const [sampleOpen, setSampleOpen] = useState(false);

  const [turn, setTurn] = useState<Turn>(SCRIPT[0]);
  const [displayText, setDisplayText] = useState("");
  const [topic, setTopic] = useState(SCRIPT[0].topic ?? "");
  const [seconds, setSeconds] = useState(4 * 60 + 12);

  const [micActive, setMicActive] = useState(false);
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null);
  const [micStatus, setMicStatus] = useState("See your own voice drive the waveform above");
  const [micError, setMicError] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const glowRef = useRef<HTMLDivElement>(null);
  const handleLevel = useCallback((avg: number) => {
    if (glowRef.current) glowRef.current.style.opacity = Math.min(0.55, 0.1 + avg * 0.5).toFixed(2);
  }, []);

  const [motes, setMotes] = useState<
    { id: number; left: number; top: number; dx: number; dy: number; duration: number; delay: number }[]
  >([]);

  // Typewriter loop cycling through the sample session — runs client-side
  // only, after mount, so it never affects the server-rendered markup.
  useEffect(() => {
    if (reduce) {
      // Reduced motion: show one representative turn, fully typed, with no
      // ongoing loop — a direct content sync, not an animation.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTurn(SCRIPT[0]);
      setDisplayText(SCRIPT[0].text);
      return;
    }
    let cancelled = false;
    async function run() {
      let i = 0;
      while (!cancelled) {
        const t = SCRIPT[i % SCRIPT.length];
        setTurn(t);
        if (t.topic) setTopic(t.topic);
        setDisplayText("");
        for (let c = 1; c <= t.text.length && !cancelled; c++) {
          await new Promise((r) => setTimeout(r, 26));
          setDisplayText(t.text.slice(0, c));
        }
        await new Promise((r) => setTimeout(r, 2200));
        i++;
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setSeconds((s) => (s >= 15 * 60 ? 0 : s + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [reduce]);

  useEffect(() => {
    if (reduce) return;
    // Randomized client-side after mount, not in the initial state
    // initializer — doing this during SSR would produce different random
    // values on the server vs. the client's first render and hydration
    // would mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMotes(
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: 20 + Math.random() * 60,
        dx: -40 + Math.random() * 80,
        dy: -140 - Math.random() * 100,
        duration: 9 + Math.random() * 8,
        delay: Math.random() * 9,
      }))
    );
  }, [reduce]);

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  async function startMicTest() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 128;
      node.smoothingTimeConstant = 0.6;
      source.connect(node);
      micStreamRef.current = stream;
      audioCtxRef.current = ctx;
      setMicAnalyser(node);
      setMicActive(true);
      setMicStatus("Live — say something");
      setMicError(false);
    } catch {
      setMicStatus("Mic access was denied or unavailable — check your browser's permissions");
      setMicError(true);
    }
  }

  function stopMicTest() {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    micStreamRef.current = null;
    audioCtxRef.current = null;
    setMicAnalyser(null);
    setMicActive(false);
    setMicStatus("See your own voice drive the waveform above");
  }

  const recLabel = micActive ? "MIC TEST" : turn.phase === "speaking" ? "ON AIR" : "LISTENING";
  const recActive = micActive || turn.phase === "speaking";
  const waveState = micActive || turn.phase === "speaking" ? "active" : "idle";

  return (
    <div className="flex flex-1 flex-col">
      <SignalRail sections={RAIL_SECTIONS} />

      <nav className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-17 max-w-6xl items-center justify-between px-6 sm:px-10">
          <span className="font-serif text-lg">
            interview<span className="text-primary font-semibold">.ai</span>
          </span>
          {session?.user ? (
            <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
              {session.user.name ? `Welcome back, ${session.user.name.split(" ")[0]}` : "Go to dashboard"} →
            </Button>
          ) : (
            <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
              Sign in →
            </Button>
          )}
        </div>
      </nav>

      <header className="relative flex min-h-[86vh] flex-col justify-center px-6 py-16 sm:px-10" id="sec-hero">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05 }}>
              <Tally active label="Live mock interview" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16 }}
              className="mt-5 max-w-[15ch] font-serif text-4xl leading-[1.06] font-medium text-balance sm:text-6xl"
            >
              Practice the <em className="text-primary italic">conversation</em>, not just the answers.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.28 }}
              className="mt-5 max-w-[46ch] text-lg text-muted-foreground"
            >
              Upload your resume and the job description. Interview.ai runs a real, adaptive interview — it follows
              up, changes course, and pushes back exactly like a person on the other side of the call would.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Button render={<Link href={ctaHref} />} size="lg" className="gap-2">
                <Sparkles className="size-4" />
                {ctaLabel}
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => setSampleOpen(true)}>
                See a sample session
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="relative"
          >
            <div
              ref={glowRef}
              aria-hidden
              className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary opacity-15 blur-[46px]"
            />
            {motes.map((m) => (
              <span
                key={m.id}
                className="studio-mote"
                style={
                  {
                    left: `${m.left}%`,
                    top: `${m.top}%`,
                    "--dx": `${m.dx}px`,
                    "--dy": `${m.dy}px`,
                    animationDuration: `${m.duration}s`,
                    animationDelay: `${m.delay}s`,
                  } as React.CSSProperties
                }
              />
            ))}

            <div className="overflow-hidden rounded-md border border-border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.4)]">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <Tally active={recActive} label={recLabel} />
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  {formatTimecode(seconds)} / 15:00
                </span>
              </div>
              <div className="h-22 bg-secondary px-6">
                <Waveform state={waveState} analyser={micActive ? micAnalyser : undefined} onLevel={handleLevel} className="h-full w-full" />
              </div>
              <div className="min-h-32 px-5 py-5">
                <Badge variant="outline" className="mb-3.5 font-mono text-[0.7rem] tracking-wider text-muted-foreground uppercase">
                  {topic}
                </Badge>
                <p className="min-h-[3.2em] text-[0.98rem] leading-relaxed">
                  <span className="mb-1 block font-mono text-[0.72rem] tracking-wider text-muted-foreground uppercase">
                    {turn.who}
                  </span>
                  <span className={turn.who === "Candidate" ? "text-muted-foreground" : undefined}>{displayText}</span>
                  <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] animate-pulse bg-primary align-middle" />
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center gap-3">
              <Button
                type="button"
                variant={micActive ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => (micActive ? stopMicTest() : startMicTest())}
              >
                {micActive ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
                {micActive ? "Stop test" : "Test your mic"}
              </Button>
              <span className={micError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{micStatus}</span>
            </div>
          </motion.div>
        </div>
      </header>

      <section className="border-t border-border px-6 py-24 sm:px-10" id="sec-signal">
        <div className="mx-auto max-w-6xl">
          <div className="mb-13 max-w-[46ch]">
            <span className="mb-3 block font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">Signal chain</span>
            <h2 className="font-serif text-3xl font-medium text-balance">Four stages, one continuous session.</h2>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {CHANNELS.map((c, i) => (
              <motion.div
                key={c.code}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5 }}
                className="group relative bg-card px-5.5 py-6.5"
              >
                <span className="studio-led absolute top-4 right-4" style={{ animationDelay: `${i * 0.5}s` }} />
                <span className="mb-2.5 block font-mono text-[0.68rem] tracking-wider text-muted-foreground">{c.code}</span>
                <h3 className="mb-2 text-base font-semibold">{c.title}</h3>
                <p className="mb-4.5 text-sm text-muted-foreground">{c.body}</p>
                <div className="relative h-0.5 overflow-hidden bg-secondary">
                  <div
                    className="absolute inset-0 bg-primary transition-[width] duration-500 ease-out group-hover:w-full"
                    style={{ width: `${c.fill}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-24 sm:px-10" id="sec-rig">
        <div className="mx-auto max-w-6xl">
          <div className="mb-13 max-w-[46ch]">
            <span className="mb-3 block font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">The rig</span>
            <h2 className="font-serif text-3xl font-medium text-balance">Everything you&apos;d expect from the real thing.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RIG_FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
                className="studio-panel flex flex-col gap-3 rounded-md p-5.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <f.icon className="size-4.5" />
                  </div>
                  {f.soon && (
                    <Badge variant="outline" className="text-[0.65rem] font-normal text-muted-foreground">
                      Coming soon
                    </Badge>
                  )}
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Dialog open={sampleOpen} onOpenChange={setSampleOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium">What the room actually looks like.</DialogTitle>
          </DialogHeader>
          <SampleSessionDemo open={sampleOpen} />
        </DialogContent>
      </Dialog>

      <section className="border-t border-border px-6 py-24 sm:px-10" id="sec-score">
        <div className="mx-auto max-w-6xl">
          <div className="mb-13 max-w-[46ch]">
            <span className="mb-3 block font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">End of session</span>
            <h2 className="font-serif text-3xl font-medium text-balance">A scorecard you&apos;d actually trust.</h2>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
            className="grid gap-11 rounded-md border border-border bg-card p-10 sm:grid-cols-[auto_1fr] sm:items-center"
          >
            <div className="relative mx-auto size-32">
              <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                <circle cx="64" cy="64" r="55" fill="none" stroke="var(--secondary)" strokeWidth="8" />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="55"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={345}
                  initial={{ strokeDashoffset: 345 }}
                  whileInView={{ strokeDashoffset: 345 * (1 - 0.76) }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-2xl font-semibold">76</span>
                <span className="text-[0.68rem] text-muted-foreground">OVERALL</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-[120px_1fr_40px] items-center gap-3.5">
                <span className="text-sm text-muted-foreground">Technical</span>
                <Progress value={78} className="h-1" />
                <span className="text-right font-mono text-sm">78</span>
              </div>
              <div className="grid grid-cols-[120px_1fr_40px] items-center gap-3.5">
                <span className="text-sm text-muted-foreground">Communication</span>
                <Progress value={82} className="h-1" />
                <span className="text-right font-mono text-sm">82</span>
              </div>
              <Badge className="mt-1.5 w-fit gap-1.5 bg-chart-1/15 text-chart-1 hover:bg-chart-1/15">
                <Award className="size-3.5" />
                Lean hire — strong on fundamentals
              </Badge>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-20 text-center" id="sec-end">
        <p className="mx-auto mb-6 max-w-[24ch] font-serif text-2xl font-medium text-balance">
          Your next interview starts on air.
        </p>
        <Button render={<Link href={ctaHref} />} size="lg" className="gap-2">
          <Sparkles className="size-4" />
          {ctaLabel}
        </Button>
      </footer>
    </div>
  );
}
