"use client";

import { useEffect, useState } from "react";
import { loadSessions, saveSessions, type Session } from "@/lib/storage";
import { deleteVideo } from "@/lib/videoStore";
import { EXAMPLE_SESSIONS, EXAMPLES_SEEDED_KEY } from "@/lib/examples";
import NewSession from "./NewSession";
import SessionView from "./SessionView";
import ChatSession from "./ChatSession";
import Landing from "./Landing";

const THEME_KEY = "strokesense.theme";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dark, setDark] = useState(false);
  const [mode, setMode] = useState<"landing" | "video" | "chat">("landing");
  const [prefill, setPrefill] = useState("");

  useEffect(() => {
    let list = loadSessions();
    try {
      // First visit: show the bundled sample reviews so the app isn't empty.
      if (!localStorage.getItem(EXAMPLES_SEEDED_KEY)) {
        list = [...list, ...EXAMPLE_SESSIONS].sort((a, b) => b.createdAt - a.createdAt);
        saveSessions(list);
        localStorage.setItem(EXAMPLES_SEEDED_KEY, "1");
      }
    } catch {}
    setSessions(list);
    setLoaded(true);
    try {
      setDark(localStorage.getItem(THEME_KEY) === "dark");
    } catch {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
    if (next) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }

  function persist(next: Session[]) {
    setSessions(next);
    saveSessions(next);
  }

  function upsert(s: Session) {
    const rest = sessions.filter((x) => x.id !== s.id);
    persist([s, ...rest].sort((a, b) => b.createdAt - a.createdAt));
  }

  function remove(id: string) {
    if (!confirm("Delete this session? This can't be undone.")) return;
    persist(sessions.filter((s) => s.id !== id));
    deleteVideo(id);
    if (activeId === id) setActiveId(null);
  }

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="shell">
      <div className={`backdrop ${menuOpen ? "show" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="mark" />
          <span className="word">StrokeSense</span>
        </div>
        <div className="tag">swim technique, reviewed</div>

        <button className="new-btn" onClick={() => { setActiveId(null); setMode("landing"); setMenuOpen(false); }}>
          New <span>+</span>
        </button>

        <div className="session-list">
          <span className="eyebrow">Saved on this device</span>
          {loaded && sessions.length === 0 && (
            <div className="empty-side">Nothing yet. Reviews you run will show up here.</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              className={`session-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => { setActiveId(s.id); setMenuOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setActiveId(s.id); setMenuOpen(false); } }}
            >
              {s.thumb ? <img className="thumb" src={s.thumb} alt="" /> : <div className="thumb">{s.kind === "chat" ? "💬" : "—"}</div>}
              <div className="meta">
                <b>{s.title}</b>
                <span>
                  {s.example ? "sample · " : ""}
                  {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}
                  {s.kind === "chat" ? "chat" : s.analysis?.stroke || "pending"}
                </span>
              </div>
              <button className="del" title="Delete" onClick={(e) => { e.stopPropagation(); remove(s.id); }}>×</button>
            </div>
          ))}
        </div>

        <div className="side-foot">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
            <span className="sw" />
            {dark ? "Dark" : "Light"}
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">≡</button>
          <div className="title">{active ? active.title : mode === "video" ? "New review" : mode === "chat" ? "Coach chat" : "Start"}</div>
        </div>
        <div className="content">
          {active && active.kind === "chat" ? (
            <ChatSession
              key="chat"
              session={active}
              sessions={sessions}
              onCreated={(s) => { upsert(s); setActiveId(s.id); }}
              onChange={upsert}
              onReviewVideo={(q) => { setPrefill(q); setActiveId(null); setMode("video"); }}
            />
          ) : active ? (
            <SessionView key={active.id} session={active} sessions={sessions} onChange={upsert} />
          ) : mode === "video" ? (
            <NewSession initialPrompt={prefill} onCreated={(s) => { upsert(s); setActiveId(s.id); setPrefill(""); }} />
          ) : mode === "chat" ? (
            <ChatSession
              key="chat"
              session={null}
              sessions={sessions}
              onCreated={(s) => { upsert(s); setActiveId(s.id); }}
              onChange={upsert}
              onReviewVideo={(q) => { setPrefill(q); setMode("video"); }}
            />
          ) : (
            <Landing onPick={setMode} />
          )}
        </div>
      </div>
    </div>
  );
}
