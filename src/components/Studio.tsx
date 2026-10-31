"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Clapperboard,
  Clock3, Copy, Film, Link2, LoaderCircle, Repeat2, Pause, Play, RotateCcw,
  Scissors, ShieldCheck, Sparkles, Volume2, WandSparkles,
} from "lucide-react";
import Timeline from "@/components/Timeline";
import VideoPlayer, { type PlayerHandle } from "@/components/VideoPlayer";
import { clipFromParams, clipUrl, validateClip, type Clip } from "@/lib/clip";
import { copyText } from "@/lib/clipboard";
import { downloadExport, EXPORTS } from "@/lib/exports";
import { saveToLibrary } from "@/lib/library";
import { clamp, formatClipLength, formatFileSize, formatShort, formatTime, MAX_VIDEO_MS, MIN_CLIP_MS, parseTime } from "@/lib/time";
import { parseYouTubeInput, watchUrl, type Video } from "@/lib/youtube";
import type { PublicJob, RenderFormat } from "@/lib/render";

type RendererHealth = { ready: boolean; enabled: boolean; message: string };
type Range = { start: number; end: number };

function TimeField({ id, label, value, disabled, onCommit, onNudge, onStamp }: {
  id: string; label: string; value: number; disabled: boolean;
  onCommit: (value: number) => string | null; onNudge: (amount: number) => void; onStamp: () => void;
}) {
  const [draft, setDraft] = useState(formatTime(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Keep the editable draft in sync when the timeline or preset changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(formatTime(value)); setError(null);
  }, [value]);
  const commit = () => {
    if (disabled) return;
    const next = parseTime(draft);
    if (next === null) { setError("Use seconds or HH:MM:SS.mmm."); return; }
    const message = onCommit(next);
    setError(message);
    if (!message) setDraft(formatTime(next));
  };
  return <div className="time-field">
    <div className="field-label-line"><label htmlFor={id}>{label}</label><button type="button" disabled={disabled} onClick={onStamp} className="stamp-button" title={`Set ${label.toLowerCase()} to the playhead`}>Set to playhead <span>↗</span></button></div>
    <div className={`time-input-wrap ${error ? "has-error" : ""}`}>
      <input id={id} value={draft} disabled={disabled} onChange={(event) => { setDraft(event.target.value); setError(null); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      <div className="nudge-group"><button type="button" disabled={disabled} onClick={() => onNudge(-100)} aria-label={`Move ${label.toLowerCase()} back 0.1 seconds`}>−</button><button type="button" disabled={disabled} onClick={() => onNudge(100)} aria-label={`Move ${label.toLowerCase()} forward 0.1 seconds`}>+</button></div>
    </div>
    {error && <p id={`${id}-error`} className="field-error">{error}</p>}
  </div>;
}

export default function Studio() {
  const playerRef = useRef<PlayerHandle>(null);
  const editorSectionRef = useRef<HTMLElement>(null);
  const initialized = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [range, setRangeState] = useState<Range>({ start: 0, end: 30_000 });
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [loop, setLoop] = useState(true);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [toast, setToast] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [tab, setTab] = useState<"share" | "download">("share");
  const [showExports, setShowExports] = useState(false);
  const [health, setHealth] = useState<RendererHealth | null>(null);
  const [format, setFormat] = useState<RenderFormat>("mp4");
  const [height, setHeight] = useState(720);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const loadVideo = useCallback(async (raw: string, restored?: Clip) => {
    const parsed = parseYouTubeInput(raw);
    if (!parsed) { setLoadError("That doesn’t look like a YouTube link. Try a watch, Shorts, or share URL."); return; }
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true); setLoadError(null);
    try {
      const response = await fetch("/api/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: raw }), signal: controller.signal });
      const data = await response.json() as { video?: Video; startSeconds?: number; error?: string };
      if (!response.ok || !data.video) throw new Error(data.error ?? "Couldn’t load that video. Try again.");
      if (controller.signal.aborted) return;
      const nextVideo = data.video;
      const knownDuration = restored?.durationMs || nextVideo.durationSeconds * 1000;
      const upper = knownDuration > 0 ? knownDuration : MAX_VIDEO_MS;
      const start = clamp(restored?.startMs ?? (data.startSeconds ?? parsed.startSeconds) * 1000, 0, Math.max(0, upper - MIN_CLIP_MS));
      const end = clamp(restored?.endMs ?? start + 30_000, start + MIN_CLIP_MS, upper);
      setVideo(nextVideo); setSourceRevision((revision) => revision + 1); setDurationMs(knownDuration); setRangeState({ start, end }); setPlayhead(start);
      setPlaying(false); setPlayerReady(false); setTitle(restored?.title ?? (nextVideo.metadataSource === "fallback" ? "My clip" : `${nextVideo.title} — clip`.slice(0, 140)));
      setNote(restored?.note ?? ""); setShowNote(Boolean(restored?.note)); setUrlInput(watchUrl(nextVideo.videoId));
      setLastSaved(""); setManualLink(""); setLoadError(null);
      if (!restored) window.history.replaceState(null, "", "/");
      // On small screens the loaded editor may be below the fold. Bring the next
      // step into view so users can start trimming without hunting for it.
      window.requestAnimationFrame(() => editorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Couldn’t load that video. Please try again.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.search);
    const restored = clipFromParams(params);
    const videoId = params.get("v");
    queueMicrotask(() => {
      if (restored) void loadVideo(restored.videoId, restored);
      else if (videoId) void loadVideo(videoId);
    });
    fetch("/api/health").then((response) => response.json()).then((data: { renderer: RendererHealth }) => setHealth(data.renderer)).catch(() => setHealth({ ready: false, enabled: false, message: "Server render status is unavailable. You can still share or download a render script." }));
  }, [loadVideo]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeJobId = job && ["queued", "processing"].includes(job.status) ? job.id : null;
  useEffect(() => {
    if (!activeJobId) return;
    let canceled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${activeJobId}`, { cache: "no-store" });
        const data = await response.json() as { job?: PublicJob; error?: string };
        if (canceled) return;
        if (data.job) { setJob(data.job); setRenderError(null); }
        else if (response.status === 404) { setRenderError(data.error ?? "Render expired."); setJob(null); }
        else setRenderError("Couldn’t check render progress. Retrying…");
      } catch { if (!canceled) setRenderError("Couldn’t check render progress. Retrying…"); }
    };
    const timer = window.setInterval(poll, 1400);
    return () => { canceled = true; clearInterval(timer); };
  }, [activeJobId]);

  const setRange = useCallback((start: number, end: number) => {
    const max = durationMs > 0 ? durationMs : MAX_VIDEO_MS;
    const nextStart = clamp(Math.round(start), 0, Math.max(0, max - MIN_CLIP_MS));
    setRangeState({ start: nextStart, end: clamp(Math.round(end), nextStart + MIN_CLIP_MS, max) });
  }, [durationMs]);
  const seek = useCallback((ms: number) => {
    const target = clamp(Math.round(ms), 0, durationMs || MAX_VIDEO_MS);
    setPlayhead(target); playerRef.current?.seek(target);
  }, [durationMs]);
  const handleDuration = useCallback((next: number) => {
    if (!Number.isFinite(next) || next < MIN_CLIP_MS || next > MAX_VIDEO_MS) return;
    setDurationMs(next);
    setRangeState((old) => {
      const start = clamp(old.start, 0, Math.max(0, next - MIN_CLIP_MS));
      return { start, end: clamp(old.end, start + MIN_CLIP_MS, next) };
    });
  }, []);
  const handleTime = useCallback((next: number) => setPlayhead(next), []);
  const handlePlaying = useCallback((next: boolean) => setPlaying(next), []);
  const handleReady = useCallback((next: boolean) => setPlayerReady(next), []);

  useEffect(() => {
    if (!video) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.isContentEditable || target?.closest("input, textarea, select, button, a, [role=slider]")) return;
      if (event.key === " " && playerReady) { event.preventDefault(); playerRef.current?.toggle(); }
      else if (event.key === "[" || event.key.toLowerCase() === "i") { event.preventDefault(); setRange(Math.min(playhead, range.end - MIN_CLIP_MS), range.end); }
      else if (event.key === "]" || event.key.toLowerCase() === "o") { event.preventDefault(); setRange(range.start, Math.max(playhead, range.start + MIN_CLIP_MS)); }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); seek(playhead + (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 10_000 : 1000)); }
      else if (event.key.toLowerCase() === "l") { event.preventDefault(); setLoop((old) => !old); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [video, playerReady, playhead, range, seek, setRange]);

  const clip: Clip | null = video ? { videoId: video.videoId, title: title.trim() || "Untitled clip", note, startMs: range.start, endMs: range.end, ...(durationMs > 0 ? { durationMs } : {}) } : null;
  const clipError = clip ? validateClip(clip) : "Add a video to get started.";
  const clipKey = clip ? JSON.stringify(clip) : "";
  const alreadySaved = Boolean(clip && lastSaved === clipKey);
  const isBusy = Boolean(job && (job.status === "queued" || job.status === "processing"));
  const renderRangeError = clip && (clip.endMs - clip.startMs < 1000 || clip.endMs - clip.startMs > 10 * 60 * 1000)
    ? "Server renders must be between 1 second and 10 minutes." : null;

  const commitTime = (kind: "start" | "end", next: number): string | null => {
    if (durationMs && next > durationMs) return `Must be before ${formatTime(durationMs)}.`;
    if (kind === "start" && next > range.end - MIN_CLIP_MS) return "Start must be at least 0.1s before end.";
    if (kind === "end" && next < range.start + MIN_CLIP_MS) return "End must be at least 0.1s after start.";
    setRange(kind === "start" ? next : range.start, kind === "end" ? next : range.end);
    return null;
  };
  const nudge = (kind: "start" | "end", amount: number) => {
    if (kind === "start") setRange(clamp(range.start + amount, 0, range.end - MIN_CLIP_MS), range.end);
    else setRange(range.start, clamp(range.end + amount, range.start + MIN_CLIP_MS, durationMs || MAX_VIDEO_MS));
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void loadVideo(urlInput); };
  const copyLink = async () => {
    if (!clip || clipError) { setToast(clipError ?? "Add a video first."); return; }
    const link = clipUrl(clip, window.location.origin);
    if (await copyText(link)) { setManualLink(""); setToast("Clip link copied. Ready to share!"); }
    else { setManualLink(link); setToast("Select and copy the link below."); }
  };
  const saveClip = () => {
    if (!clip || clipError) { setToast(clipError ?? "Add a video first."); return; }
    try {
      saveToLibrary({ ...clip, id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`, savedAt: new Date().toISOString(), channel: video?.channel });
      setLastSaved(clipKey); setToast("Saved to My clips on this browser.");
    } catch { setToast("Couldn’t save in this browser. Check your storage settings."); }
  };
  const startRender = async () => {
    if (!clip || clipError || renderRangeError || rendering || isBusy) { if (clipError || renderRangeError) setRenderError(clipError || renderRangeError); return; }
    setRenderError(null); setRendering(true);
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: clip.videoId, startMs: clip.startMs, endMs: clip.endMs, format, height }) });
      const data = await response.json() as { job?: PublicJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Couldn’t start the render.");
      setJob(data.job);
    } catch (error) { setRenderError(error instanceof Error ? error.message : "Couldn’t start the render."); }
    finally { setRendering(false); }
  };
  const cancelRender = async () => {
    if (!job) return;
    try {
      const response = await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      const data = await response.json() as { job?: PublicJob; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Couldn’t cancel the render.");
      setJob(data.job);
    } catch (error) { setRenderError(error instanceof Error ? error.message : "Couldn’t cancel the render."); }
  };

  return <div className="workspace-page">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-eyebrow"><span className="eyebrow-symbol">✳</span> THE CREATOR STUDIO <span className="eyebrow-line" /> <span className="eyebrow-number">EST. FOR YOUR BEST BITS</span></div>
      <div className="hero-title-row"><div><h1 id="hero-title">Make the cut.<br /><span>Keep the moment.</span></h1><p>Turn the best bits of a YouTube video into something worth sharing.</p></div><div className="hero-stamp" aria-hidden="true"><span>MADE FOR</span><Scissors size={21} /><span>THE MOMENT</span></div></div>
      <form id="source" className="source-form" onSubmit={submit}>
        <span className="source-icon"><Link2 size={19} strokeWidth={1.7} /></span>
        <label className="sr-only" htmlFor="video-url">YouTube video link</label>
        <input id="video-url" value={urlInput} onChange={(event) => { setUrlInput(event.target.value); setLoadError(null); }} placeholder="Paste a YouTube link to get started" autoComplete="off" spellCheck={false} aria-describedby={loadError ? "source-error" : "source-help"} />
        <button type="submit" disabled={loading} className="source-button">{loading ? <><LoaderCircle size={16} className="spin" /> Loading</> : <>Let’s get clipping <ArrowRight size={17} /></>}</button>
      </form>
      <div className="source-help" id="source-help"><span><ShieldCheck size={14} /> YouTube links, Shorts &amp; video IDs</span><button type="button" onClick={() => void loadVideo("https://www.youtube.com/watch?v=aqz-KE-bpKQ")} disabled={loading}>Try an example <ArrowUpRight size={14} /></button></div>
      <p className="hero-trust"><ShieldCheck size={14} /> No sign-up. Your video stays on YouTube; CutterTube creates a shareable time-range link.</p>
      {loadError && <p className="source-error" id="source-error" role="alert">{loadError}</p>}
    </section>

    <section ref={editorSectionRef} className="editor-section" aria-labelledby="editor-heading">
      <div className="section-heading"><div><div className="section-overline"><span>✳</span> YOUR WORKSPACE <span className="overline-rule" /> 01 / 03</div><h2 id="editor-heading">The cutting room<span className="heading-period">.</span></h2></div><div className="workspace-status"><span className={video ? "green-dot" : "status-dot"} /> {video ? "VIDEO LOADED" : "AWAITING YOUR VIDEO"}</div></div>
      <div className="editor-grid">
        <div className="editor-main panel">
          <div className="panel-topline"><div><span className="panel-top-icon"><Clapperboard size={15} /></span><strong>Video preview</strong><span className="panel-separator">/</span><span>{video ? "YOUR SOURCE" : "YOUR CANVAS"}</span></div><span className="panel-index">01 — PREVIEW</span></div>
          <VideoPlayer key={`${video?.videoId ?? "empty"}-${sourceRevision}`} ref={playerRef} video={video} startMs={range.start} endMs={range.end} loop={loop} onTime={handleTime} onDuration={handleDuration} onPlaying={handlePlaying} onReady={handleReady} />
          <div className="transport-bar">
            <button type="button" className="play-button" disabled={!video || !playerReady} onClick={() => playerRef.current?.toggle()} aria-label={playing ? "Pause clip" : "Play clip"}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
            <button type="button" className="transport-icon" disabled={!video || !playerReady} onClick={() => seek(range.start)} aria-label="Go to start of selection" title="Go to start"><RotateCcw size={16} /></button>
            <div className="transport-time"><strong>{video ? formatShort(playhead) : "00:00"}</strong><span> / {durationMs ? formatShort(durationMs) : "--:--"}</span></div>
            <div className="transport-spacer" />
            <button type="button" className={`loop-button ${loop ? "on" : ""}`} disabled={!video} onClick={() => setLoop(!loop)} aria-pressed={loop} title="Loop the selected range"><Repeat2 size={15} /> <span>Loop {loop ? "on" : "off"}</span></button>
            <span className="transport-divider" /><Volume2 className="volume-icon" size={16} aria-hidden="true" /><span className="preview-label">PREVIEW</span>
          </div>
          {video && <div className="video-meta"><div><strong>{video.title}</strong><span>{video.channel || (video.metadataSource === "fallback" ? "Metadata unavailable — timecodes still work" : "YouTube video")}</span></div><a href={watchUrl(video.videoId)} target="_blank" rel="noreferrer" aria-label="Open source video on YouTube"><ArrowUpRight size={16} /></a></div>}
          <Timeline videoId={video?.videoId} durationMs={durationMs} startMs={range.start} endMs={range.end} playheadMs={playhead} onRange={setRange} onSeek={seek} />
        </div>
        <aside className="inspector panel" aria-label="Clip settings">
          <div className="inspector-heading"><div className="inspector-icon"><Scissors size={17} /></div><div><span className="section-kicker">YOUR CLIP</span><h3>Make the cut<span>.</span></h3></div><span className="panel-index">02 — EDIT</span></div>
          <p className="inspector-description">The perfect moment is in the details.</p>
          <div className="inspector-rule" />
          <TimeField id="start-time" label="Start time" value={range.start} disabled={!video} onCommit={(value) => commitTime("start", value)} onNudge={(value) => nudge("start", value)} onStamp={() => setRange(Math.min(playhead, range.end - MIN_CLIP_MS), range.end)} />
          <div className="time-connector"><span /><Scissors size={12} /><span /></div>
          <TimeField id="end-time" label="End time" value={range.end} disabled={!video} onCommit={(value) => commitTime("end", value)} onNudge={(value) => nudge("end", value)} onStamp={() => setRange(range.start, Math.max(playhead, range.start + MIN_CLIP_MS))} />
          <div className="preset-row"><span>QUICK LENGTH</span><div>{[15, 30, 60].map((seconds) => <button key={seconds} type="button" disabled={!video} onClick={() => setRange(range.start, Math.min(range.start + seconds * 1000, durationMs || MAX_VIDEO_MS))}>{seconds}s</button>)}</div></div>
          <div className="duration-card"><div><span>YOUR CLIP LENGTH</span><strong>{video ? formatClipLength(range.end - range.start) : "00:00"}</strong></div><span className="duration-spark">✳</span></div>
          <div className="clip-title-field"><label htmlFor="clip-title">Clip title <span>OPTIONAL</span></label><input id="clip-title" value={title} disabled={!video} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Give this moment a name" /></div>
          <button type="button" className="add-note" disabled={!video} onClick={() => setShowNote(!showNote)} aria-expanded={showNote}>{showNote ? "− Hide note" : "+ Add a note"}</button>
          {showNote && <div className="note-field"><label className="sr-only" htmlFor="clip-note">Clip note</label><textarea id="clip-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} rows={3} placeholder="Add a little context…" /></div>}
          <div className="inspector-rule" />
          <div className="share-tabs" role="tablist" aria-label="Clip output" onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? "share" : event.key === "End" ? "download" : tab === "share" ? "download" : "share";
            setTab(next);
            document.getElementById(`output-tab-${next}`)?.focus();
          }}>
            <button type="button" id="output-tab-share" role="tab" aria-controls="output-panel-share" tabIndex={tab === "share" ? 0 : -1} aria-selected={tab === "share"} onClick={() => setTab("share")}>Share clip</button>
            <button type="button" id="output-tab-download" role="tab" aria-controls="output-panel-download" tabIndex={tab === "download" ? 0 : -1} aria-selected={tab === "download"} onClick={() => setTab("download")}>Download file</button>
          </div>
          {tab === "share" ? <div id="output-panel-share" className="share-panel" role="tabpanel" aria-labelledby="output-tab-share">
            <button type="button" className="primary-action" disabled={!clip || Boolean(clipError) || alreadySaved} onClick={saveClip}>{alreadySaved ? <><Check size={17} /> Saved to My clips</> : <><Sparkles size={17} /> Save this clip <ArrowRight className="action-arrow" size={17} /></>}</button>
            <button type="button" className="secondary-action" disabled={!clip || Boolean(clipError)} onClick={() => void copyLink()}><Copy size={15} /> Copy clip link</button>
            {manualLink && <label className="manual-link">Copy this link<input readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} /></label>}
            <p className="fine-print"><ShieldCheck size={13} /> Saved on this browser. Anyone with the link can view your clip.</p>
            <button type="button" className="more-exports" onClick={() => setShowExports(!showExports)} aria-expanded={showExports}>More export options <ChevronDown size={15} className={showExports ? "rotated" : ""} /></button>
            {showExports && <div className="export-list">{EXPORTS.map((item) => <button key={item.id} type="button" disabled={!clip || Boolean(clipError)} onClick={() => { if (clip) downloadExport(item.id, clip); }}>{item.label}<ArrowDownToLine size={14} /></button>)}</div>}
          </div> : <div id="output-panel-download" className="download-panel" role="tabpanel" aria-labelledby="output-tab-download">
            <p className="download-explainer">Render a video or audio file on a configured server.</p>
            <div className="format-row" aria-label="Output format">{(["mp4", "webm", "mp3"] as const).map((option) => <button type="button" key={option} className={format === option ? "selected" : ""} onClick={() => setFormat(option)} aria-pressed={format === option}>{option.toUpperCase()}</button>)}</div>
            {format !== "mp3" && <label className="quality-field">QUALITY <select value={height} onChange={(event) => setHeight(Number(event.target.value))}>{[360, 480, 720, 1080].map((value) => <option key={value} value={value}>{value}p maximum</option>)}</select></label>}
            <button type="button" className="primary-action" disabled={!clip || Boolean(clipError) || Boolean(renderRangeError) || !health?.ready || rendering || isBusy} onClick={() => void startRender()}><ArrowDownToLine size={16} /> {rendering ? "Starting…" : `Render ${format.toUpperCase()}`}<ArrowRight className="action-arrow" size={17} /></button>
            {!health?.ready && <p className="render-notice"><CircleHelp size={14} /> {health?.message ?? "Checking server rendering…"}</p>}
            {health?.ready && <p className="fine-print"><Clock3 size={13} /> Keep this tab open. Renders support 1 second to 10 minutes; files expire after 24 hours.</p>}
            {renderRangeError && <p className="field-error">{renderRangeError}</p>}
            <button type="button" className="more-exports script-link" disabled={!clip || Boolean(clipError)} onClick={() => { if (clip) downloadExport("sh", clip); }}>Download local render script <ArrowDownToLine size={14} /></button>
            {job && <div className="job-card" aria-live="polite"><div><strong>{job.phase}</strong><span>{job.status === "completed" ? formatFileSize(job.fileSize) : isBusy ? `${job.progress}%` : ""}</span></div>{isBusy && <><div className="job-progress"><span style={{ width: `${job.progress}%` }} /></div><button type="button" onClick={() => void cancelRender()}>Cancel render</button></>}{job.status === "completed" && <a href={`/api/jobs/${job.id}/download`} download>Download {job.format.toUpperCase()} <ArrowDownToLine size={14} /></a>}{job.error && <p>{job.error}</p>}</div>}
            {renderError && <p className="source-error" role="alert">{renderError}</p>}
          </div>}
          {clip && clipError && <p className="field-error clip-validation">{clipError}</p>}
        </aside>
      </div>
      {video?.chapters.length ? <details className="chapters panel"><summary><span><Clock3 size={17} /> Creator chapters <small>{video.chapters.length} FOUND</small></span><ChevronDown size={16} /></summary><div className="chapter-list">{video.chapters.map((chapter, index) => { const from = chapter.startSeconds * 1000; const to = Math.min(video.chapters[index + 1]?.startSeconds * 1000 || durationMs || from + 30_000, from + 60 * 60 * 1000); return <button type="button" key={`${chapter.startSeconds}-${chapter.title}`} onClick={() => { setRange(from, Math.max(from + MIN_CLIP_MS, to)); seek(from); }}><span>{formatShort(from)}</span><strong>{chapter.title}</strong><span>USE CHAPTER ↗</span></button>; })}</div></details> : null}
    </section>

    <section className="how-section" aria-labelledby="how-title"><div className="how-head"><div><div className="section-overline"><span>✳</span> THE LITTLE HOW-TO <span className="overline-rule" /> 03 / 03</div><h2 id="how-title">Big moments, <em>little cuts.</em></h2></div><Link href="/guides">All the details <ArrowUpRight size={15} /></Link></div>
      <div className="steps-grid"><article><span className="step-number">01</span><div className="step-icon"><Link2 size={18} /></div><h3>Drop in a link</h3><p>Paste a YouTube URL and we’ll open up your workspace.</p></article><article><span className="step-number">02</span><div className="step-icon peach"><Scissors size={18} /></div><h3>Find your moment</h3><p>Fine-tune the in and out points, then preview your selection.</p></article><article><span className="step-number">03</span><div className="step-icon lilac"><WandSparkles size={18} /></div><h3>Send it out</h3><p>Save it here, share a link, or export the details of your cut.</p></article></div>
    </section>
    <section className="faq-section" aria-labelledby="faq-title"><div className="section-overline"><span>✳</span> GOOD TO KNOW</div><h2 id="faq-title">A few quick answers<span>.</span></h2><div className="faq-list">
      <details><summary>Does CutterTube upload or host videos?<span>＋</span></summary><p>No. The preview uses YouTube’s embedded player. A shared clip link points to the original YouTube video with your selected time range.</p></details>
      <details><summary>Do I need an account?<span>＋</span></summary><p>No account is needed. Saved clips live in this browser only and are not synced; sharing uses a link that anyone who has it can open.</p></details>
      <details><summary>Can I download an MP4 directly?<span>＋</span></summary><p>Direct server rendering is optional and may not be enabled on this deployment. You can still share a clip or export its timecodes and a local render script. Only use content you have permission to use.</p></details>
    </div></section>
    <footer className="workspace-footer"><span><Film size={14} /> MADE FOR THE MOMENTS THAT MATTER.</span><span>Only use content you own or have permission to use. <Link href="/guides">Learn more ↗</Link></span></footer>
    {toast && <div className="toast" role="status"><Check size={15} /> {toast}</div>}
  </div>;
}
