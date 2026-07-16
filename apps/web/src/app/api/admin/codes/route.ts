import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { db, redeemCodes } from "@ai-interviewer/db";
import { desc } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/lib/auth";

const bodySchema = z.object({
  code: z.string().trim().max(64).optional(),
  credits: z.number().int().min(1).max(10000),
  maxUses: z.number().int().min(1).max(100000),
});

function generateCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt));
  return NextResponse.json(codes);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const code = (parsed.data.code || generateCode()).toUpperCase();

  const [created] = await db
    .insert(redeemCodes)
    .values({
      code,
      credits: parsed.data.credits,
      maxUses: parsed.data.maxUses,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(created);
}
