"use client";

import { useEffect, useRef, useState } from "react";
import { newId, type Session, type Analysis } from "@/lib/storage";

const SUGGESTIONS = [
  "Why does my freestyle feel slow?",
  "Check my breathing and head position",
  "Is my kick helping or hurting?",
  "Catch and pull — am I dropping my elbow?",
  "Body position: are my hips sinking?",
  "General technique review",
];

const STEPS = ["Uploading video", "Processing video", "Coach is analyzing", "Done"];

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
      v.onloadedmetadata = () => {
        v.currentTime = Math.min(1, (v.duration || 1) / 3);
      };
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
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.file);
        } catch {
          reject(new Error("Upload finished but the response was unreadable."));
        }
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (f.size > 300 * 1024 * 1024) {
      setError("That video is over 300 MB. Trim it to a shorter clip (15–45 seconds is ideal).");
      return;
    }
    setFile(f);
  }

  async function run() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setStep(0);
    setPct(0);
    try {
      const mimeType = file.type || "video/mp4";
      const thumbPromise = makeThumb(file);

      // 1. ask our server for a one-time upload URL
      const startRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType, size: file.size }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Could not start upload.");

      // 2. push the bytes straight to Google
      const uploaded = await uploadBytes(startData.uploadUrl, file, setPct);
      setStep(1);

      // 3. wait until Google has processed the video
      let uri = uploaded.uri;
      let state = uploaded.state;
      const deadline = Date.now() + 5 * 60 * 1000;
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

      // 4. analyze
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
      const title = prompt.trim()
        ? prompt.trim().slice(0, 48)
        : `${analysis.stroke || "Swim"} review`;

      onCreated({
        id: newId(),
        title,
        createdAt: Date.now(),
        fileName: file.name,
        fileUri: uri,
        mimeType,
        prompt,
        thumb,
        analysis,
        messages: [],
      });
    } catch (e: unknown) {
      setError((e as Error).message || "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="hero">
      <h2>Upload a swim, get a <span>coach's breakdown</span>.</h2>
      <p className="lead">
        Pick a short clip of someone swimming, tell the coach what you want help with, and get the biggest issues,
        why they matter, and drills to fix them — then keep asking questions.
      </p>

      {!file ? (
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*,.mp4,.mov,.webm,.m4v"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <div className="big">🎥</div>
          <b>Tap to choose a video, or drag one here</b>
          <span>MP4 or MOV · 15–45 seconds works best · filmed from the side or front</span>
        </div>
      ) : (
        <div className="preview">
          {previewUrl && <video src={previewUrl} controls playsInline />}
          <div className="file-row">
            <b>{file.name}</b>
            <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
            {!busy && <button onClick={() => setFile(null)}>Change</button>}
          </div>
        </div>
      )}

      <label className="field" htmlFor="prompt">What do you want the coach to look at?</label>
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
        {busy ? "Working…" : "Analyze my swim"}
      </button>

      {busy && (
        <div className="progress">
          <div className="steps">
            {STEPS.map((label, i) => (
              <div key={label} className={`step ${i < step ? "done" : i === step ? "active" : ""}`}>
                <span className="dot" />
                {label}
                {i === 0 && step === 0 && pct > 0 ? ` — ${pct}%` : ""}
              </div>
            ))}
          </div>
          {step === 0 && <div className="bar"><i style={{ width: `${pct}%` }} /></div>}
          <div className="hint">
            {step === 2 ? "The coach is watching the full clip frame by frame — this usually takes 20–60 seconds." : "Hang tight, this takes about a minute total."}
          </div>
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
