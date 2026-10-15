"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, Analysis } from "@/lib/storage";
import { getVideo } from "@/lib/videoStore";

const DEEPER = [
  "Look closer at my catch and pull",
  "Watch my kick timing and depth",
  "Check my breathing and head position",
  "Any small things that would make me faster?",
];

const FOLLOWUPS: Record<string, string[]> = {
  default: ["Which drill should I start with?", "Show me where that happens in the video", "Give me a 20-minute practice set", "How long until I see improvement?"],
  Backstroke: ["Which drill should I start with?", "Is my hand entry pinky-first?", "Give me a 20-minute backstroke set", "How do I keep my hips up?"],
  Breaststroke: ["Which drill should I start with?", "Is my kick timing right?", "Give me a 20-minute breaststroke set", "How do I make my glide longer?"],
  Butterfly: ["Which drill should I start with?", "Is my second kick happening?", "Give me a 20-minute butterfly set", "How do I breathe lower?"],
};

const TS_RE = /\b(\d{1,2}):(\d{2})\b/g;

function toSeconds(m: string, s: string) {
  return parseInt(m, 10) * 60 + parseInt(s, 10);
}

/** Turns "0:04–0:07, 0:12" into text with clickable timestamps. */
function withTimestamps(text: string, seek?: (sec: number) => void): ReactNode {
  if (!seek || !text) return text;
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TS_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const sec = toSeconds(m[1], m[2]);
    out.push(
      <button key={`ts-${i++}-${idx}`} className="ts-link" type="button" onClick={() => seek(sec)} title="Jump to this moment">
        {m[0]}
      </button>
    );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function reportAsText(s: Session, a: Analysis) {
  const lines: string[] = [];
  lines.push(`STROKESENSE REVIEW — ${s.title}`);
  lines.push(`${new Date(s.createdAt).toLocaleDateString()} · ${a.stroke}`);
  if (s.prompt) lines.push(`Asked: ${s.prompt}`);
  lines.push("", "SUMMARY", a.summary);
  if (a.strengths?.length) lines.push("", "WHAT'S WORKING", ...a.strengths.map((x) => `- ${x}`));
  lines.push("", a.noMajorIssues ? "REFINEMENTS" : "WHAT TO FIX");
  if (!a.issues.length) lines.push("Nothing major at this level.");
  a.issues.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title} [${it.severity}${it.timestamp ? ", " + it.timestamp : ""}]`);
    lines.push(`   What we see: ${it.whatWeSee}`);
    lines.push(`   Why it matters: ${it.whyItMatters}`);
    lines.push(`   Fix: ${it.fix}`);
  });
  if (a.drills?.length) {
    lines.push("", "DRILLS");
    a.drills.forEach((d) => lines.push(`- ${d.name} (${d.targets}): ${d.how} — ${d.sets}`));
  }
  if (a.plan?.length) lines.push("", "PLAN", ...a.plan.map((p) => `${p.week}: ${p.focus}`));
  if (s.comparison) lines.push("", `PROGRESS vs "${s.comparison.withTitle}"`, s.comparison.text);
  if (s.messages.length) {
    lines.push("", "CONVERSATION");
    s.messages.forEach((m) => lines.push(`${m.role === "user" ? "You" : "Coach"}: ${m.text}`));
  }
  return lines.join("\n");
}

export default function SessionView({
  session,
  sessions,
  onChange,
}: {
  session: Session;
  sessions: Session[];
  onChange: (s: Session) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [compareWith, setCompareWith] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const a = session.analysis;

  // Load the locally stored video (if any) for playback and timestamp jumps.
  useEffect(() => {
    let url: string | null = null;
    if (session.hasLocalVideo) {
      getVideo(session.id).then((blob) => {
        if (blob) { url = URL.createObjectURL(blob); setVideoUrl(url); }
      });
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [session.id, session.hasLocalVideo]);

  useEffect(() => {
    if (session.messages.length > 0) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session.messages.length, sending]);

  const seek = videoUrl
    ? (sec: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, sec - 0.5);
        v.play().catch(() => {});
        v.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    : undefined;

  const others = useMemo(
    () => sessions.filter((s) => s.id !== session.id && s.analysis),
    [sessions, session.id]
  );

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || sending || session.example) return;
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
          clipStart: session.clipStart,
          clipEnd: session.clipEnd,
          messages: withUser.messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const raw = await res.text();
      let data: { reply?: string; error?: string } = {};
      try { data = JSON.parse(raw); } catch {
        throw new Error("The coach took too long to answer. Please try again in a minute.");
      }
      if (!res.ok || !data.reply) throw new Error(data.error || "The coach didn't answer.");
      onChange({ ...withUser, messages: [...withUser.messages, { role: "assistant", text: data.reply, at: Date.now() }] });
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function runCompare() {
    const other = others.find((s) => s.id === compareWith);
    if (!other || comparing) return;
    setComparing(true);
    setCompareError(null);
    try {
      const [older, newer] = other.createdAt < session.createdAt ? [other, session] : [session, other];
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          older: { title: older.title, createdAt: older.createdAt, prompt: older.prompt, analysis: older.analysis },
          newer: { title: newer.title, createdAt: newer.createdAt, prompt: newer.prompt, analysis: newer.analysis },
        }),
      });
      const raw = await res.text();
      let data: { reply?: string; error?: string } = {};
      try { data = JSON.parse(raw); } catch { throw new Error("The comparison took too long. Please try again."); }
      if (!res.ok || !data.reply) throw new Error(data.error || "Comparison failed.");
      onChange({ ...session, comparison: { withId: other.id, withTitle: other.title, text: data.reply, at: Date.now() } });
    } catch (e: unknown) {
      setCompareError((e as Error).message);
    } finally {
      setComparing(false);
    }
  }

  async function copyReport() {
    if (!a) return;
    try {
      await navigator.clipboard.writeText(reportAsText(session, a));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify({ ...session, thumb: undefined }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `${session.title.replace(/[^\w\- ]+/g, "").trim() || "review"}.json`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!a) return <div className="clean">This session has no analysis yet.</div>;

  const significant = a.issues.filter((i) => i.severity !== "low");
  const clean = a.noMajorIssues || a.issues.length === 0 || (significant.length === 0 && a.issues.length <= 1);
  const followups = FOLLOWUPS[a.stroke] || FOLLOWUPS.default;

  return (
    <div className="session">
      {session.example && (
        <div className="notice">
          This is a bundled sample review so you can see what a report looks like. Upload your own clip to get a real one — and to chat with the coach.
        </div>
      )}

      {videoUrl && (
        <div className="player">
          <video ref={videoRef} src={videoUrl} controls playsInline preload="metadata" />
          <div className="player-foot">
            <span className="mono">{session.fileName}</span>
            {typeof session.clipStart === "number" || typeof session.clipEnd === "number" ? (
              <span className="mono">reviewed {fmtSec(session.clipStart ?? 0)}–{session.clipEnd ? fmtSec(session.clipEnd) : "end"}</span>
            ) : null}
            <span className="hint" style={{ margin: 0 }}>Tap any timestamp in the report to jump there.</span>
          </div>
        </div>
      )}

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
          {!videoUrl && session.thumb && <img src={session.thumb} alt="Frame from the video" />}
        </div>
        <div className="toolbar">
          <button className="tool" onClick={copyReport}>{copied ? "Copied" : "Copy report"}</button>
          <button className="tool" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="tool" onClick={downloadJson}>Download JSON</button>
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
            {!session.example && (
              <div className="chips" style={{ marginTop: 0 }}>
                {DEEPER.map((q) => (
                  <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>{q}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {a.issues.map((it, i) => (
          <div key={i} className="issue">
            <div className="num">{String(i + 1).padStart(2, "0")}</div>
            <div>
              <header>
                <b>{it.title}</b>
                <span className={`sev ${it.severity}`}>{it.severity}</span>
                {it.timestamp ? <span className="ts">{withTimestamps(it.timestamp, seek)}</span> : null}
              </header>
              <div className="row"><span className="k">What we see</span><span>{withTimestamps(it.whatWeSee, seek)}</span></div>
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

      <div className="section no-print">
        <div className="section-head"><h3>Progress</h3><span className="count">compare with an earlier review</span></div>
        {others.length === 0 ? (
          <p className="hint" style={{ marginTop: 0 }}>Once you have two reviews of the same swimmer, pick the other one here and the coach will tell you what changed.</p>
        ) : (
          <div className="compare-row">
            <select value={compareWith} onChange={(e) => setCompareWith(e.target.value)} disabled={comparing}>
              <option value="">Choose a review to compare with…</option>
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </option>
              ))}
            </select>
            <button className="tool strong" onClick={runCompare} disabled={!compareWith || comparing}>
              {comparing ? "Comparing…" : "Compare"}
            </button>
          </div>
        )}
        {compareError && <div className="error">{compareError}</div>}
        {session.comparison && (
          <div className="comparison">
            <div className="eyebrow">vs “{session.comparison.withTitle}” · {new Date(session.comparison.at).toLocaleDateString()}</div>
            <div className="comparison-text">{session.comparison.text}</div>
          </div>
        )}
      </div>

      <div className="section no-print">
        <div className="section-head"><h3>Ask the coach</h3></div>
        {session.example ? (
          <p className="hint" style={{ marginTop: 0 }}>Chat is available on reviews of your own videos.</p>
        ) : (
          <>
            <div className="chat">
              {session.messages.length === 0 && !clean && (
                <div className="chips" style={{ marginTop: 0, marginBottom: 6 }}>
                  {followups.map((q) => (
                    <button key={q} className="chip" onClick={() => send(q)} disabled={sending}>{q}</button>
                  ))}
                </div>
              )}
              {session.messages.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>{m.role === "assistant" ? withTimestamps(m.text, seek) : m.text}</div>
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
          </>
        )}
      </div>
    </div>
  );
}

function fmtSec(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
