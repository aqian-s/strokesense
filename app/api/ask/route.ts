import { NextResponse } from "next/server";
import { generate, ASK_SYSTEM, type Content } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 120;

type Msg = { role: "user" | "assistant"; text: string };

// Text-only coaching chat: no video, optional swimmer context, optional saved review to refer to.
export async function POST(req: Request) {
  try {
    const { messages, context, review } = (await req.json()) as {
      messages: Msg[];
      context?: string;
      review?: { title: string; createdAt: number; prompt: string; analysis: unknown } | null;
    };
    if (!messages?.length) return NextResponse.json({ error: "No message" }, { status: 400 });

    const preamble: string[] = [];
    if (context?.trim()) preamble.push(`About the swimmer (provided by them): ${context.trim()}`);
    if (review?.analysis) {
      preamble.push(
        `They have shared a previous video review from ${new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ` +
          `("${review.title}", they asked: "${review.prompt || "general review"}"). Use it as context when relevant:\n${JSON.stringify(review.analysis)}`
      );
    }

    const contents: Content[] = [];
    if (preamble.length) {
      contents.push({ role: "user", parts: [{ text: preamble.join("\n\n") }] });
      contents.push({ role: "model", parts: [{ text: "Got it — I'll keep that in mind." }] });
    }
    for (const m of messages) {
      contents.push({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] });
    }

    const reply = await generate({ system: ASK_SYSTEM, contents });
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
