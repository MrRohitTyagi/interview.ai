import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";

// Default ElevenLabs premade voice ("Adam" — a natural, warm male voice) —
// used only if ELEVENLABS_VOICE_ID isn't set, so this works out of the box
// with just an API key. Override via env if a different voice fits the
// "interviewer" persona better; browse IDs at elevenlabs.io/app/voice-library.
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

const bodySchema = z.object({
  text: z.string().min(1).max(4000),
});

// Turns interviewer text into speech via ElevenLabs. Auth-gated since this
// is a paid, per-character API — an unauthenticated caller shouldn't be able
// to burn credits. The client falls back to the browser's built-in
// SpeechSynthesis for ANY non-2xx response here (missing key, invalid key,
// quota exhausted, network hiccup) — so this endpoint can fail freely without
// breaking the interview; see speak() in voice-chat.tsx.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // Not configured (or deliberately unset to force browser TTS) — the
    // client treats this the same as any other failure and falls back.
    return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 503 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  let upstream: Response;
  try {
    upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: parsed.data.text,
        // turbo_v2_5 trades a little quality for much lower latency —
        // matters here since the candidate is sitting in silence waiting
        // for the interviewer to start talking.
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          // Lower stability than the default (0.5) lets the delivery vary
          // pitch/pacing across a sentence instead of sounding flat and
          // even — the single biggest lever for "robotic vs. natural."
          stability: 0.42,
          similarity_boost: 0.8,
          // style > 0 adds back some of the voice's natural expressiveness
          // (turbo/multilingual v2 models support this); speaker_boost
          // sharpens clarity. Both push toward "sounds like a person," not
          // just "is intelligible."
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "ElevenLabs request failed" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // Covers invalid key (401) and quota exhausted (429) alike — the client
    // doesn't need to distinguish, it just falls back either way.
    return NextResponse.json({ error: "ElevenLabs request failed" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
