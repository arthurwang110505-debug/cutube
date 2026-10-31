"use client";
import { useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import type { Clip } from "@/lib/clip";
import { thumbnailUrl, type Video } from "@/lib/youtube";
export default function EmbedView({ clip }: { clip: Clip }) {
  const [, setTime] = useState(clip.startMs);
  const video: Video = { videoId: clip.videoId, title: clip.title, channel: "", thumbnail: thumbnailUrl(clip.videoId), durationSeconds: 0, chapters: [], metadataSource: "fallback" };
  return <main id="main-content" className="embed-screen"><VideoPlayer video={video} startMs={clip.startMs} endMs={clip.endMs} loop={true} onTime={setTime} onDuration={() => {}} onPlaying={() => {}} onReady={() => {}} /></main>;
}
