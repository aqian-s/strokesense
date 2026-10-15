import { NextResponse } from "next/server";
import { startUpload } from "@/lib/gemini";

export const runtime = "nodejs";

// Creates a resumable upload session with Gemini and hands the browser the
// one-time upload URL so the video bytes go straight from the user's device to
// Google (Vercel functions can't accept large request bodies).
export async function POST(req: Request) {
  try {
    const { name, mimeType, size } = await req.json();
    if (!mimeType || !size) return NextResponse.json({ error: "Missing file info" }, { status: 400 });
    const uploadUrl = await startUpload(String(name || "swim-video"), String(mimeType), Number(size));
    return NextResponse.json({ uploadUrl });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
