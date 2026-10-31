/** Time values in the editor are stored as integer milliseconds. */
export const MIN_CLIP_MS = 100;
export const MAX_CLIP_MS = 60 * 60 * 1000;
export const MAX_VIDEO_MS = 24 * 60 * 60 * 1000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function formatTime(ms: number, withMilliseconds = true): string {
  const safe = Math.max(0, Math.round(Number.isFinite(ms) ? ms : 0));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  const pad = (value: number, count = 2) => String(value).padStart(count, "0");
  const base = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return withMilliseconds ? `${base}.${pad(millis, 3)}` : base;
}

export function formatShort(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Show sub-second selections without rounding them to zero. */
export function formatClipLength(ms: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(ms) ? ms : 0));
  const fraction = safe % 1000;
  return `${formatShort(safe)}${fraction ? `.${String(fraction).padStart(3, "0").replace(/0+$/, "")}` : ""}`;
}

/** Accept seconds, MM:SS, or HH:MM:SS, optionally with milliseconds. */
export function parseTime(input: string): number | null {
  const value = input.trim();
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const parts = whole.split(":").map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return null;
  if (parts.length > 1 && parts[parts.length - 1] >= 60) return null;
  if (parts.length === 3 && parts[1] >= 60) return null;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  const result = seconds * 1000 + Number(fraction.padEnd(3, "0") || 0);
  return Number.isSafeInteger(result) && result <= MAX_VIDEO_MS ? result : null;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
