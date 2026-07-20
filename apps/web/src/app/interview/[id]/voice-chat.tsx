"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Award,
  Ban,
  Loader2,
  MessagesSquare,
  Mic,
  MicOff,
  Volume2,
} from "lucide-react";
import type {
  ResumeAnalysis,
  JDAnalysis,
  PlannedTopic,
} from "@ai-interviewer/ai-core";
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

type TranscriptEntry = {
  question: string;
  answer: string | null;
  topic: string;
};
type Phase =
  | "idle"
  | "speaking"
  | "listening"
  | "thinking"
  | "done"
  | "unsupported";

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.round(seconds));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onAudioData: (base64Chunk: string) => void;

  constructor(onAudioData: (base64Chunk: string) => void) {
    this.onAudioData = onAudioData;
  }

  async start() {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: 16000 });

    const workletCode = `
      class PCMProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0];
          if (input && input.length > 0) {
            const channelData = input[0];
            const pcm16 = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
              const s = Math.max(-1, Math.min(1, channelData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.port.postMessage(pcm16.buffer);
          }
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);
    `;
    const blob = new Blob([workletCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioContext.createMediaStreamSource(this.stream);

    this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-processor");
    this.workletNode.port.onmessage = (event) => {
      const arrayBuffer = event.data;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      this.onAudioData(base64);
    };

    source.connect(this.workletNode);
    this.workletNode.connect(this.audioContext.destination);
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;

  private initContext() {
    if (!this.audioContext) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.audioContext.currentTime;
    }
  }

  resume() {
    this.initContext();
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  playChunk(base64Data: string) {
    this.initContext();
    if (!this.audioContext) return;

    const raw = atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    const scale = 32768.0;
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / scale;
    }

    const audioBuf = this.audioContext.createBuffer(
      1,
      float32Array.length,
      24000,
    );
    audioBuf.copyToChannel(float32Array, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuf;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    if (this.nextPlayTime < now) {
      this.nextPlayTime = now + 0.02;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuf.duration;
    this.isPlaying = true;

    source.onended = () => {
      if (
        this.audioContext &&
        this.audioContext.currentTime >= this.nextPlayTime - 0.05
      ) {
        this.isPlaying = false;
      }
    };
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.nextPlayTime = 0;
    this.isPlaying = false;
  }

  getIsPlaying() {
    if (!this.audioContext || this.audioContext.state === "suspended")
      return false;
    return this.audioContext.currentTime < this.nextPlayTime;
  }
}

export interface VoiceChatProps {
  interviewId: string;
  initialTranscript: {
    question: string;
    answer: string | null;
    topic: string | null;
  }[];
  initialCompleted: boolean;
  startedAt: string | null;
  durationMinutes: number;
  plan?: PlannedTopic[];
  resume?: ResumeAnalysis | null;
  jd?: JDAnalysis | null;
  candidateName?: string;
  interviewType?: string;
}

export function VoiceChat({
  interviewId,
  initialTranscript,
  initialCompleted,
  startedAt,
  durationMinutes,
  plan,
  resume,
  jd,
  candidateName,
  interviewType,
}: VoiceChatProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(
    initialTranscript as TranscriptEntry[],
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [started, setStarted] = useState(false);
  const [completed] = useState(initialCompleted);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioPlayer();
    }
    return () => {
      audioPlayerRef.current?.stop();
    };
  }, []);

  const phaseRef = useRef<Phase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const currentSpokenTextRef = useRef<string>("");

  const completedRef = useRef<boolean>(completed);
  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  const transcriptRef = useRef<TranscriptEntry[]>(transcript);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const currentTopic = transcript[transcript.length - 1]?.topic ?? null;
  const history = transcript.filter((entry) => entry.answer !== null);
  const isResuming = history.length > 0;

  useEffect(() => {
    if (!startedAt || completed) return;
    const deadline =
      new Date(startedAt).getTime() + durationMinutes * 60 * 1000;
    function tick() {
      setRemainingSeconds(Math.max(0, (deadline - Date.now()) / 1000));
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMinutes, completed]);

  useEffect(() => {
    return () => {
      audioRecorderRef.current?.stop();
      audioPlayerRef.current?.stop();
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  async function startListening() {
    setLiveTranscript("");
    try {
      audioRecorderRef.current = new AudioRecorder((base64Chunk) => {
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN &&
          phaseRef.current === "listening"
        ) {
          const streamMsg = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Chunk,
                },
              ],
            },
          };
          socketRef.current.send(JSON.stringify(streamMsg));
        }
      });
      await audioRecorderRef.current.start();
    } catch (err) {
      console.error("Failed to start recording:", err);
      toast.error("Could not access microphone");
      setPhase("idle");
      setStarted(false);
    }
  }

  async function syncTurnToBackend(
    question: string,
    answer: string,
    topic: string,
  ) {
    try {
      setTranscript((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.answer === null) {
          last.answer = answer;
        } else {
          copy[copy.length - 1] = { ...last, answer };
        }
        return [...copy, { question, answer: null, topic }];
      });
    } catch (err) {
      console.error("Failed to sync turn", err);
    }
  }

  async function submitAnswer() {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          clientContent: {
            turnComplete: true,
          },
        })
      );
      setPhase("thinking");
    }
  }

  async function begin() {
    // 1. Clean up any existing socket connection and media recorders/players to prevent overlapping threads
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {
        console.error("Error closing existing socket:", e);
      }
      socketRef.current = null;
    }
    audioRecorderRef.current?.stop();
    audioPlayerRef.current?.stop();

    audioPlayerRef.current?.resume();
    setStarted(true);
    setPhase("thinking");

    try {
      const tokenRes = await fetch("/api/interviews/gemini-token");
      if (!tokenRes.ok)
        throw new Error("Could not load API credentials from server");
      const { key } = await tokenRes.json();

      // Use v1beta endpoint for stable Gemini Multimodal Live API (BidiGenerateContent)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        const dynamicInstruction = 
          `You are John, an AI interviewer. You are conducting a voice call.\n` +
          `Candidate: ${candidateName}\n` +
          `Role/Topics: ${interviewType}\n` +
          `Plan: ${JSON.stringify(plan)}\n\n` +
          `CRITICAL RULES:\n` +
          `1. You are speaking directly to the candidate. Start by introducing yourself and asking the first question.\n` +
          `2. NEVER output any thoughts, reasoning, planning, or markdown. Output ONLY the exact spoken words.\n` +
          `3. Keep responses conversational and brief.\n` +
          `4. If the candidate answers poorly, correct them briefly and move to the next question.`;

        const setupMsg = {
          setup: {
            // Use models/gemini-2.5-flash-native-audio-latest which natively supports Bidi WebSocket connections and real-time audio
            model: "models/gemini-2.5-flash-native-audio-latest",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Puck",
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: dynamicInstruction }],
            },
          },
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event) => {
        try {
          let textData = event.data;
          if (textData instanceof Blob) {
            textData = await textData.text();
          } else if (textData instanceof ArrayBuffer) {
            textData = new TextDecoder().decode(textData);
          }
          const msg = JSON.parse(textData);

          if (msg.error) {
            console.error("Gemini Live WebSocket error:", msg.error);
            toast.error(
              `Gemini Live Error: ${msg.error.message || "Unknown error"}`,
            );
            setPhase("idle");
            setStarted(false);
            return;
          }

          if (msg.setupComplete || msg.setup_complete) {
            console.log("Gemini Live setup complete acknowledgment received");
            const last =
              transcriptRef.current[transcriptRef.current.length - 1];
            const isResuming = history.length > 0;
            const startPrompt = isResuming 
              ? "We are resuming the interview. Please continue from where we left off."
              : "Hello John, I am ready for my interview. Please begin.";

            const speakMsg = {
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: startPrompt,
                      },
                    ],
                  },
                ],
                turnComplete: true,
              },
            };
            ws.send(JSON.stringify(speakMsg));
            setPhase("speaking");
            return;
          }

          const serverContent = msg.serverContent || msg.server_content;
          if (serverContent) {
            const modelTurn =
              serverContent.modelTurn || serverContent.model_turn;
            const parts = modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                const inlineData = part.inlineData || part.inline_data;
                if (inlineData && inlineData.data) {
                  audioPlayerRef.current?.playChunk(inlineData.data);
                  if (phaseRef.current !== "speaking") setPhase("speaking");
                }
                const text = part.text;
                if (text) {
                  currentSpokenTextRef.current += text;
                }
              }
            }

            const inputTranscription =
              serverContent.inputTranscription ||
              serverContent.input_transcription;
            if (inputTranscription && inputTranscription.text) {
              setLiveTranscript(inputTranscription.text);
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
              const spokenText = currentSpokenTextRef.current.trim();
              if (spokenText) {
                syncTurnToBackend(spokenText, liveTranscript, transcriptRef.current[transcriptRef.current.length - 1]?.topic ?? "");
                setLiveTranscript("");
                currentSpokenTextRef.current = "";
              }

              const checkPlaying = setInterval(() => {
                if (!audioPlayerRef.current?.getIsPlaying()) {
                  clearInterval(checkPlaying);
                  if (phaseRef.current === "speaking") {
                    setPhase("listening");
                    startListening();
                  } else if (
                    phaseRef.current === "thinking" &&
                    completedRef.current
                  ) {
                    setPhase("done");
                  }
                }
              }, 100);
            }
          }
        } catch (err) {
          console.error("Failed to parse Gemini message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("Gemini Live WebSocket error:", err);
        toast.error(
          "WebSocket connection encountered an error (check console)",
        );
      };

      ws.onclose = (event) => {
        console.log("Gemini Live WebSocket closed", event.code, event.reason);
        if (phaseRef.current !== "done") {
          toast.error(
            `Session connection lost. Code: ${event.code}, Reason: ${event.reason || "None"}`,
          );
          setPhase("idle");
          setStarted(false);
        }
      };
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start session",
      );
      setStarted(false);
      setPhase("idle");
    }
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to cancel interview");

      audioRecorderRef.current?.stop();
      audioPlayerRef.current?.stop();
      socketRef.current?.close();

      router.push("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel interview",
      );
      setCancelling(false);
    }
  }

  const lastQuestion = transcript[transcript.length - 1]?.question ?? "";
  const displayText = lastQuestion;
  const tallyActive = phase === "speaking" || phase === "listening";
  const tallyLabel =
    phase === "speaking"
      ? "On air"
      : phase === "listening"
        ? "Listening"
        : phase === "thinking"
          ? "Thinking"
          : "Standby";

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
          {currentTopic && !completed && (
            <Badge variant="secondary">{currentTopic}</Badge>
          )}
          {started && !completed && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setCancelOpen(true)}
            >
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
              This ends the session right away; there&apos;s no pausing or
              resuming. It won&apos;t count as completed and there&apos;s no
              report for it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep going
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelConfirm}
              disabled={cancelling}
              className="gap-2"
            >
              {cancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              {cancelling ? "Ending…" : "End interview"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {phase === "unsupported" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <MicOff className="size-5" />
          <p className="max-w-md font-medium text-foreground">
            This browser can&apos;t run the interview
          </p>
          <p className="max-w-md">
            Interviews here are spoken, not typed, and that needs the Web Speech
            API — supported in Chrome and Edge. Try again in one of those.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 lg:overflow-hidden w-full max-w-5xl mx-auto">
          {/* Top row: Video Call Layout */}
          <div className="flex w-full flex-col sm:flex-row gap-6 justify-center items-center py-4">
            <div className="w-64 h-64 sm:w-[22rem] sm:h-[22rem] flex items-center justify-center rounded-3xl overflow-hidden bg-black/5 ring-1 ring-border shadow-sm relative shrink-0">
               <CameraPanel
                 interviewId={interviewId}
                 active={phase === "listening"}
                 variant="fill"
               />
            </div>
            
            <div className="w-64 h-64 sm:w-[22rem] sm:h-[22rem] flex flex-col items-center justify-center rounded-3xl overflow-hidden bg-black/5 ring-1 ring-border shadow-sm relative shrink-0">
               <div className={tileFrameClassName(phase === "speaking", "fill")}>
                 <InterviewerAvatar active={phase === "speaking"} />
                 <span className={tileLabelClassName}>
                   <span className={tileStatusDotClassName(phase === "speaking")} />
                   Interviewer
                 </span>
               </div>
            </div>
          </div>

          {/* Bottom row: Controls & Text */}
          <div className="flex w-full flex-col gap-6 items-center bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex w-full items-center justify-between">
              <Tally active={tallyActive} label={tallyLabel} />
              {remainingSeconds !== null && !completed && (
                <span
                  className={
                    remainingSeconds <= 60
                      ? "pulse-glow rounded-full bg-destructive/10 px-3 py-1 font-mono text-sm text-destructive font-semibold"
                      : "font-mono text-sm text-muted-foreground font-semibold"
                  }
                >
                  {formatCountdown(remainingSeconds)}
                </span>
              )}
            </div>

            {!started ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <p className="max-w-md text-sm text-muted-foreground">
                  {isResuming
                    ? `You're picking back up where you left off, with ${history.length} question${history.length === 1 ? "" : "s"} already answered. The interviewer will re-ask the current question.`
                    : "This interview is a real spoken conversation: your mic drives it, and the interviewer talks back. Nothing is uploaded except your answers."}
                </p>
                <Button onClick={begin} size="lg" className="studio-glow gap-2 rounded-full px-8 h-12">
                  <Mic className="size-4" />
                  {isResuming ? "Resume interview" : "Start interview"}
                </Button>
              </div>
            ) : completed ? (
              phase === "done" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <p className="font-medium text-lg">Interview complete</p>
                  <Button
                    render={
                      <Link href={`/interview/${interviewId}/report`} />
                    }
                    className="studio-glow gap-2 rounded-full px-8 h-12"
                  >
                    <Award className="size-4" />
                    View report
                  </Button>
                </div>
              )
            ) : (
              <div className="flex w-full flex-col items-center text-center gap-6">
                <div className="flex flex-col items-center gap-3 min-h-[5rem]">
                  <span className="flex items-center gap-2 font-mono text-xs tracking-widest text-muted-foreground uppercase font-semibold">
                    {phase === "thinking" && (
                      <Loader2 className="size-3 animate-spin" />
                    )}
                    {phase === "thinking" ? "Thinking" : "Interviewer"}
                  </span>
                  <motion.p
                    key={displayText}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="font-serif text-xl text-balance font-medium leading-relaxed"
                  >
                    {displayText}
                  </motion.p>
                </div>

                {phase === "listening" && liveTranscript && (
                  <motion.p 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="text-base text-muted-foreground italic font-medium mt-2 max-w-2xl"
                  >
                    “{liveTranscript}”
                  </motion.p>
                )}

                <Button
                  onClick={submitAnswer}
                  disabled={phase !== "listening"}
                  size="lg"
                  variant={phase === "listening" ? "default" : "secondary"}
                  className={
                    phase === "listening"
                      ? "studio-glow w-full sm:w-96 justify-center gap-4 bg-red-500 hover:bg-red-600 text-white animate-pulse h-16 rounded-full transition-all"
                      : "w-full sm:w-96 justify-center gap-4 h-16 opacity-80 rounded-full transition-all"
                  }
                >
                  {phase === "listening" ? (
                    <>
                      <Mic className="size-6" />
                      <div className="flex flex-col items-start text-left leading-tight">
                        <span className="font-bold text-[1rem]">
                          Microphone is ON
                        </span>
                        <span className="text-xs opacity-90 font-medium">
                          Speak your answer, then click to submit
                        </span>
                      </div>
                    </>
                  ) : phase === "speaking" ? (
                    <>
                      <Volume2 className="size-6 text-primary" />
                      <div className="flex flex-col items-start text-left leading-tight">
                        <span className="font-bold text-[1rem]">
                          Interviewer is speaking...
                        </span>
                        <span className="text-xs opacity-90 font-medium">
                          Please listen
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-6 animate-spin" />
                      <div className="flex flex-col items-start text-left leading-tight">
                        <span className="font-bold text-[1rem]">
                          Interviewer is thinking...
                        </span>
                        <span className="text-xs opacity-90 font-medium">
                          Generating the next question
                        </span>
                      </div>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
