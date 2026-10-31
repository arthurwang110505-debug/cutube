"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink, Film, LoaderCircle } from "lucide-react";
import { watchUrl, type Video } from "@/lib/youtube";

type YTPlayer = {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number; destroy(): void;
};
type YTNamespace = { Player: new (element: HTMLElement, options: {
  videoId: string; playerVars: Record<string, string | number>;
  events: { onReady: (event: { target: YTPlayer }) => void; onStateChange: (event: { data: number }) => void; onError: () => void };
}) => YTPlayer };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error || !window.YT?.Player) { apiPromise = null; reject(error ?? new Error("Player unavailable")); }
      else resolve(window.YT);
    };
    const timer = window.setTimeout(() => finish(new Error("Player timed out")), 10_000);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); finish(); };
    const existing = document.getElementById("cuttertube-youtube-api");
    if (!existing) {
      const script = document.createElement("script");
      script.id = "cuttertube-youtube-api";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => { script.remove(); finish(new Error("Player unavailable")); };
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export type PlayerHandle = { seek(ms: number): void; toggle(): void };
type Props = {
  video: Video | null;
  startMs: number;
  endMs: number;
  loop: boolean;
  onTime: (ms: number) => void;
  onDuration: (ms: number) => void;
  onPlaying: (playing: boolean) => void;
  onReady: (ready: boolean) => void;
};

const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer({ video, startMs, endMs, loop, onTime, onDuration, onPlaying, onReady }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const latest = useRef({ startMs, endMs, loop, onTime, onDuration, onPlaying, onReady });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => { latest.current = { startMs, endMs, loop, onTime, onDuration, onPlaying, onReady }; }, [startMs, endMs, loop, onTime, onDuration, onPlaying, onReady]);

  useImperativeHandle(ref, () => ({
    seek(ms) { try { player.current?.seekTo(Math.max(0, ms) / 1000, true); } catch { /* player not ready */ } },
    toggle() {
      const current = player.current;
      if (!current) return;
      try {
        if (current.getPlayerState() === 1) current.pauseVideo();
        else {
          const time = current.getCurrentTime() * 1000;
          if (time < latest.current.startMs - 150 || time >= latest.current.endMs) current.seekTo(latest.current.startMs / 1000, true);
          current.playVideo();
        }
      } catch { /* player may have been removed */ }
    },
  }), []);

  const videoId = video?.videoId;
  useEffect(() => {
    if (!videoId || !host.current) return;
    const container = host.current;
    let cancelled = false;
    let interval: number | undefined;
    let readyTimer: number | undefined;
    container.replaceChildren();
    const mount = document.createElement("div");
    container.appendChild(mount);
    setStatus("loading");
    latest.current.onReady(false);
    loadYouTube().then((YT) => {
      if (cancelled) return;
      readyTimer = window.setTimeout(() => { if (!cancelled) setStatus("error"); }, 12_000);
      const instance = new YT.Player(mount, {
        videoId,
        playerVars: { autoplay: 0, controls: 1, rel: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            window.clearTimeout(readyTimer);
            player.current = target;
            setStatus("ready");
            latest.current.onReady(true);
            try {
              const duration = target.getDuration();
              if (duration > 0) latest.current.onDuration(Math.round(duration * 1000));
              target.seekTo(latest.current.startMs / 1000, true);
              latest.current.onTime(latest.current.startMs);
            } catch { /* allow player to initialize */ }
            interval = window.setInterval(() => {
              try {
                const current = player.current;
                if (!current) return;
                const at = current.getCurrentTime() * 1000;
                if (!Number.isFinite(at)) return;
                const currentState = current.getPlayerState();
                if (currentState === 1 && at >= latest.current.endMs - 80) {
                  if (latest.current.loop) {
                    current.seekTo(latest.current.startMs / 1000, true);
                    latest.current.onTime(latest.current.startMs);
                  } else {
                    current.pauseVideo();
                    latest.current.onTime(latest.current.endMs);
                  }
                } else latest.current.onTime(Math.round(at));
              } catch { /* player not yet responsive */ }
            }, 150);
          },
          onStateChange: ({ data }) => { if (!cancelled) latest.current.onPlaying(data === 1); },
          onError: () => { if (!cancelled) { window.clearTimeout(readyTimer); setStatus("error"); latest.current.onReady(false); } },
        },
      });
      player.current = instance;
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (readyTimer) clearTimeout(readyTimer);
      latest.current.onReady(false);
      latest.current.onPlaying(false);
      try { player.current?.destroy(); } catch { /* already gone */ }
      player.current = null;
      container.replaceChildren();
    };
  }, [videoId]);

  if (!video) return <div className="preview-placeholder" aria-label="Your video preview will appear here">
    <div className="preview-wash" />
    <div className="preview-top-label"><span className="preview-label-dot" /> THE PREVIEW</div>
    <div className="placeholder-message"><span className="placeholder-icon"><Film size={22} strokeWidth={1.5} /></span><strong>Your story starts here.</strong><span>Paste a link above to bring your video in.</span></div>
    <div className="preview-bottom-label"><span>THE LITTLE MOMENTS</span><span>✳ &nbsp; MADE TO SHARE</span></div>
  </div>;

  return <div className="youtube-stage">
    <div ref={host} className="youtube-host" />
    {status !== "ready" && <div className="youtube-overlay">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={video.thumbnail} alt="" className="youtube-poster" />
      <div className="youtube-overlay-content">
        {status === "loading" ? <><LoaderCircle className="spin" size={23} /><strong>Connecting to YouTube</strong><span>Getting your preview ready…</span></> : <><strong>Preview couldn’t load here</strong><span>You can still set the timecodes and share the clip. Some videos don’t allow embedding.</span><a href={watchUrl(video.videoId)} target="_blank" rel="noreferrer">Open on YouTube <ExternalLink size={13} /></a></>}
      </div>
    </div>}
  </div>;
});
export default VideoPlayer;
