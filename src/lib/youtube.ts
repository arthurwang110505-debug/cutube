export type Chapter = { title: string; startSeconds: number };

export type Video = {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  durationSeconds: number;
  chapters: Chapter[];
  metadataSource: "watch_page" | "oembed" | "fallback";
};

export type ParsedYouTubeInput = { videoId: string; startSeconds: number };
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const ALLOWED_HOSTS = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "www.youtube.com", "youtu.be", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

export function isYouTubeId(value: string): boolean {
  return ID_PATTERN.test(value);
}

function parseStart(value: string | null): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Math.min(Number(value) || 0, 86_400);
  if (!/^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/i.test(value)) return 0;
  const parts = [...value.matchAll(/(\d+)([hms])/gi)];
  return Math.min(parts.reduce((sum, part) => {
    const factor = part[2].toLowerCase() === "h" ? 3600 : part[2].toLowerCase() === "m" ? 60 : 1;
    return sum + Number(part[1]) * factor;
  }, 0), 86_400);
}

/** YouTube watch, share, Shorts, live, embed links, or an 11-character ID. */
export function parseYouTubeInput(raw: string): ParsedYouTubeInput | null {
  const input = raw.trim();
  if (isYouTubeId(input)) return { videoId: input, startSeconds: 0 };
  if (!input || input.length > 2048) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== '80' && url.port !== '443')) return null;
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);
    let candidate: string | null = null;
    if (host === "youtu.be") candidate = segments[0] ?? null;
    else if (url.pathname === "/watch") candidate = url.searchParams.get("v");
    else if (segments.length >= 2 && ["shorts", "embed", "live", "v"].includes(segments[0])) candidate = segments[1];
    if (!candidate || !isYouTubeId(candidate)) return null;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    return { videoId: candidate, startSeconds: parseStart(url.searchParams.get("t") ?? url.searchParams.get("start") ?? hash.get("t")) };
  } catch {
    return null;
  }
}

export const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
export const thumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export function extractChapters(description: string, durationSeconds: number): Chapter[] {
  const chapters: Chapter[] = [];
  for (const line of description.split(/\r?\n/)) {
    const match = /^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*(?:[-–—:>|]+\s*)?(.{2,90}?)\s*$/.exec(line);
    if (!match) continue;
    const parts = match[1].split(":").map(Number);
    if (parts.slice(1).some((part) => part >= 60)) continue;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    const title = match[2].replace(/[*_`#]+/g, "").trim();
    if (!title || (durationSeconds > 0 && seconds >= durationSeconds) || chapters.some((c) => c.startSeconds === seconds)) continue;
    chapters.push({ title, startSeconds: seconds });
  }
  return chapters.length < 2 ? [] : chapters.sort((a, b) => a.startSeconds - b.startSeconds).slice(0, 60);
}

function extractJsonString(html: string, key: string): string | null {
  const anchor = `"${key}":"`;
  const start = html.indexOf(anchor);
  if (start < 0) return null;
  let escaped = "";
  for (let i = start + anchor.length; i < html.length; i += 1) {
    const char = html[i];
    if (char === "\\" && i + 1 < html.length) {
      escaped += char + html[++i];
    } else if (char === '"') {
      try { return JSON.parse(`"${escaped}"`) as string; } catch { return null; }
    } else escaped += char;
    if (escaped.length > 100_000) return null;
  }
  return null;
}

function decodeEntities(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; CutterTube/1.0)",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Metadata is best-effort. A blocked server must not stop a user editing by ID. */
export async function fetchVideoMeta(videoId: string): Promise<Video> {
  if (!isYouTubeId(videoId)) throw new Error("Invalid video ID.");
  const url = watchUrl(videoId);
  const [watch, oembed] = await Promise.allSettled([
    fetch(`${url}&hl=en`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(4000) }),
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(4000) }),
  ]);
  let html = "";
  let embedded: { title?: string; author_name?: string } | null = null;
  try { if (watch.status === "fulfilled" && watch.value.ok) html = await watch.value.text(); } catch { /* fallback below */ }
  try { if (oembed.status === "fulfilled" && oembed.value.ok) embedded = await oembed.value.json(); } catch { /* fallback below */ }
  const hasPlayerDetails = html.includes('"videoDetails"') || html.includes('property="og:title"');
  const title = decodeEntities((hasPlayerDetails ? (html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)?.[1] ?? extractJsonString(html, "title")) : null) || embedded?.title || `YouTube video ${videoId}`);
  const channel = decodeEntities((hasPlayerDetails ? extractJsonString(html, "author") : null) || embedded?.author_name || "");
  const rawDuration = hasPlayerDetails ? Number(extractJsonString(html, "lengthSeconds")) : 0;
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 86_400 ? rawDuration : 0;
  const description = hasPlayerDetails ? extractJsonString(html, "shortDescription") ?? "" : "";
  return {
    videoId, title: title.slice(0, 200), channel: channel.slice(0, 120),
    thumbnail: thumbnailUrl(videoId), durationSeconds,
    chapters: extractChapters(description, durationSeconds),
    metadataSource: hasPlayerDetails ? "watch_page" : embedded ? "oembed" : "fallback",
  };
}
