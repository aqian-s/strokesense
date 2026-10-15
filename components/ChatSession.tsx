"use client";

import { useEffect, useRef, useState } from "react";
import { newId, type Session } from "@/lib/storage";

const STARTERS: { group: string; items: string[] }[] = [
  { group: "Training", items: ["Build me a 45-minute freestyle set", "How many times a week should a 14-year-old swim?", "Write a taper week before a meet"] },
  { group: "Technique", items: ["How do I stop my legs from sinking?", "What does a high-elbow catch actually feel like?", "How do I breathe without lifting my head?"] },
  { group: "Racing", items: ["How should I pace a 200 free?", "Tips for a faster flip turn", "What should I do the day before a race?"] },
  { group: "Body", items: ["My shoulder hurts on the catch — what should I change?", "Dryland exercises that help the kick", "What should I eat before practice?"] },
];

export default function ChatSession({
  session,
  sessions,
  onCreated,
  onChange,
  onReviewVideo,
}: {
  session: Session | null; // null = brand new chat, created on first message
  sessions: Session[];
  onCreated: (s: Session) => void;
  onChange: (s: Session) => void;
  onReviewVideo: (prefill: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState(session?.context ?? "");
  const [refId, setRefId] = useState(session?.refReviewId ?? "");
  const [showContext, setShowContext] = useState(!session?.context ? false : true);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = session?.messages ?? [];
  const reviews = sessions.filter((s) => (s.kind ?? "video") === "video" && s.analysis);
  const ref = reviews.find((r) => r.id === refId) ?? null;

  // When switching between chats, reload that chat's settings.
  useEffect(() => {
    setContext(session?.context ?? "");
    setRefId(session?.refReviewId ?? "");
    setShowContext(!!session?.context);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  useEffect(() => {
    if (messages.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, sending]);

  function saveMeta(next: Partial<Session>) {
    if (session) onChange({ ...session, ...next });
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || sending) return;
    setError(null);
    setDraft("");

    let current: Session;
    if (session) {
      current = { ...session, context, refReviewId: refId || undefined, messages: [...session.messages, { role: "user", text, at: Date.now() }] };
      onChange(current);
    } else {
      current = {
        id: newId(),
        kind: "chat",
        title: text.slice(0, 48),
        createdAt: Date.now(),
        fileName: "",
        fileUri: "",
        mimeType: "",
        prompt: text,
        context,
        refReviewId: refId || undefined,
        analysis: null,
        messages: [{ role: "user", text, at: Date.now() }],
      };
      onCreated(current);
    }

    setSending(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: current.messages.map((m) => ({ role: m.role, text: m.text })),
          context,
          review: ref ? { title: ref.title, createdAt: ref.createdAt, prompt: ref.prompt, analysis: ref.analysis } : null,
        }),
      });
      const raw = await res.text();
      let data: { reply?: string; error?: string } = {};
      try { data = JSON.parse(raw); } catch { throw new Error("The coach took too long to answer. Please try again in a minute."); }
      if (!res.ok || !data.reply) throw new Error(data.error || "The coach didn't answer.");
      onChange({ ...current, messages: [...current.messages, { role: "assistant", text: data.reply, at: Date.now() }] });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

  return (
    <div className="session chat-page">
      <div className="chat-head">
        <div>
          <span className="eyebrow">Coach chat</span>
          <div className="stroke serif" style={{ fontSize: 26 }}>{session ? session.title : "Ask anything"}</div>
        </div>
        <div className="chat-tools">
          <button className="tool" onClick={() => setShowContext((v) => !v)}>
            {context ? "About the swimmer ✓" : "About the swimmer"}
          </button>
          {reviews.length > 0 && (
            <select
              className="tool"
              value={refId}
              onChange={(e) => { setRefId(e.target.value); saveMeta({ refReviewId: e.target.value || undefined }); }}
            >
              <option value="">Reference a review…</option>
              {reviews.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          )}
        </div>
      </div>

      {showContext && (
        <div className="context-box">
          <label className="eyebrow" htmlFor="ctx">Who is the coach talking to?</label>
          <textarea
            id="ctx"
            value={context}
            placeholder="e.g. 15-year-old club swimmer, 25 m pool, 4 practices a week, goal is a faster 100 free by December"
            onChange={(e) => setContext(e.target.value)}
            onBlur={() => saveMeta({ context })}
            rows={2}
          />
          <div className="hint">Sent quietly with every message so you don't have to repeat yourself.</div>
        </div>
      )}

      {ref && <div className="notice small">Referring to “{ref.title}” — the coach can see that report.</div>}

      <div className="chat">
        {messages.length === 0 && (
          <div className="starters">
            {STARTERS.map((g) => (
              <div key={g.group} className="starter-group">
                <span className="eyebrow">{g.group}</span>
                <div className="chips" style={{ marginTop: 6 }}>
                  {g.items.map((q) => (
                    <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>{q}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        {sending && <div className="msg assistant typing">Thinking…</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <textarea
          value={draft}
          placeholder="Ask the coach…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={sending}
          rows={1}
          autoFocus={!session}
        />
        <button onClick={() => send()} disabled={sending || !draft.trim()}>Send</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="bridge">
        <span>Question about your own stroke?</span>
        <button className="tool" onClick={() => onReviewVideo(lastQuestion)}>Review a video instead →</button>
      </div>
    </div>
  );
}
