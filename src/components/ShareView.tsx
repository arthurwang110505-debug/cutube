"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Code2, Copy, Repeat2, Pause, Play, Scissors } from "lucide-react";
import VideoPlayer, { type PlayerHandle } from "@/components/VideoPlayer";
import { clipParams, clipUrl, type Clip } from "@/lib/clip";
import { copyText } from "@/lib/clipboard";
import { downloadExport, EXPORTS } from "@/lib/exports";
import { formatClipLength, formatShort, formatTime } from "@/lib/time";
import { thumbnailUrl, watchUrl, type Video } from "@/lib/youtube";

function escapeAttribute(value: string) { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export default function ShareView({ clip }: { clip: Clip }) {
  const ref = useRef<PlayerHandle>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [time, setTime] = useState(clip.startMs);
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const video: Video = { videoId: clip.videoId, title: clip.title, channel: "", thumbnail: thumbnailUrl(clip.videoId), durationSeconds: (clip.durationMs ?? 0) / 1000, chapters: [], metadataSource: "fallback" };
  const copy = async (value: string, label: string) => {
    const ok = await copyText(value);
    setMessage(ok ? `${label} copied.` : `Select and copy the ${label.toLowerCase()} below.`);
    setManual(ok ? "" : value);
  };
  const embed = () => `<iframe src="${escapeAttribute(clipUrl(clip, window.location.origin, "/embed"))}" width="720" height="405" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="${escapeAttribute(clip.title)}"></iframe>`;

  return <div className="inner-page shared-page">
    <Link href="/" className="back-link"><ArrowLeft size={15} aria-hidden="true" /> Back to studio</Link>
    <div className="section-overline">Shared clip <span className="overline-rule" /> Original YouTube source</div>
    <div className="shared-head">
      <div><h1>{clip.title}</h1><p>{clip.note || "A moment selected from the original video."}</p></div>
      <Link href={`/?${clipParams(clip)}`} className="inner-primary"><Scissors size={16} aria-hidden="true" /> Open in studio <ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
    <div className="shared-grid">
      <div className="panel shared-player" aria-label="Shared video preview">
        <VideoPlayer ref={ref} video={video} startMs={clip.startMs} endMs={clip.endMs} loop={loop} onTime={setTime} onDuration={() => {}} onPlaying={setPlaying} onReady={setReady} />
        <div className="transport-bar">
          <button className="play-button" type="button" disabled={!ready} onClick={() => ref.current?.toggle()} aria-label={playing ? "Pause clip" : "Play clip"}>{playing ? <Pause size={16} fill="currentColor" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}</button>
          <div className="transport-time"><strong>{formatShort(Math.max(0, time - clip.startMs))}</strong><span> / {formatClipLength(clip.endMs - clip.startMs)}</span></div>
          <div className="transport-spacer" />
          <button className={`loop-button ${loop ? "on" : ""}`} type="button" onClick={() => setLoop(!loop)} aria-pressed={loop}><Repeat2 size={15} aria-hidden="true" /> Loop {loop ? "on" : "off"}</button>
        </div>
      </div>
      <aside className="panel share-info" aria-label="Clip details and sharing">
        <h2>Clip range</h2>
        <div className="share-time-row"><span>In point<strong>{formatTime(clip.startMs)}</strong></span><ArrowRight size={15} aria-hidden="true" /><span>Out point<strong>{formatTime(clip.endMs)}</strong></span></div>
        <p>This link opens the original YouTube video at the selected time. CutterTube does not re-upload or host the video.</p>
        <button type="button" className="primary-action" onClick={() => void copy(clipUrl(clip, window.location.origin), "Link")}><Copy size={16} aria-hidden="true" /> Copy clip link <ArrowRight className="action-arrow" size={16} aria-hidden="true" /></button>
        <button type="button" className="secondary-action" onClick={() => void copy(embed(), "Embed code")}><Code2 size={16} aria-hidden="true" /> Copy embed code</button>
        <a className="original-link" href={watchUrl(clip.videoId)} target="_blank" rel="noreferrer">View original on YouTube <ArrowUpRight size={15} aria-hidden="true" /></a>
        {manual && <label className="manual-link">Copy manually<textarea readOnly value={manual} onFocus={(event) => event.currentTarget.select()} rows={4} /></label>}
        <div className="share-export-title">Export clip details</div>
        <div className="export-list">{EXPORTS.map((item) => <button key={item.id} type="button" onClick={() => downloadExport(item.id, clip)}>{item.label}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div>
      </aside>
    </div>
    {message && <div className="toast" role="status"><Check size={15} aria-hidden="true" /> {message}</div>}
  </div>;
}
