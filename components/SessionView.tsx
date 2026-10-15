"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/lib/storage";

const DEEPER = [
  "Look closer at my catch and pull",
  "Watch my kick timing and depth",
  "Check my breathing and head position",
  "Any small things that would make me faster?",
];
const FOLLOWUPS = [
  "Which drill should I start with?",
  "What does that look like at the timestamp you mentioned?",
  "Give me a 20-minute practice set",
  "How long until I see improvement?",
];

export default function SessionView({ session, onChange }: { session: Session; onChange: (s: Session) => void }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const a = session.analysis;

  useEffect(() => {
    if (session.messages.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session.messages.length, sending]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || sending) return;
    setError(null);
    setDraft("");
    const withUser: Session = { ...session, messages: [...session.messages, { role: "user", text, at: Date.now() }] };
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
      onChange({ ...withUser, messages: [...withUser.messages, { role: "assistant", text: data.reply, at: Date.now() }] });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!a) return <div className="clean">This session has no analysis yet.</div>;

  const significant = a.issues.filter((i) => i.severity !== "low");
  const clean = a.noMajorIssues || a.issues.length === 0 || (significant.length === 0 && a.issues.length <= 1);

  return (
    <div className="session">
      <div className="section">
        <div className="overview">
          <div>
            <span className="eyebrow">Overview</span>
            <div className="stroke serif">{a.stroke}</div>
            <p>{a.summary}</p>
            {session.prompt && <div className="asked">Asked: “{session.prompt}”</div>}
            <div className={`verdict ${clean ? "good" : "work"}`}>
              {clean ? "Looks solid overall" : `${a.issues.length} thing${a.issues.length === 1 ? "" : "s"} to work on`}
            </div>
          </div>
          {session.thumb && <img src={session.thumb} alt="Frame from the video" />}
        </div>
      </div>

      {a.strengths?.length > 0 && (
        <div className="section">
          <div className="section-head"><h3>What's working</h3></div>
          <ul className="strengths">{a.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      <div className="section">
        <div className="section-head">
          <h3>{clean ? "Refinements" : "What to fix"}</h3>
          {a.issues.length > 0 && <span className="count">{a.issues.length} noted</span>}
        </div>

        {clean && (
          <div className="clean" style={{ marginBottom: a.issues.length ? 18 : 0 }}>
            <h4>Nothing major at this level.</h4>
            <p>
              At a general pass the stroke holds up — no high-priority faults stood out. If something specific feels off in the water
              (fatigue, speed, breathing, a particular turn or moment), tell the coach and it will look again, more closely, at just that.
            </p>
            <div className="chips" style={{ marginTop: 0 }}>
              {DEEPER.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {a.issues.map((it, i) => (
          <div key={i} className="issue">
            <div className="num">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <header>
                <b>{it.title}</b>
                <span className={`sev ${it.severity}`}>{it.severity}</span>
                {it.timestamp ? <span className="ts">{it.timestamp}</span> : null}
              </header>
              <div className="row"><span className="k">What we see</span><span>{it.whatWeSee}</span></div>
              <div className="row"><span className="k">Why it matters</span><span>{it.whyItMatters}</span></div>
              <div className="fix"><span className="k">Fix</span>{it.fix}</div>
            </div>
          </div>
        ))}
      </div>

      {a.drills?.length > 0 && (
        <div className="section">
          <div className="section-head"><h3>Drills</h3><span className="count">{a.drills.length}</span></div>
          <div className="drills">
            {a.drills.map((d, i) => (
              <div key={i} className="drill">
                <b>{d.name}</b>
                <div className="t">{d.targets}</div>
                <p>{d.how}</p>
                <div className="sets">{d.sets}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {a.plan?.length > 0 && (
        <div className="section">
          <div className="section-head"><h3>Plan</h3></div>
          <div className="plan">
            {a.plan.map((p, i) => (
              <div key={i}><b>{p.week}</b><span>{p.focus}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-head"><h3>Ask the coach</h3></div>
        <div className="chat">
          {session.messages.length === 0 && !clean && (
            <div className="chips" style={{ marginTop: 0, marginBottom: 6 }}>
              {FOLLOWUPS.map((q) => (
                <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>{q}</button>
              ))}
            </div>
          )}
          {session.messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>{m.text}</div>
          ))}
          {sending && <div className="msg assistant typing">Looking at the video again…</div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          <textarea
            value={draft}
            placeholder={clean ? "Tell the coach what to look deeper at…" : "Ask a follow-up…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={sending}
            rows={1}
          />
          <button onClick={() => send()} disabled={sending || !draft.trim()}>Send</button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="hint">Saved in this browser only. The video stays available for follow-ups for about 48 hours.</div>
      </div>
    </div>
  );
}
