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
  return <div className="inner-page shared-page"><Link href="/" className="back-link"><ArrowLeft size={15} /> Back to studio</Link><div className="section-overline"><span>✳</span> A MOMENT WORTH SHARING <span className="overline-rule" /> CUTTERTUBE CLIP</div><div className="shared-head"><div><h1>{clip.title}</h1><p>{clip.note || "A little moment, picked just for you."}</p></div><Link href={`/?${clipParams(clip)}`} className="inner-primary"><Scissors size={16} /> Open in studio <ArrowRight size={15} /></Link></div>
    <div className="shared-grid"><div className="panel shared-player"><div className="panel-topline"><div><span className="panel-top-icon"><Scissors size={15} /></span><strong>Shared clip</strong><span className="panel-separator">/</span><span>YOUTUBE</span></div><span className="panel-index">READY TO WATCH</span></div><VideoPlayer ref={ref} video={video} startMs={clip.startMs} endMs={clip.endMs} loop={loop} onTime={setTime} onDuration={() => {}} onPlaying={setPlaying} onReady={setReady} /><div className="transport-bar"><button className="play-button" type="button" disabled={!ready} onClick={() => ref.current?.toggle()} aria-label={playing ? "Pause clip" : "Play clip"}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><div className="transport-time"><strong>{formatShort(Math.max(0, time - clip.startMs))}</strong><span> / {formatClipLength(clip.endMs - clip.startMs)}</span></div><div className="transport-spacer" /><button className={`loop-button ${loop ? "on" : ""}`} type="button" onClick={() => setLoop(!loop)} aria-pressed={loop}><Repeat2 size={15} /> Loop {loop ? "on" : "off"}</button></div></div>
      <aside className="panel share-info"><span className="section-kicker">THE LITTLE DETAILS</span><h2>A moment in time<span>.</span></h2><div className="share-time-row"><span>IN POINT<strong>{formatTime(clip.startMs)}</strong></span><ArrowRight size={15} /><span>OUT POINT<strong>{formatTime(clip.endMs)}</strong></span></div><p>This clip points to the original YouTube video. No video is re-uploaded for sharing.</p><button type="button" className="primary-action" onClick={() => void copy(clipUrl(clip, window.location.origin), "Link")}><Copy size={16} /> Copy clip link <ArrowRight className="action-arrow" size={16} /></button><button type="button" className="secondary-action" onClick={() => void copy(embed(), "Embed code")}><Code2 size={16} /> Copy embed code</button><a className="original-link" href={watchUrl(clip.videoId)} target="_blank" rel="noreferrer">View original on YouTube <ArrowUpRight size={15} /></a>{manual && <label className="manual-link">Copy manually<textarea readOnly value={manual} onFocus={(event) => event.currentTarget.select()} rows={4} /></label>}<div className="share-export-title">EXPORT THE DETAILS</div><div className="export-list">{EXPORTS.map((item) => <button key={item.id} type="button" onClick={() => downloadExport(item.id, clip)}>{item.label}<ArrowUpRight size={14} /></button>)}</div></aside>
    </div>{message && <div className="toast" role="status"><Check size={15} /> {message}</div>}
  </div>;
}
