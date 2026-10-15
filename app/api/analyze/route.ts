import { NextResponse } from "next/server";
import { generate, COACH_SYSTEM, ANALYSIS_SCHEMA } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { fileUri, mimeType, prompt } = await req.json();
    if (!fileUri) return NextResponse.json({ error: "Missing video" }, { status: 400 });
    const userText = `Analyze this swimming video.\n\nWhat the swimmer wants help with: ${
      prompt?.trim() || "General technique review — find the biggest issues and how to fix them."
    }\n\nReturn the structured analysis.`;
    const text = await generate({
      system: COACH_SYSTEM,
      json: true,
      schema: ANALYSIS_SCHEMA,
      contents: [{ role: "user", parts: [{ fileData: { fileUri, mimeType } }, { text: userText }] }],
    });
    let analysis;
    try {
      analysis = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "The model returned an unreadable answer. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
