"use client";

import { useEffect, useState } from "react";
import { newId, type Session, type Analysis } from "@/lib/storage";

export const GENERAL_REVIEW = "General technique review";

const SUGGESTIONS = [
  GENERAL_REVIEW,
  "Why does my freestyle feel slow?",
  "Check my breathing and head position",
  "Is my kick helping or hurting?",
  "Catch and pull — am I dropping my elbow?",
  "Are my hips sinking?",
];

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

function uploadBytes(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<{ name: string; uri: string; mimeType: string; state: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("X-Goog-Upload-Offset", "0");
    xhr.setRequestHeader("X-Goog-Upload-Command", "upload, finalize");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error("Upload failed (network). Try a smaller clip or a different browser."));
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
  const [prompt, setPrompt] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
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

  async function run() {
    if (!file || busy) return;
    setBusy(true); setError(null); setStep(0); setPct(0);
    try {
      const mimeType = file.type || "video/mp4";
      const thumbPromise = makeThumb(file);

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
        body: JSON.stringify({ fileUri: uri, mimeType, prompt }),
      });
      const aData = await aRes.json();
      if (!aRes.ok) throw new Error(aData.error || "Analysis failed.");
      setStep(3);

      const analysis = aData.analysis as Analysis;
      const thumb = await thumbPromise;
      const title = prompt.trim() && prompt.trim() !== GENERAL_REVIEW
        ? prompt.trim().slice(0, 48)
        : `${analysis.stroke || "Swim"} review`;

      onCreated({
        id: newId(), title, createdAt: Date.now(), fileName: file.name, fileUri: uri, mimeType, prompt, thumb, analysis, messages: [],
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
          {previewUrl && <video src={previewUrl} controls playsInline />}
          <div className="file-row">
            <b>{file.name}</b>
            <span className="mono">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            {!busy && <button onClick={() => setFile(null)}>Change</button>}
          </div>
        </div>
      )}

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
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" type="button" disabled={busy} onClick={() => setPrompt(s)}>{s}</button>
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
            {step === 2 ? "The coach watches the whole clip — usually 20 to 60 seconds." : "About a minute end to end."}
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
