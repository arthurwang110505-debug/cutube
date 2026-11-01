"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Copy, FolderHeart, Link2, Scissors, Trash2 } from "lucide-react";
import { clipParams, clipUrl, type SavedClip } from "@/lib/clip";
import { copyText } from "@/lib/clipboard";
import { LIBRARY_EVENT, readLibrary, removeFromLibrary } from "@/lib/library";
import { formatClipLength, formatTime } from "@/lib/time";
import { thumbnailUrl } from "@/lib/youtube";

export default function Library() {
  const [clips, setClips] = useState<SavedClip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const refresh = () => { setClips(readLibrary()); setLoaded(true); };
    refresh();
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(LIBRARY_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(""), 4000); return () => clearTimeout(timer); }, [message]);
  return <div className="inner-page library-page">
    <div className="section-overline">Your collection <span className="overline-rule" /> Stored in this browser</div>
    <div className="inner-page-head"><div><h1>Clips worth <em>keeping.</em></h1><p>Saved moments and their original YouTube sources.</p></div><Link href="/#source" className="inner-primary"><Scissors size={16} /> Make a new clip <ArrowRight size={15} /></Link></div>
    <div className="library-summary"><span><FolderHeart size={16} /> {clips.length} {clips.length === 1 ? "saved clip" : "saved clips"}</span><span>Saved on this device</span></div>
    {!loaded ? <div className="library-empty" role="status"><p>Loading your clips…</p></div> : clips.length === 0 ? <div className="library-empty"><div className="empty-icon"><FolderHeart size={26} aria-hidden="true" /></div><div className="section-overline">Ready when you are</div><h2>Nothing saved just yet.</h2><p>Save a selection from the studio and it will appear here in this browser. Shared links work independently of your library.</p><Link href="/#source" className="inner-primary">Start clipping <ArrowRight size={16} /></Link></div> : <div className="library-grid">{clips.map((clip) => {
      const params = clipParams(clip).toString();
      return <article className="library-card" key={clip.id}>
        <Link className="library-card-image" href={`/?${params}`} aria-label={`Edit ${clip.title}`} style={{ backgroundImage: `url("${thumbnailUrl(clip.videoId)}")` }}><span><Scissors size={14} aria-hidden="true" /> {formatClipLength(clip.endMs - clip.startMs)}</span><span className="card-open"><ArrowUpRight size={17} aria-hidden="true" /></span></Link>
        <div className="library-card-body"><div className="library-card-title"><h2>{clip.title}</h2><button type="button" aria-label={`Delete ${clip.title}`} title="Delete clip" onClick={() => { if (!window.confirm("Remove this clip from your browser library? Shared links will still work.")) return; try { removeFromLibrary(clip.id); setMessage("Clip removed from this browser."); } catch { setMessage("Couldn’t remove the clip. Check your browser storage."); } }}><Trash2 size={16} /></button></div><p>{clip.channel || "YouTube video"} · {new Date(clip.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p><div className="library-time"><span>IN <strong>{formatTime(clip.startMs)}</strong></span><ArrowRight size={13} /><span>OUT <strong>{formatTime(clip.endMs)}</strong></span></div><div className="library-actions"><Link href={`/?${params}`}>Open in studio <ArrowUpRight size={14} /></Link><button type="button" onClick={async () => { const ok = await copyText(clipUrl(clip, window.location.origin)); setMessage(ok ? "Clip link copied." : "Couldn’t copy automatically. Open the clip to copy its URL."); }} aria-label={`Copy link for ${clip.title}`}><Copy size={15} /></button><Link href={`/clip?${params}`} aria-label={`Open shared view for ${clip.title}`}><Link2 size={15} /></Link></div></div>
      </article>;
    })}</div>}
    <div className="library-disclaimer">Saved clips live in this browser, not an account. Clearing site data can remove them; shared links remain independent.</div>
    {message && <div className="toast" role="status">{message}</div>}
  </div>;
}
