"use client";

import { useEffect, useRef, useState } from "react";
import { newId, type Session, type Analysis } from "@/lib/storage";
import { putVideo } from "@/lib/videoStore";

export const GENERAL_REVIEW = "General technique review";

const STROKES = ["Not sure", "Freestyle", "Backstroke", "Breaststroke", "Butterfly"];

const SUGGESTIONS: Record<string, string[]> = {
  "Not sure": [GENERAL_REVIEW, "What stroke am I swimming and how does it look?", "Why do I feel slow?", "Check my breathing and head position", "Is my kick helping or hurting?"],
  Freestyle: [GENERAL_REVIEW, "Why does my freestyle feel slow?", "Check my breathing and head position", "Is my kick helping or hurting?", "Catch and pull — am I dropping my elbow?", "Are my hips sinking?"],
  Backstroke: [GENERAL_REVIEW, "Are my hips sinking or snaking?", "Is my hand entering pinky-first?", "Check my head position and how still it stays", "Is my kick breaking the surface too much?"],
  Breaststroke: [GENERAL_REVIEW, "Is my kick timing right?", "Am I pulling too wide?", "Is my glide long enough?", "Check my head and breathing"],
  Butterfly: [GENERAL_REVIEW, "Is my second kick happening?", "Am I breathing too late or too high?", "Are my hips staying at the surface?", "Check my arm recovery and entry width"],
};

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STEPS = ["Uploading video", "Processing video", "Coach is watching", "Writing the review"];

async function makeThumb(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.src = URL.createObjectURL(file);
      const fail = () => resolve(undefined);
      v.onerror = fail;
      v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 1) / 3); };
      v.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          const scale = 320 / (v.videoWidth || 320);
          c.width = 320;
          c.height = Math.max(1, Math.round((v.videoHeight || 180) * scale));
          c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.6));
        } catch {
          fail();
        } finally {
          URL.revokeObjectURL(v.src);
        }
      };
      setTimeout(fail, 8000);
    } catch {
      resolve(undefined);
    }
  });
}

