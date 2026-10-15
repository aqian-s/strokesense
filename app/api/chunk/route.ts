import { NextResponse } from "next/server";
import { apiKey } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

// Receives one chunk of the video from the browser and forwards it to Google's
// resumable upload session. Chunks are ~3.5 MB so they stay under Vercel's
// request-size limit; the final chunk also finalizes the upload.
export async function POST(req: Request) {
  try {
    const uploadUrl = req.headers.get("x-upload-url");
    const offset = req.headers.get("x-upload-offset");
    const last = req.headers.get("x-upload-last") === "1";
    if (!uploadUrl || offset === null) return NextResponse.json({ error: "Missing upload headers" }, { status: 400 });
    if (!uploadUrl.startsWith("https://generativelanguage.googleapis.com/")) {
      return NextResponse.json({ error: "Bad upload URL" }, { status: 400 });
    }

    const bytes = Buffer.from(await req.arrayBuffer());
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey(),
        "Content-Length": String(bytes.length),
        "X-Goog-Upload-Offset": offset,
        "X-Goog-Upload-Command": last ? "upload, finalize" : "upload",
      },
      body: bytes,
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `Google rejected chunk (${res.status}): ${text.slice(0, 200)}` }, { status: 502 });

    if (last) {
      try {
        const data = JSON.parse(text);
        return NextResponse.json({ file: data.file });
      } catch {
        return NextResponse.json({ error: "Upload finished but Google's response was unreadable." }, { status: 502 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
