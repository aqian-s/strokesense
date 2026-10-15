import { NextResponse } from "next/server";
import { generate, COACH_SYSTEM, type Content } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; text: string };

export async function POST(req: Request) {
  try {
    const { fileUri, mimeType, prompt, analysis, messages } = (await req.json()) as {
      fileUri: string; mimeType: string; prompt: string; analysis: unknown; messages: Msg[];
    };
    if (!messages?.length) return NextResponse.json({ error: "No message" }, { status: 400 });

    const intro = `Here is the swimmer's video. Their original request: "${prompt || "general technique review"}".\n` +
      `You already produced this analysis (JSON):\n${JSON.stringify(analysis)}\n\n` +
      `Continue as their coach. Answer follow-up questions, look back at the video when asked about specific moments, ` +
      `suggest drills and progressions, and keep answers focused and reasonably short. Use plain text with short paragraphs or simple dashes for lists; no markdown headers.`;

    const contents: Content[] = [
      { role: "user", parts: [{ fileData: { fileUri, mimeType } }, { text: intro }] },
      { role: "model", parts: [{ text: "Understood. I have the video and my analysis in front of me. What would you like to go over?" }] },
      ...messages.map((m) => ({ role: (m.role === "user" ? "user" : "model") as "user" | "model", parts: [{ text: m.text }] })),
    ];
    const reply = await generate({ system: COACH_SYSTEM, contents });
    return NextResponse.json({ reply });
  } catch (e: unknown) {
    const msg = (e as Error).message || "Unknown error";
    const expired = /403|404|PERMISSION_DENIED|not found|expired/i.test(msg);
    return NextResponse.json(
      { error: expired ? "This video has expired on the server (uploads last ~48 hours). Start a new session and re-upload it." : msg },
      { status: 500 }
    );
  }
}
