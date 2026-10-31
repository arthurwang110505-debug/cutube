import { MAX_CLIP_MS, MAX_VIDEO_MS, MIN_CLIP_MS } from "./time";
import { isYouTubeId } from "./youtube";

export type Clip = {
  videoId: string;
  title: string;
  note: string;
  startMs: number;
  endMs: number;
  durationMs?: number;
};
export type SavedClip = Clip & { id: string; savedAt: string; channel?: string };

export function validateClip(clip: Clip): string | null {
  if (!isYouTubeId(clip.videoId)) return "A valid YouTube video is required.";
  if (!Number.isInteger(clip.startMs) || !Number.isInteger(clip.endMs) || clip.startMs < 0 || clip.endMs > MAX_VIDEO_MS) return "Enter a valid start and end time.";
  if (clip.endMs - clip.startMs < MIN_CLIP_MS) return "Your clip must be at least 0.1 seconds long.";
  if (clip.endMs - clip.startMs > MAX_CLIP_MS) return "Clips can be up to one hour long.";
  if (clip.durationMs && clip.endMs > clip.durationMs) return "The end point is past the end of the video.";
  return null;
}

export function clipParams(clip: Clip): URLSearchParams {
  const params = new URLSearchParams({ v: clip.videoId, start: String(clip.startMs), end: String(clip.endMs) });
  if (clip.title.trim()) params.set("title", clip.title.trim().slice(0, 140));
  if (clip.note.trim()) params.set("note", clip.note.trim().slice(0, 600));
  if (clip.durationMs && clip.durationMs >= clip.endMs && clip.durationMs <= MAX_VIDEO_MS) params.set("duration", String(clip.durationMs));
  return params;
}

export function clipUrl(clip: Clip, origin: string, path = "/clip"): string {
  const url = new URL(path, origin);
  url.search = clipParams(clip).toString();
  return url.toString();
}

export function clipFromParams(params: URLSearchParams): Clip | null {
  const videoId = params.get("v") ?? "";
  const start = params.get("start");
  const end = params.get("end");
  if (start === null || end === null || !/^\d+$/.test(start) || !/^\d+$/.test(end)) return null;
  const rawDuration = params.get("duration");
  const durationMs = rawDuration && /^\d+$/.test(rawDuration) ? Number(rawDuration) : undefined;
  const clip: Clip = {
    videoId, startMs: Number(start), endMs: Number(end),
    title: (params.get("title") || "Untitled clip").slice(0, 140),
    note: (params.get("note") || "").slice(0, 600),
    ...(durationMs && durationMs <= MAX_VIDEO_MS ? { durationMs } : {}),
  };
  return validateClip(clip) ? null : clip;
}
