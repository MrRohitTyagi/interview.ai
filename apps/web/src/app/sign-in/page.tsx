"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { signIn } from "next-auth/react";
import { Award, KeyRound, Loader2, Mail, Mic, RotateCcw, User, Disc } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VALUE_PROPS = [
  { icon: Mic, title: "Bidirectional Speech", desc: "Speak naturally; our Gemini Live interface follows up and guides topics in real time." },
  { icon: Award, title: "Calibrated Scorecard", desc: "Receive granular scores for communication and technical depth as soon as you finish." },
  { icon: RotateCcw, title: "Fluid Sessions", desc: "Pause, resume, or restart at any time: your session history is fully stateful." },
];

type Mode = "signin" | "signup";
type Step = "form" | "verify";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mouse tracking for custom spot light effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty("--x", `${x}%`);
      document.documentElement.style.setProperty("--y", `${y}%`);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setError(null);
    setCode("");
  }

  async function completeSignIn() {
    const result = await signIn("password", { email, password, redirect: false });
    if (result?.error) {
      setError("Authorization credentials rejected.");
      return false;
    }
    router.replace("/dashboard");
    return true;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("password", { email, password, redirect: false });
    setLoading(false);
    if (result?.code === "email_not_verified") {
      setStep("verify");
      toast.info("A 6-digit code has been dispatched to your email.");
      return;
    }
    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.replace("/dashboard");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not build workspace user.");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification code rejected.");
      const signedIn = await completeSignIn();
      if (!signedIn) setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code validation failed.");
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      toast.success("Verification token dispatched.");
    } catch {
      toast.error("Dispatched throttled — try again shortly.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background font-sans items-center justify-center p-4 md:p-8">
      {/* Decorative Stage Elements */}
      <div className="studio-grain" />
      <div className="studio-vignette" />
      <div className="studio-spotlight" />

      {/* Main Grid Workspace */}
      <div className="relative z-10 grid w-full max-w-4xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:max-h-[85vh]">
        
        {/* Left Side: Brand Identity Canvas */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex flex-col h-full justify-between py-2 pr-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="studio-tally" />
              <Link href="/" className="font-serif text-sm font-medium tracking-tight text-foreground">
                interview<span className="accent-text font-semibold text-primary">.ai</span>
              </Link>
            </div>
            
            <h1 className="mt-4 font-serif text-4xl leading-[1.1] font-light text-balance text-foreground">
              Speak to the <span className="accent-text font-serif italic font-medium">interview engine</span>
            </h1>
            <p className="mt-2 text-xs text-muted-foreground max-w-[38ch] leading-relaxed">
              Experience the first multimodal voice-to-voice mock platform built directly on Google Gemini Live.
            </p>

            {/* Values / Features list */}
            <div className="mt-6 flex flex-col gap-4">
              {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 items-start">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card border border-border text-primary studio-glow">
                    <Icon className="size-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[0.68rem] font-semibold text-foreground uppercase tracking-wider font-mono">
                      {title}
                    </h3>
                    <p className="mt-0.5 text-[0.68rem] text-muted-foreground max-w-[34ch] leading-normal">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Waveform Panel */}
          <div className="mt-6 rounded-xl border border-border bg-card/40 p-4 relative overflow-hidden flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Disc className="size-3 text-primary animate-spin" />
                <span className="text-[0.58rem] font-mono uppercase tracking-wider text-muted-foreground">Live Feed Studio Signal</span>
              </div>
              <span className="font-mono text-[0.58rem] text-primary">PCM_16K_MONO</span>
            </div>
            <div className="flex items-end gap-1 h-8 px-2 justify-center">
              {[25, 45, 15, 60, 35, 75, 40, 90, 50, 20, 45, 30, 80, 55, 10, 45, 35, 65, 20, 35, 50].map((h, index) => (
                <motion.div
                  key={index}
                  className="w-0.75 rounded-full bg-primary"
                  animate={{ height: [`${h}%`, `${h * 0.3}%`, `${h}%`] }}
                  transition={{
                    duration: 1.2 + ((index * 0.3) % 1.5),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.04
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right Side: Account Actions Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-sm"
        >
          {/* Mobile Brand Link */}
          <div className="flex items-center gap-2 mb-4 lg:hidden">
            <span className="studio-tally" />
            <Link href="/" className="font-serif text-sm text-muted-foreground hover:text-foreground">
              interview<span className="text-primary font-bold">.ai</span>
            </Link>
          </div>

          <Card className="studio-panel studio-glow">
            <CardHeader className="space-y-1 p-5 pb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.52rem] uppercase tracking-widest text-muted-foreground">
                  {step === "verify" ? "STAGE_02 // CONFIRMATION" : mode === "signin" ? "STAGE_01 // SECURE_ACCESS" : "STAGE_01 // REGISTER"}
                </span>
                {step === "form" && (
                  <div className="flex gap-1 rounded-md bg-secondary/60 p-0.5 border border-border">
                    <button
                      onClick={() => switchMode("signin")}
                      className={`rounded px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider transition-all ${
                        mode === "signin"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => switchMode("signup")}
                      className={`rounded px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wider transition-all ${
                        mode === "signup"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </div>
              <CardTitle className="text-xl font-serif font-light tracking-tight mt-1.5">
                {step === "verify" ? "Verify identity" : mode === "signin" ? "Welcome Back" : "Create Account"}
              </CardTitle>
              <CardDescription className="text-[0.68rem] leading-normal">
                {step === "verify"
                  ? `Enter the validation code sent to ${email}.`
                  : mode === "signin"
                    ? "Enter your credentials to enter the mock studio."
                    : "Fill in the fields below to establish your profile."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-5 pt-0">
              <AnimatePresence mode="wait">
                {step === "form" && mode === "signin" && (
                  <motion.form
                    key="signin"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-2.5"
                    onSubmit={handleSignIn}
                  >
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="email" className="text-[0.62rem] font-mono uppercase tracking-wider text-muted-foreground">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="bg-background/40 hover:border-primary/30 focus-visible:ring-primary/40 focus:border-primary/50 transition-all duration-200 h-9 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="password" className="text-[0.62rem] font-mono uppercase tracking-wider text-muted-foreground">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-background/40 hover:border-primary/30 focus-visible:ring-primary/40 focus:border-primary/50 transition-all duration-200 h-9 text-xs"
                      />
                    </div>
                    <Button type="submit" disabled={loading} className="gap-2 w-full mt-1 studio-glow h-9 text-xs">
                      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                      {loading ? "Authorizing Session…" : "Enter Studio"}
                    </Button>
                  </motion.form>
                )}

                {step === "form" && mode === "signup" && (
                  <motion.form
                    key="signup"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-2"
                    onSubmit={handleSignUp}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="name" className="text-[0.58rem] font-mono uppercase tracking-wider text-muted-foreground">Full Name</Label>
                      <Input
                        id="name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        className="bg-background/40 hover:border-primary/30 focus-visible:ring-primary/40 focus:border-primary/50 transition-all duration-200 h-8.5 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="signup-email" className="text-[0.58rem] font-mono uppercase tracking-wider text-muted-foreground">Email Address</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="bg-background/40 hover:border-primary/30 focus-visible:ring-primary/40 focus:border-primary/50 transition-all duration-200 h-8.5 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="signup-password" className="text-[0.58rem] font-mono uppercase tracking-wider text-muted-foreground">Password</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="bg-background/40 hover:border-primary/30 focus-visible:ring-primary/40 focus:border-primary/50 transition-all duration-200 h-8.5 text-xs"
                      />
                    </div>
                    <Button type="submit" disabled={loading} className="gap-2 w-full mt-1.5 studio-glow h-9 text-xs">
                      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <User className="size-3.5" />}
                      {loading ? "Compiling Profile…" : "Register Profile"}
                    </Button>
                  </motion.form>
                )}

                {step === "verify" && (
                  <motion.form
                    key="verify"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-2.5"
                    onSubmit={handleVerify}
                  >
                    <Label htmlFor="code" className="text-[0.62rem] font-mono uppercase tracking-wider text-muted-foreground flex justify-between">
                      <span>One-Time Passcode</span>
                      <span className="text-[0.58rem] text-primary lowercase">(use 123456 for test)</span>
                    </Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="font-mono tracking-[0.4em] text-center text-lg bg-background/40 hover:border-primary/30 focus-visible:ring-primary/40 focus:border-primary/50 transition-all duration-200 h-9.5"
                      autoFocus
                    />
                    <Button type="submit" disabled={loading} className="gap-2 w-full mt-1 studio-glow h-9.5 text-xs">
                      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                      {loading ? "Verifying Token…" : "Confirm Identity"}
                    </Button>
                    <div className="flex justify-center mt-1">
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resending}
                        className="cursor-pointer text-[0.62rem] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
                      >
                        {resending ? "Re-transmitting…" : "[ Re-transmit Token ]"}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="text-[0.68rem] text-destructive text-center font-mono"
                >
                  ! {error}
                </motion.p>
              )}

              {step === "form" && (
                <>
                  <div className="relative flex items-center justify-center my-0.5 text-xs">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <span className="relative bg-card px-2.5 text-muted-foreground uppercase font-mono text-[0.52rem]">Or</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLoading(true);
                      signIn("google", { callbackUrl: "/dashboard" });
                    }}
                    disabled={loading}
                    className="gap-2.5 w-full font-medium hover:bg-secondary/40 hover:border-primary/30 hover:studio-glow transition-all duration-300 h-9 text-xs"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