// The browser sends the video straight to Google's upload session (no size limit on our side).
function uploadBytes(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<{ name: string; uri: string; mimeType: string; state: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("X-Goog-Upload-Offset", "0");
    xhr.setRequestHeader("X-Goog-Upload-Command", "upload, finalize");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error("The browser could not reach Google's upload server. Check your connection and try again."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText).file); }
        catch { reject(new Error("Upload finished but the response was unreadable.")); }
      } else {
        reject(new Error(`Upload rejected (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
      }
    };
    xhr.send(file);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function NewSession({ onCreated }: { onCreated: (s: Session) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [clip, setClip] = useState<[number, number]>([0, 0]);
  const [stroke, setStroke] = useState("Not sure");
  const [prompt, setPrompt] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); setDuration(0); setClip([0, 0]); return; }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function pick(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(f.name)) {
      setError("Please choose a video file (MP4 or MOV work best).");
      return;
    }
    if (f.size > 2000 * 1024 * 1024) {
      setError("That video is over 2 GB. Please trim it down.");
      return;
    }
    setFile(f);
  }

  function onMeta() {
    const d = videoRef.current?.duration || 0;
    if (isFinite(d) && d > 0) { setDuration(d); setClip([0, d]); }
  }

  function setStart(v: number) {
    const start = Math.min(v, Math.max(0, clip[1] - 2));
    setClip([start, clip[1]]);
    if (videoRef.current) videoRef.current.currentTime = start;
  }
  function setEnd(v: number) {
    const end = Math.max(v, Math.min(duration, clip[0] + 2));
    setClip([clip[0], end]);
    if (videoRef.current) videoRef.current.currentTime = end;
  }

  const trimmed = duration > 0 && (clip[0] > 0.5 || clip[1] < duration - 0.5);

  async function run() {
    if (!file || busy) return;
    setBusy(true); setError(null); setStep(0); setPct(0);
    try {
      const mimeType = file.type || "video/mp4";
      const thumbPromise = makeThumb(file);
      const clipStart = trimmed ? Math.floor(clip[0]) : undefined;
      const clipEnd = trimmed ? Math.ceil(clip[1]) : undefined;

      const startRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType, size: file.size }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Could not start upload.");

      const uploaded = await uploadBytes(startData.uploadUrl, file, setPct);
      setStep(1);

      let uri = uploaded.uri;
      let state = uploaded.state;
      const deadline = Date.now() + 20 * 60 * 1000;
      while (state !== "ACTIVE") {
        if (state === "FAILED") throw new Error("Google could not process this video. Try re-exporting it as MP4.");
        if (Date.now() > deadline) throw new Error("Video processing timed out. Try a shorter clip.");
        await sleep(2500);
        const r = await fetch(`/api/status?name=${encodeURIComponent(uploaded.name)}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not check processing state.");
        state = d.state;
        uri = d.uri || uri;
      }
      setStep(2);

      const aRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUri: uri, mimeType, prompt, strokeHint: stroke, clipStart, clipEnd }),
      });
      const aText = await aRes.text();
      let aData: { analysis?: Analysis; error?: string } = {};
      try { aData = JSON.parse(aText); } catch {
        throw new Error("The coach took too long to answer. Google is slow right now — please try again in a minute.");
      }
      if (!aRes.ok || !aData.analysis) throw new Error(aData.error || "Analysis failed.");
      setStep(3);

      const analysis = aData.analysis;
      const id = newId();
      const [thumb, hasLocalVideo] = await Promise.all([thumbPromise, putVideo(id, file)]);
      const title = prompt.trim() && prompt.trim() !== GENERAL_REVIEW
        ? prompt.trim().slice(0, 48)
        : `${analysis.stroke || "Swim"} review`;

      onCreated({
        id, title, createdAt: Date.now(), fileName: file.name, fileUri: uri, mimeType, prompt,
        strokeHint: stroke, clipStart, clipEnd, hasLocalVideo, thumb, analysis, messages: [],
      });
    } catch (e: unknown) {
      setError((e as Error).message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="hero">
      <span className="eyebrow">New review</span>
      <h2>Show us the swim. <em>We'll find what to fix.</em></h2>
      <p className="lead">
        A short clip, a question, and you get the biggest technique issues, why they matter, the drills that address them, and a coach to talk it through with.
      </p>

      {!file ? (
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
        >
          <input type="file" accept="video/*,.mp4,.mov,.webm,.m4v" onChange={(e) => pick(e.target.files?.[0])} />
          <div className="glyph">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" /><path d="M6 10l6-6 6 6" /><path d="M4 20h16" />
            </svg>
          </div>
          <b>Choose a video, or drop one here</b>
          <span>MP4 or MOV · 15–45 seconds · filmed from the side or front works best</span>
        </div>
      ) : (
        <div className="preview">
          {previewUrl && <video ref={videoRef} src={previewUrl} controls playsInline onLoadedMetadata={onMeta} />}
          <div className="file-row">
            <b>{file.name}</b>
            <span className="mono">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            {!busy && <button onClick={() => setFile(null)}>Change</button>}
          </div>
          {duration > 0 && (
            <div className="trim">
              <div className="trim-head">
                <span className="eyebrow">Review only part of it</span>
                <span className="mono">{fmt(clip[0])} – {fmt(clip[1])}{trimmed ? "" : " (whole clip)"}</span>
              </div>
              <div className="trim-rows">
                <label>Start<input type="range" min={0} max={Math.floor(duration)} step={1} value={Math.floor(clip[0])} disabled={busy} onChange={(e) => setStart(Number(e.target.value))} /></label>
                <label>End<input type="range" min={0} max={Math.ceil(duration)} step={1} value={Math.ceil(clip[1])} disabled={busy} onChange={(e) => setEnd(Number(e.target.value))} /></label>
              </div>
              <div className="hint">Drag to narrow the window to the lap that matters. The whole file still uploads, but the coach watches only this part — faster and more convenient.</div>
            </div>
          )}
        </div>
      )}

      <label className="field">Which stroke?</label>
      <div className="chips" style={{ marginTop: 8 }}>
        {STROKES.map((st) => (
          <button key={st} type="button" className={`chip ${stroke === st ? "on" : ""}`} disabled={busy} onClick={() => setStroke(st)}>{st}</button>
        ))}
      </div>

      <label className="field" htmlFor="prompt">What should the coach look at?</label>
      <textarea
        id="prompt"
        className="prompt"
        placeholder="e.g. My freestyle feels slow and I get tired fast — what's wrong with my stroke?"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={busy}
      />
      <div className="chips">
        {(SUGGESTIONS[stroke] || SUGGESTIONS["Not sure"]).map((q) => (
          <button key={q} className="chip" type="button" disabled={busy} onClick={() => setPrompt(q)}>{q}</button>
        ))}
      </div>

      <button className="primary" disabled={!file || busy} onClick={run}>
        {busy ? "Reviewing…" : "Review this swim"}
      </button>

      {busy && (
        <div className="progress">
          {STEPS.map((label, i) => (
            <div key={label} className={`step ${i < step ? "done" : i === step ? "active" : ""}`}>
              <span className="n">{i < step ? "✓" : i + 1}</span>
              {label}{i === 0 && step === 0 && pct > 0 ? ` — ${pct}%` : ""}
            </div>
          ))}
          {step === 0 && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
          <div className="hint">
            {step === 2 ? "The coach watches the whole clip — usually 20 to 60 seconds. If Google is busy it quietly tries a second model." : "About a minute end to end."}
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
