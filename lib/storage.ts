// Sessions live only in this browser's localStorage.

export type Issue = { title: string; severity: "high" | "medium" | "low"; timestamp: string; whatWeSee: string; whyItMatters: string; fix: string };
export type Drill = { name: string; targets: string; how: string; sets: string };
export type Analysis = {
  stroke: string;
  summary: string;
  noMajorIssues?: boolean;
  strengths: string[];
  issues: Issue[];
  drills: Drill[];
  plan: { week: string; focus: string }[];
};
export type Message = { role: "user" | "assistant"; text: string; at: number };
export type Comparison = { withId: string; withTitle: string; text: string; at: number };
export type Session = {
  id: string;
  kind?: "video" | "chat"; // undefined = video (older sessions)
  context?: string; // chat sessions: who the swimmer is (level, goals, pool)
  refReviewId?: string; // chat sessions: a saved video review the coach can refer to
  title: string;
  createdAt: number;
  fileName: string;
  fileUri: string;
  mimeType: string;
  prompt: string;
  strokeHint?: string;
  clipStart?: number; // seconds — analysis window inside the uploaded video
  clipEnd?: number;
  hasLocalVideo?: boolean; // the video blob is stored in this browser (IndexedDB)
  example?: boolean; // bundled sample review, not a real upload
  thumb?: string; // small JPEG data URL
  analysis: Analysis | null;
  messages: Message[];
  comparison?: Comparison;
};

const KEY = "strokesense.sessions.v1";

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Session[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveSessions(list: Session[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full (thumbnails) — drop thumbnails and retry.
    try {
      localStorage.setItem(KEY, JSON.stringify(list.map((s) => ({ ...s, thumb: undefined }))));
    } catch {}
  }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
