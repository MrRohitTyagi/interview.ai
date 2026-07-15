"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { signIn } from "next-auth/react";
import { Award, KeyRound, Loader2, Mail, Mic, RotateCcw, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const VALUE_PROPS = [
  { icon: Mic, text: "A live, spoken interview that follows up and pushes back like a real one." },
  { icon: Award, text: "A calibrated scorecard the moment the session ends — not a generic score." },
  { icon: RotateCcw, text: "Cancel or pick back up anytime — nothing about it is a one-shot deal." },
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

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setError(null);
    setCode("");
  }

  async function completeSignIn() {
    const result = await signIn("password", { email, password, redirect: false });
    if (result?.error) {
      setError("That didn't work — try signing in again.");
      return false;
    }
    // replace, not push — /sign-in must not remain in browser history after
    // a successful sign-in, otherwise pressing "back" later from anywhere
    // in the app can resurface it.
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
      toast.info("Verify your email to finish signing in — check your inbox for the code.");
      return;
    }
    if (result?.error) {
      setError("Wrong email or password.");
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
      if (!res.ok) throw new Error(data.error ?? "Couldn't create your account.");
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account.");
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
      if (!res.ok) throw new Error(data.error ?? "That code is invalid or expired.");
      const signedIn = await completeSignIn();
      if (!signedIn) setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code is invalid or expired.");
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
      toast.success("New code sent.");
    } catch {
      toast.error("Couldn't resend the code — try again in a moment.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mx-auto grid w-full max-w-4xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block"
        >
          <Link href="/" className="font-serif text-lg text-muted-foreground hover:text-foreground">
            interview<span className="accent-text font-semibold">.ai</span>
          </Link>
          <h1 className="mt-5 max-w-[16ch] font-serif text-3xl leading-[1.1] font-medium text-balance">
            One sign-in. A full practice studio.
          </h1>
          <ul className="mt-7 flex flex-col gap-4">
            {VALUE_PROPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-sm"
        >
          <Link
            href="/"
            className="mb-6 block font-serif text-lg text-muted-foreground hover:text-foreground lg:hidden"
          >
            interview<span className="accent-text font-semibold">.ai</span>
          </Link>

          <Card className="studio-panel studio-glow">
            <CardHeader>
              <CardTitle>{step === "verify" ? "Verify your email" : mode === "signin" ? "Sign in" : "Create your account"}</CardTitle>
              <CardDescription>
                {step === "verify"
                  ? `We sent a code to ${email}.`
                  : mode === "signin"
                    ? "Practice interviews start here."
                    : "Takes a minute — practice interviews start right after."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {step === "form" && mode === "signin" && (
                <form className="flex flex-col gap-3" onSubmit={handleSignIn}>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              )}

              {step === "form" && mode === "signup" && (
                <form className="flex flex-col gap-3" onSubmit={handleSignUp}>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <User className="size-4" />}
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              )}

              {step === "verify" && (
                <form className="flex flex-col gap-3" onSubmit={handleVerify}>
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono tracking-widest"
                    autoFocus
                  />
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                    {loading ? "Verifying…" : "Verify & continue"}
                  </Button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="cursor-pointer text-xs text-muted-foreground hover:text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resending ? "Sending…" : "Resend code"}
                  </button>
                </form>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              {step === "form" && (
                <p className="text-center text-xs text-muted-foreground">
                  {mode === "signin" ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("signin")}
                        className="cursor-pointer text-primary hover:underline"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
