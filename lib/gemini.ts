// Server-only helpers that talk to the Gemini REST API.
// The API key never leaves the server.

const BASE = "https://generativelanguage.googleapis.com";

export function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set on the server.");
  return key;
}

export function modelName(): string {
  return process.env.GEMINI_MODEL || "gemini-3.8-flash";
}

/** Start a resumable upload session. Returns the one-time upload URL the browser can push bytes to. */
export async function startUpload(displayName: string, mimeType: string, sizeBytes: number, origin?: string | null) {
  const res = await fetch(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey(),
      // Google ties the upload session to this origin for CORS, so the browser can upload directly.
      ...(origin ? { Origin: origin } : {}),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(sizeBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!res.ok) throw new Error(`Could not start upload (${res.status}): ${await res.text()}`);
  const uploadUrl = res.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return an upload URL.");
  return uploadUrl;
}

/** Look up a file's processing state. `name` looks like "files/abc123". */
export async function getFile(name: string) {
  const res = await fetch(`${BASE}/v1beta/${name}`, {
    headers: { "x-goog-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not read file state (${res.status}): ${await res.text()}`);
  return (await res.json()) as { name: string; uri: string; state: string; mimeType: string; error?: unknown };
}

type Part = {
  text?: string;
  fileData?: { fileUri: string; mimeType: string };
  videoMetadata?: { startOffset?: string; endOffset?: string };
};

/** Builds the video part, optionally limited to a time window (seconds). */
export function videoPart(fileUri: string, mimeType: string, clipStart?: number, clipEnd?: number): Part {
  const part: Part = { fileData: { fileUri, mimeType } };
  if (typeof clipStart === "number" || typeof clipEnd === "number") {
    part.videoMetadata = {};
    if (typeof clipStart === "number" && clipStart > 0) part.videoMetadata.startOffset = `${Math.floor(clipStart)}s`;
    if (typeof clipEnd === "number" && clipEnd > 0) part.videoMetadata.endOffset = `${Math.ceil(clipEnd)}s`;
    if (!Object.keys(part.videoMetadata).length) delete part.videoMetadata;
  }
  return part;
}
export type Content = { role: "user" | "model"; parts: Part[] };

// Models to try, in order. The first is whatever GEMINI_MODEL is set to.
function modelCandidates(): string[] {
  const list = [modelName(), "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
  return list.filter((m, i) => list.indexOf(m) === i);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callModel(model: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Gemini error (${res.status}): ${await res.text()}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: Part) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

/**
 * Calls Gemini. On "busy" errors (503 / 429 / 500) it waits briefly and retries,
 * then falls back to the next model, so a demand spike on one model is invisible to the user.
 */
export async function generate(opts: {
  system: string;
  contents: Content[];
  json?: boolean;
  schema?: unknown;
}) {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    generationConfig: {
      temperature: 0.4,
      ...(opts.json ? { responseMimeType: "application/json", responseSchema: opts.schema } : {}),
    },
  };

  const started = Date.now();
  const budgetMs = 230_000; // stay under the 300s function limit
  let lastErr: Error | null = null;

  for (const model of modelCandidates()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() - started > budgetMs) break;
      try {
        return await callModel(model, body);
      } catch (e: unknown) {
        const err = e as Error & { status?: number };
        lastErr = err;
        const busy = err.status === 503 || err.status === 429 || err.status === 500;
        const unknownModel = err.status === 404;
        if (unknownModel) break; // model name not valid for this key — try the next one
        if (!busy) throw err; // real error (bad request, expired file, etc.)
        await sleep(attempt === 0 ? 4000 : 10000);
      }
    }
  }
  if (lastErr && /503|429|500/.test(lastErr.message)) {
    throw new Error("Google's models are all busy right now. Please try again in a minute.");
  }
  throw lastErr ?? new Error("No model answered.");
}

export const COACH_SYSTEM = `You are StrokeSense, an expert competitive swimming coach and biomechanics analyst.
You are watching a video of a swimmer. Be specific, honest and encouraging. Reference what you actually see
(timestamps, body position, arm path, kick, breathing, head position, rotation, timing) rather than generic advice.
If the video quality, angle, or length limits what you can judge, say so briefly and work with what is visible.
Never invent details you cannot see. Keep language clear for a swimmer or parent, not a scientist.
When the video is clipped to a window, timestamps you report are relative to the full video (the same numbers the swimmer sees on their player).
Do not manufacture problems: if the swimming is technically sound for the swimmer's level, say so, set noMajorIssues to true,
leave issues empty (or include only genuinely minor refinements marked "low"), and still offer useful drills for maintenance or speed.`;

export const ASK_SYSTEM = `You are StrokeSense, an expert competitive swimming coach. In this conversation there is NO video —
you cannot see the swimmer, so never pretend to. Give clear, specific, practical coaching: sets, drills, pacing, technique cues,
race strategy, dryland, and recovery guidance (for pain or injury, give sensible first steps and say when to see a professional).
When an answer really depends on the swimmer's own form, give the general cues first, then suggest they upload a short clip for a
review so you can say which applies to them. If something essential is unknown (level, distance, stroke), ask one short question.
Keep answers focused; use plain text with short paragraphs or simple dashes for lists, no markdown headers or asterisks.`;

export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    stroke: { type: "string", description: "Stroke being swum, e.g. Freestyle, Backstroke, Breaststroke, Butterfly, or Unclear" },
    summary: { type: "string", description: "2-3 sentence overall assessment" },
    noMajorIssues: { type: "boolean", description: "true when there is nothing significant to fix at this swimmer's level" },
    strengths: { type: "array", items: { type: "string" }, description: "2-4 things the swimmer does well" },
    issues: {
      type: "array",
      description: "Technique problems, most important first. 0-5 items. Empty if nothing significant is wrong.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          timestamp: { type: "string", description: "Where in the video it is visible, e.g. '0:04-0:07', or empty" },
          whatWeSee: { type: "string" },
          whyItMatters: { type: "string" },
          fix: { type: "string", description: "The key cue or correction" },
        },
        required: ["title", "severity", "timestamp", "whatWeSee", "whyItMatters", "fix"],
      },
    },
    drills: {
      type: "array",
      description: "3-5 drills that target the issues above",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          targets: { type: "string", description: "Which issue this drill addresses" },
          how: { type: "string", description: "How to do it, 2-4 sentences" },
          sets: { type: "string", description: "Suggested volume, e.g. '4 x 25m, 20s rest'" },
        },
        required: ["name", "targets", "how", "sets"],
      },
    },
    plan: {
      type: "array",
      description: "A short week-by-week plan, 2-4 entries",
      items: {
        type: "object",
        properties: {
          week: { type: "string" },
          focus: { type: "string" },
        },
        required: ["week", "focus"],
      },
    },
  },
  required: ["stroke", "summary", "noMajorIssues", "strengths", "issues", "drills", "plan"],
};
