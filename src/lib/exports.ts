import type { Clip } from "./clip";
import { clipUrl, validateClip } from "./clip";
import { formatTime } from "./time";
import { watchUrl } from "./youtube";

export type ExportFormat = "json" | "md" | "txt" | "vtt" | "srt" | "sh";
export const EXPORTS: { id: ExportFormat; label: string; ext: string; mime: string }[] = [
  { id: "json", label: "Clip data", ext: "json", mime: "application/json" },
  { id: "md", label: "Markdown", ext: "md", mime: "text/markdown" },
  { id: "txt", label: "Timecode sheet", ext: "txt", mime: "text/plain" },
  { id: "vtt", label: "WebVTT marker", ext: "vtt", mime: "text/vtt" },
  { id: "srt", label: "SRT marker", ext: "srt", mime: "application/x-subrip" },
  { id: "sh", label: "Render script", ext: "sh", mime: "text/x-shellscript" },
];

export function renderExport(format: ExportFormat, clip: Clip, origin: string): string {
  const error = validateClip(clip);
  if (error) throw new Error(error);
  const duration = clip.endMs - clip.startMs;
  const source = watchUrl(clip.videoId);
  const share = clipUrl(clip, origin);
  const title = clip.title.replace(/[\r\n]+/g, " ").trim() || "Untitled clip";
  if (format === "json") return JSON.stringify({ title, note: clip.note, source, videoId: clip.videoId, startMs: clip.startMs, endMs: clip.endMs, durationMs: duration, shareUrl: share }, null, 2) + "\n";
  if (format === "md") return `# ${title}\n\n${clip.note ? `${clip.note}\n\n` : ""}- Source: ${source}\n- In: \`${formatTime(clip.startMs)}\`\n- Out: \`${formatTime(clip.endMs)}\`\n- Share: ${share}\n`;
  if (format === "txt") return `CLIP: ${title}\nSOURCE: ${source}\nIN: ${formatTime(clip.startMs)}\nOUT: ${formatTime(clip.endMs)}\nLENGTH: ${formatTime(duration)}\nSHARE: ${share}\n`;
  if (format === "vtt") return `WEBVTT\n\n00:00:00.000 --> ${formatTime(duration)}\n${title}\n`;
  if (format === "srt") return `1\n00:00:00,000 --> ${formatTime(duration).replace(".", ",")}\n${title}\n`;
  // The URL contains only a validated YouTube ID and all interpolated times are numbers.
  return `#!/bin/sh\n# Only download material you own or have permission to use.\nset -eu\ntmp="$(mktemp -d)"\ntrap 'rm -rf "$tmp"' EXIT\nyt-dlp --ignore-config --no-playlist --merge-output-format mp4 -o "$tmp/source.%(ext)s" '${source}'\nsource_file="$(find "$tmp" -type f ! -name '*.part' | head -n 1)"\n[ -n "$source_file" ] || { echo 'No source downloaded' >&2; exit 1; }\nffmpeg -ss ${(clip.startMs / 1000).toFixed(3)} -i "$source_file" -t ${(duration / 1000).toFixed(3)} -c:v libx264 -c:a aac -movflags +faststart cuttertube-clip.mp4\n`;
}

export function downloadExport(format: ExportFormat, clip: Clip): void {
  const item = EXPORTS.find((entry) => entry.id === format)!;
  const blob = new Blob([renderExport(format, clip, window.location.origin)], { type: `${item.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cuttertube-clip.${item.ext}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
