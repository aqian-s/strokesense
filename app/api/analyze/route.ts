import { NextResponse } from "next/server";
import { generate, videoPart, COACH_SYSTEM, ANALYSIS_SCHEMA } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  try {
    const { fileUri, mimeType, prompt, strokeHint, clipStart, clipEnd } = await req.json();
    if (!fileUri) return NextResponse.json({ error: "Missing video" }, { status: 400 });
    const windowNote =
      typeof clipStart === "number" || typeof clipEnd === "number"
        ? `\nOnly the section from ${fmt(clipStart ?? 0)} to ${clipEnd ? fmt(clipEnd) : "the end"} of the video is provided; report timestamps relative to the full video.`
        : "";
    const hint = strokeHint && strokeHint !== "Not sure" ? `\nThe swimmer says this is ${strokeHint}.` : "";
    const userText = `Analyze this swimming video.${hint}${windowNote}\n\nWhat the swimmer wants help with: ${
      prompt?.trim() || "General technique review — find the biggest issues and how to fix them."
    }\n\nReturn the structured analysis.`;
    const text = await generate({
      system: COACH_SYSTEM,
      json: true,
      schema: ANALYSIS_SCHEMA,
      contents: [{ role: "user", parts: [videoPart(fileUri, mimeType, clipStart, clipEnd), { text: userText }] }],
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
