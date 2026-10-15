import { NextResponse } from "next/server";
import { getFile } from "@/lib/gemini";

export const runtime = "nodejs";

// Polled by the browser until Gemini finishes processing the uploaded video.
export async function GET(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name");
    if (!name || !name.startsWith("files/")) return NextResponse.json({ error: "Bad file name" }, { status: 400 });
    const f = await getFile(name);
    return NextResponse.json({ state: f.state, uri: f.uri, mimeType: f.mimeType, error: f.error ?? null });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
