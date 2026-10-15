import { NextResponse } from "next/server";
import { generate, COACH_SYSTEM } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

// Compares two saved reviews (older vs newer) and reports what changed.
// Works from the structured reports, so it doesn't depend on the videos still being available.
export async function POST(req: Request) {
  try {
    const { older, newer } = (await req.json()) as {
      older: { title: string; createdAt: number; prompt: string; analysis: unknown };
      newer: { title: string; createdAt: number; prompt: string; analysis: unknown };
    };
    if (!older?.analysis || !newer?.analysis) return NextResponse.json({ error: "Both sessions need a finished review." }, { status: 400 });

    const d = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const text = `You reviewed the same swimmer twice. Compare the two reviews and tell them what changed.

EARLIER review (${d(older.createdAt)}, "${older.title}", asked: "${older.prompt || "general review"}"):
${JSON.stringify(older.analysis)}

LATER review (${d(newer.createdAt)}, "${newer.title}", asked: "${newer.prompt || "general review"}"):
${JSON.stringify(newer.analysis)}

Write a short progress report in plain text (no markdown headers, no asterisks). Use these labeled sections, each a few lines:
Improved — issues from the earlier review that are gone or reduced.
Still there — issues that persist, and whether they got better or worse.
New — anything that only appears in the later review.
Next focus — the single most valuable thing to work on now, with one drill.
Be honest: if the two clips were different strokes or different angles, say the comparison is limited and why.`;

    const reply = await generate({ system: COACH_SYSTEM, contents: [{ role: "user", parts: [{ text }] }] });
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
