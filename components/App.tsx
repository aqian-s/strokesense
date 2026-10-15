"use client";

import { useEffect, useState } from "react";
import { loadSessions, saveSessions, type Session } from "@/lib/storage";
import NewSession from "./NewSession";
import SessionView from "./SessionView";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
    setLoaded(true);
  }, []);

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
    if (activeId === id) setActiveId(null);
  }

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="shell">
      <div className={`backdrop ${menuOpen ? "show" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="logo">S</div>
          <div>
            <strong>StrokeSense</strong>
            <small>AI swim technique coach</small>
          </div>
        </div>
        <button className="new-btn" onClick={() => { setActiveId(null); setMenuOpen(false); }}>
          + New analysis
        </button>
        <div className="session-list">
          <div className="label">Saved on this device</div>
          {loaded && sessions.length === 0 && (
            <div className="empty-side">No sessions yet. Upload a video to get started.</div>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              className={`session-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => { setActiveId(s.id); setMenuOpen(false); }}
            >
              {s.thumb ? <img className="thumb" src={s.thumb} alt="" /> : <div className="thumb empty">🏊</div>}
              <div className="meta">
                <b>{s.title}</b>
                <span>
                  {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" · "}
                  {s.analysis?.stroke || "Analyzing"}
                </span>
              </div>
              <span
                className="del"
                role="button"
                title="Delete"
                onClick={(e) => { e.stopPropagation(); remove(s.id); }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">☰</button>
          <h1>{active ? active.title : "New analysis"}</h1>
        </div>
        <div className="content">
          {active ? (
            <SessionView key={active.id} session={active} onChange={upsert} />
          ) : (
            <NewSession
              onCreated={(s) => { upsert(s); setActiveId(s.id); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
