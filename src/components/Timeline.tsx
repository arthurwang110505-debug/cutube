"use client";

import { useRef, useState } from "react";
import { clamp, formatShort, formatTime, MIN_CLIP_MS } from "@/lib/time";
import { thumbnailUrl } from "@/lib/youtube";

type Props = {
  videoId?: string;
  durationMs: number;
  startMs: number;
  endMs: number;
  playheadMs: number;
  onRange: (start: number, end: number) => void;
  onSeek: (ms: number) => void;
};

export default function Timeline({ videoId, durationMs, startMs, endMs, playheadMs, onRange, onSeek }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<"start" | "end" | "seek" | null>(null);
  const [dragging, setDragging] = useState(false);
  const usable = Boolean(videoId && durationMs >= MIN_CLIP_MS);
  const startPct = usable ? clamp(startMs / durationMs * 100, 0, 100) : 19;
  const endPct = usable ? clamp(endMs / durationMs * 100, 0, 100) : 67;
  const playPct = usable ? clamp(playheadMs / durationMs * 100, 0, 100) : 34;
  const fromX = (x: number) => {
    const bounds = track.current?.getBoundingClientRect();
    return bounds && usable ? Math.round(clamp((x - bounds.left) / bounds.width, 0, 1) * durationMs) : 0;
  };
  const apply = (kind: "start" | "end" | "seek", time: number) => {
    if (!usable) return;
    if (kind === "seek") onSeek(time);
    else if (kind === "start") onRange(clamp(time, 0, endMs - MIN_CLIP_MS), endMs);
    else onRange(startMs, clamp(time, startMs + MIN_CLIP_MS, durationMs));
  };
  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!usable) return;
    const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle;
    drag.current = handle === "start" || handle === "end" ? handle : "seek";
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    apply(drag.current, fromX(event.clientX));
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => { if (drag.current) apply(drag.current, fromX(event.clientX)); };
  const pointerEnd = () => { drag.current = null; setDragging(false); };
  const keyHandle = (event: React.KeyboardEvent, kind: "start" | "end") => {
    if (!usable) return;
    let next = kind === "start" ? startMs : endMs;
    const step = event.shiftKey ? 1000 : 100;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next -= step;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next += step;
    else if (event.key === "Home") next = kind === "start" ? 0 : startMs + MIN_CLIP_MS;
    else if (event.key === "End") next = kind === "start" ? endMs - MIN_CLIP_MS : durationMs;
    else return;
    event.preventDefault(); event.stopPropagation();
    apply(kind, next);
  };
  return <div className="timeline-block">
    <div className="timeline-heading"><div><span className="section-kicker">THE TIMELINE</span><span className="timeline-subtitle">{usable ? "Drag the handles to find your moment" : videoId ? "Waiting for video duration" : "Your selection will appear here"}</span></div><span className="timeline-duration">{usable ? formatShort(durationMs) : "— : —"}</span></div>
    <div ref={track} className={`timeline-track ${!usable ? "timeline-disabled" : ""} ${dragging ? "is-dragging" : ""}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} aria-label="Video timeline">
      <div className="filmstrip" style={{ backgroundImage: `linear-gradient(90deg, rgba(24,26,23,.24), rgba(24,26,23,.24)), url("${videoId ? thumbnailUrl(videoId) : "/studio-placeholder.jpg"}")` }} />
      <div className="film-grid" />
      <div className="timeline-dim" style={{ left: 0, width: `${startPct}%` }} />
      <div className="timeline-dim" style={{ left: `${endPct}%`, right: 0 }} />
      <div className="timeline-selection" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }} />
      <div className="timeline-playhead" style={{ left: `${playPct}%` }}><span /></div>
      {(["start", "end"] as const).map((kind) => <div key={kind} data-handle={kind} role="slider" aria-label={`${kind === "start" ? "Start" : "End"} point`} aria-valuemin={usable ? (kind === "start" ? 0 : startMs + MIN_CLIP_MS) : undefined} aria-valuemax={usable ? (kind === "start" ? endMs - MIN_CLIP_MS : durationMs) : undefined} aria-valuenow={usable ? (kind === "start" ? startMs : endMs) : undefined} aria-valuetext={usable ? formatTime(kind === "start" ? startMs : endMs) : undefined} aria-disabled={!usable} tabIndex={usable ? 0 : -1} onKeyDown={(event) => keyHandle(event, kind)} className="timeline-handle" style={{ left: `${kind === "start" ? startPct : endPct}%` }}><span>Ⅱ</span></div>)}
    </div>
    <div className="timeline-ruler">{Array.from({ length: 5 }, (_, i) => <span key={i}>{usable ? formatShort(durationMs * i / 4) : i === 0 ? "00:00" : "·"}</span>)}</div>
    {!usable && videoId && <p className="timeline-hint">If the player is unavailable, you can still type exact times on the right.</p>}
  </div>;
}
