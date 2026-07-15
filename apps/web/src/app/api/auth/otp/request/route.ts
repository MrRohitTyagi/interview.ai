import { NextResponse } from "next/server";
import { z } from "zod";

import { requestOtp } from "@/lib/otp";

const bodySchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  await requestOtp(parsed.data.email);

  return NextResponse.json({ ok: true });
}
