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
  const dragOffset = useRef(0);
  const [dragging, setDragging] = useState(false);
  const usable = Boolean(videoId && durationMs >= MIN_CLIP_MS);
  const startPct = usable ? clamp(startMs / durationMs * 100, 0, 100) : 0;
  const endPct = usable ? clamp(endMs / durationMs * 100, 0, 100) : 0;
  const playPct = usable ? clamp(playheadMs / durationMs * 100, 0, 100) : 0;
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
    const pointerTime = fromX(event.clientX);
    if (drag.current !== "seek") {
      const bounds = track.current?.getBoundingClientRect();
      if (bounds) {
        const startX = bounds.left + startMs / durationMs * bounds.width;
        const endX = bounds.left + endMs / durationMs * bounds.width;
        if (Math.abs(event.clientX - startX) <= 22 && Math.abs(event.clientX - endX) <= 22) {
          drag.current = Math.abs(event.clientX - startX) <= Math.abs(event.clientX - endX) ? "start" : "end";
        }
      }
    }
    dragOffset.current = drag.current === "start" ? startMs - pointerTime : drag.current === "end" ? endMs - pointerTime : 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (drag.current === "seek") apply("seek", pointerTime);
  };
  const pointerMove = (event: React.PointerEvent<HTMLDivElement>) => { if (drag.current) apply(drag.current, fromX(event.clientX) + dragOffset.current); };
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
    <div className="timeline-heading">
      <div className="timeline-heading-main"><h3>Timeline</h3><p>Select the part you want to share.</p></div>
      <div className="timeline-range" aria-label={`In ${formatTime(startMs)}, out ${formatTime(endMs)}`}><span>In <strong>{formatTime(startMs)}</strong></span><span>Out <strong>{formatTime(endMs)}</strong></span></div>
    </div>
    <p id="timeline-instructions" className="timeline-instructions">Drag the edges or focus a handle and use the arrow keys. Shift changes by 1 second.</p>
    <div ref={track} className={`timeline-track ${!usable ? "timeline-disabled" : ""} ${dragging ? "is-dragging" : ""}`} role="group" aria-label="Video timeline" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd}>
      <div className="filmstrip" style={{ backgroundImage: videoId ? `url("${thumbnailUrl(videoId)}")` : undefined }} aria-hidden="true" />
      <div className="timeline-dim" style={{ left: 0, width: `${startPct}%` }} />
      <div className="timeline-dim" style={{ left: `${endPct}%`, right: 0 }} />
      <div className="timeline-selection" style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }} />
      {usable && <div className="timeline-playhead" style={{ left: `${playPct}%` }} aria-hidden="true"><span /></div>}
      {usable && (["start", "end"] as const).map((kind) => <div key={kind} data-handle={kind} role="slider" aria-label={`${kind === "start" ? "In" : "Out"} point`} aria-valuemin={kind === "start" ? 0 : startMs + MIN_CLIP_MS} aria-valuemax={kind === "start" ? endMs - MIN_CLIP_MS : durationMs} aria-valuenow={kind === "start" ? startMs : endMs} aria-valuetext={formatTime(kind === "start" ? startMs : endMs)} aria-describedby="timeline-instructions" tabIndex={0} onKeyDown={(event) => keyHandle(event, kind)} className="timeline-handle" style={{ left: `${kind === "start" ? startPct : endPct}%` }}><span aria-hidden="true">{kind === "start" ? "I" : "O"}</span></div>)}
    </div>
    {usable ? <div className="timeline-ruler">{Array.from({ length: 5 }, (_, i) => <span key={i}>{formatShort(durationMs * i / 4)}</span>)}</div> : <p className="timeline-hint">Video duration is unavailable. You can still enter exact timecodes above.</p>}
  </div>;
}
