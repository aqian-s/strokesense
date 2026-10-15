"use client";

export default function Landing({ onPick }: { onPick: (mode: "video" | "chat") => void }) {
  return (
    <div className="hero">
      <span className="eyebrow">Start</span>
      <h2>What do you need <em>today?</em></h2>
      <p className="lead">Film a swim for a full technique breakdown, or skip the camera and just talk to the coach.</p>

      <div className="cards">
        <button className="card-pick" onClick={() => onPick("video")}>
          <span className="card-glyph">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" />
            </svg>
          </span>
          <span className="card-title">Review a video</span>
          <span className="card-desc">Upload a short clip. Get the biggest issues, why they matter, drills, and a plan — with timestamps you can jump to.</span>
          <span className="card-cta">Upload a clip →</span>
        </button>

        <button className="card-pick" onClick={() => onPick("chat")}>
          <span className="card-glyph">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
          </span>
          <span className="card-title">Just ask the coach</span>
          <span className="card-desc">Sets, drills, pacing, race strategy, or a nagging question about technique. No video needed.</span>
          <span className="card-cta">Start a conversation →</span>
        </button>
      </div>
    </div>
  );
}
