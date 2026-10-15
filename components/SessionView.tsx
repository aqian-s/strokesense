"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/storage";

export default function SessionView({ session, onChange }: { session: Session; onChange: (s: Session) => void }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const a = session.analysis;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session.messages.length, sending]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || sending) return;
    setError(null);
    setDraft("");
    const withUser: Session = {
      ...session,
      messages: [...session.messages, { role: "user", text, at: Date.now() }],
    };
    onChange(withUser);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUri: session.fileUri,
          mimeType: session.mimeType,
          prompt: session.prompt,
          analysis: session.analysis,
          messages: withUser.messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The coach didn't answer.");
      onChange({
        ...withUser,
        messages: [...withUser.messages, { role: "assistant", text: data.reply, at: Date.now() }],
      });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!a) return <div className="card">This session has no analysis yet.</div>;

  return (
    <div className="session">
      <div className="card">
        <div className="summary-head">
          {session.thumb && <img src={session.thumb} alt="Video frame" />}
          <div style={{ flex: 1, minWidth: 220 }}>
            <span className="stroke-pill">{a.stroke}</span>
            <p>{a.summary}</p>
            {session.prompt && <div className="ask">You asked: “{session.prompt}”</div>}
          </div>
        </div>
      </div>

      {a.strengths?.length > 0 && (
        <div className="card">
          <h3>What's working</h3>
          <ul className="plain">{a.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      <div className="card">
        <h3>What to fix</h3>
        {a.issues.map((it, i) => (
          <div key={i} className={`issue ${it.severity}`}>
            <header>
              <b>{it.title}</b>
              <span>
                <span className="sev">{it.severity} priority</span>
                {it.timestamp ? <small> · {it.timestamp}</small> : null}
              </span>
            </header>
            <dl>
              <div><dt>What we see</dt><dd>{it.whatWeSee}</dd></div>
              <div><dt>Why it matters</dt><dd>{it.whyItMatters}</dd></div>
            </dl>
            <div className="fix"><b>Fix:</b> {it.fix}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Drills</h3>
        <div className="grid2">
          {a.drills.map((d, i) => (
            <div key={i} className="drill">
              <b>{d.name}</b>
              <div className="t">Targets: {d.targets}</div>
              <div>{d.how}</div>
              <div className="sets">{d.sets}</div>
            </div>
          ))}
        </div>
      </div>

      {a.plan?.length > 0 && (
        <div className="card">
          <h3>Plan</h3>
          <div className="plan">
            {a.plan.map((p, i) => (
              <div key={i}><b>{p.week}</b><span>{p.focus}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Ask the coach</h3>
        <div className="chat">
          {session.messages.length === 0 && (
            <div className="chips" style={{ marginTop: 0, marginBottom: 6 }}>
              {["Which drill should I start with?", "What does that look like at the timestamp you mentioned?", "Give me a 20-minute practice set", "How long until I see improvement?"].map((q) => (
                <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>{q}</button>
              ))}
            </div>
          )}
          {session.messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.text}</div>
          ))}
          {sending && <div className="msg assistant typing">Coach is reviewing the video…</div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          <textarea
            value={draft}
            placeholder="Ask a follow-up…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            disabled={sending}
            rows={1}
          />
          <button onClick={() => send()} disabled={sending || !draft.trim()}>Send</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="hint">Saved in this browser only. Videos stay available for follow-ups for about 48 hours.</div>
      </div>
    </div>
  );
}
