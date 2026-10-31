import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isYouTubeId, watchUrl } from "./youtube";

export type RenderFormat = "mp4" | "webm" | "mp3";
export type RenderStatus = "queued" | "processing" | "completed" | "failed" | "canceled";
export type PublicJob = {
  id: string;
  status: RenderStatus;
  phase: string;
  progress: number;
  format: RenderFormat;
  fileSize: number | null;
  error: string | null;
  createdAt: string;
};

type Job = PublicJob & {
  videoId: string;
  startMs: number;
  endMs: number;
  height: number;
  child: ChildProcess | null;
  filePath: string | null;
  finishedAt: number | null;
};

type Store = { jobs: Map<string, Job>; timer?: NodeJS.Timeout };
const globalStore = globalThis as typeof globalThis & { __cuttertubeRenderStore?: Store };
const store: Store = globalStore.__cuttertubeRenderStore ??= { jobs: new Map<string, Job>() };
const ROOT = process.env.CLIP_DATA_DIR ?? path.join(os.tmpdir(), "cuttertube-renders");
const RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_JOBS = 2;

function executableWorks(command: string, args: string[]): boolean {
  try { return spawnSync(command, args, { timeout: 2500, stdio: "ignore" }).status === 0; } catch { return false; }
}

function downloaderCommand(): { command: string; prefix: string[] } | null {
  if (process.env.YT_DLP_PATH) return executableWorks(process.env.YT_DLP_PATH, ["--version"]) ? { command: process.env.YT_DLP_PATH, prefix: [] } : null;
  if (executableWorks("yt-dlp", ["--version"])) return { command: "yt-dlp", prefix: [] };
  if (executableWorks("python3", ["-m", "yt_dlp", "--version"])) return { command: "python3", prefix: ["-m", "yt_dlp"] };
  return null;
}

export function rendererStatus() {
  const enabled = process.env.ENABLE_SERVER_RENDER === "true";
  if (!enabled) return { ready: false, enabled: false, ffmpeg: false, ytDlp: false, message: "Server rendering is not enabled. You can still share or download a render script." };
  const ffmpeg = executableWorks(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]);
  const ytDlp = Boolean(downloaderCommand());
  return {
    ready: ffmpeg && ytDlp, enabled, ffmpeg, ytDlp,
    message: ffmpeg && ytDlp ? "Video rendering is ready." : "Server rendering needs FFmpeg and yt-dlp. You can still share or download a render script.",
  };
}

function publicJob(job: Job): PublicJob {
  const { id, status, phase, progress, format, fileSize, error, createdAt } = job;
  return { id, status, phase, progress, format, fileSize, error, createdAt };
}

export async function pruneJobs() {
  const now = Date.now();
  for (const [id, job] of store.jobs) {
    if (job.finishedAt && now - job.finishedAt > RETENTION_MS) {
      if (job.filePath) await fs.rm(job.filePath, { force: true }).catch(() => undefined);
      store.jobs.delete(id);
    }
  }
  // Also reclaim files left behind by a previous process after the retention window.
  for (const dir of [path.join(ROOT, "tmp"), path.join(ROOT, "clips")]) {
    try {
      for (const name of await fs.readdir(dir)) {
        const entry = path.join(dir, name);
        const stat = await fs.stat(entry);
        if (now - stat.mtimeMs > RETENTION_MS) await fs.rm(entry, { recursive: true, force: true });
      }
    } catch { /* first run or already removed */ }
  }
}

if (!store.timer) {
  store.timer = setInterval(() => { void pruneJobs(); }, 30 * 60 * 1000);
  store.timer.unref();
}

function availableJob(id: string): Job | null {
  const job = store.jobs.get(id);
  if (!job) return null;
  if (job.finishedAt && Date.now() - job.finishedAt >= RETENTION_MS) {
    store.jobs.delete(id);
    if (job.filePath) void fs.rm(job.filePath, { force: true }).catch(() => undefined);
    return null;
  }
  return job;
}

export function getJob(id: string): PublicJob | null {
  const job = availableJob(id);
  return job ? publicJob(job) : null;
}

export function getJobFile(id: string): { path: string; format: RenderFormat; size: number } | null {
  const job = availableJob(id);
  if (!job || job.status !== "completed" || !job.filePath || job.fileSize === null) return null;
  return { path: job.filePath, format: job.format, size: job.fileSize };
}

function killProcessTree(child: ChildProcess | null): void {
  if (!child) return;
  // yt-dlp may launch ffmpeg; terminate the whole isolated process group on POSIX.
  if (child.pid && process.platform !== "win32") {
    try { process.kill(-child.pid, "SIGKILL"); return; } catch { /* already exited */ }
  }
  try { child.kill("SIGKILL"); } catch { /* already exited */ }
}

export function cancelJob(id: string): PublicJob | null {
  const job = availableJob(id);
  if (!job) return null;
  if (job.status === "queued" || job.status === "processing") {
    job.status = "canceled";
    job.phase = "Canceled";
    job.finishedAt = Date.now();
    killProcessTree(job.child);
  }
  return publicJob(job);
}

function runProcess(job: Job, command: string, args: string[], timeout: number, onOutput?: (chunk: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (job.status === "canceled") { reject(new Error("canceled")); return; }
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    job.child = child;
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killProcessTree(child); }, timeout);
    child.stdout?.on("data", (chunk: Buffer) => onOutput?.(chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr = (stderr + text).slice(-20_000);
      onOutput?.(text);
    });
    child.once("error", (error) => { clearTimeout(timer); if (job.child === child) job.child = null; reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (job.child === child) job.child = null;
      if (job.status === "canceled") reject(new Error("canceled"));
      else if (timedOut) reject(new Error("The render timed out. Try a shorter clip or lower quality."));
      else if (code === 0) resolve();
      else reject(new Error(stderr || `Process exited with code ${code}`));
    });
  });
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const text = message.toLowerCase();
  if (text.includes("source ended before")) return "The source ended before the selected out point. Check the video’s duration and try again.";
  if (text.includes("timed out")) return "The render timed out. Try a shorter clip or lower quality.";
  if (text.includes("larger than") || text.includes("max-filesize")) return "The source is too large for this server. Try a lower quality.";
  if (text.includes("private") || text.includes("unavailable") || text.includes("sign in") || text.includes("bot")) return "YouTube would not serve this video. It may be private, restricted, or require verification.";
  return "The source could not be downloaded or encoded. Check the server's YouTube access and try again.";
}

async function largestSource(workDir: string): Promise<string> {
  const files = await fs.readdir(workDir);
  const candidates = await Promise.all(files.filter((name) => name.startsWith("source.") && !name.endsWith(".part") && !name.endsWith(".ytdl")).map(async (name) => ({ path: path.join(workDir, name), size: (await fs.stat(path.join(workDir, name))).size })));
  const result = candidates.sort((a, b) => b.size - a.size)[0];
  if (!result) throw new Error("No source file downloaded");
  return result.path;
}

const isCanceled = (job: Job) => job.status === "canceled";

async function runJob(job: Job) {
  const workDir = path.join(ROOT, "tmp", job.id);
  try {
    const downloader = downloaderCommand();
    if (!downloader) throw new Error("Downloader unavailable");
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    await fs.mkdir(workDir, { recursive: true });
    if (isCanceled(job)) return;
    job.status = "processing";
    job.phase = "Fetching the source";
    job.progress = 5;
    const selector = job.format === "mp3" ? "bestaudio/best" : `bestvideo[height<=${job.height}]+bestaudio/best[height<=${job.height}]/best`;
    const args = [...downloader.prefix, "--ignore-config", "--no-playlist", "--newline", "--max-filesize", "500M", "--socket-timeout", "20", "--retries", "2", "-f", selector];
    if (process.env.FFMPEG_PATH) args.push("--ffmpeg-location", process.env.FFMPEG_PATH);
    if (job.format !== "mp3") args.push("--merge-output-format", "mp4");
    args.push("-o", path.join(workDir, "source.%(ext)s"), "--", watchUrl(job.videoId));
    await runProcess(job, downloader.command, args, 300_000, (text) => {
      const match = [...text.matchAll(/\[download\]\s+(\d+(?:\.\d+)?)%/g)].at(-1);
      if (match && job.status === "processing") job.progress = Math.max(job.progress, Math.min(58, 5 + Math.round(Number(match[1]) * 0.53)));
    });
    if (isCanceled(job)) return;
    const source = await largestSource(workDir);
    if (isCanceled(job)) return;
    job.phase = "Encoding your clip";
    job.progress = Math.max(job.progress, 60);
    const out = path.join(workDir, `clip.${job.format}`);
    const args2 = ["-y", "-hide_banner", "-ss", (job.startMs / 1000).toFixed(3), "-i", source, "-t", ((job.endMs - job.startMs) / 1000).toFixed(3)];
    if (job.format === "mp3") args2.push("-vn", "-c:a", "libmp3lame", "-b:a", "192k");
    else if (job.format === "webm") args2.push("-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-c:a", "libopus", "-b:a", "96k");
    else args2.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart");
    if (job.format !== "mp3") args2.push("-vf", `scale=-2:min(ih\\,${job.height})`);
    args2.push(out);
    let encodedSeconds = 0;
    let encodeTail = "";
    await runProcess(job, ffmpeg, args2, 240_000, (text) => {
      encodeTail = (encodeTail + text).slice(-4000);
      const match = [...encodeTail.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].at(-1);
      if (match && job.status === "processing") {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        encodedSeconds = Math.max(encodedSeconds, seconds);
        job.progress = Math.max(job.progress, Math.min(94, 60 + Math.round(seconds / ((job.endMs - job.startMs) / 1000) * 34)));
      }
    });
    if (isCanceled(job)) return;
    const requestedSeconds = (job.endMs - job.startMs) / 1000;
    if (encodedSeconds < requestedSeconds - Math.max(0.5, requestedSeconds * 0.02)) {
      throw new Error("The source ended before the selected out point.");
    }
    await fs.mkdir(path.join(ROOT, "clips"), { recursive: true });
    const final = path.join(ROOT, "clips", `${job.id}.${job.format}`);
    await fs.copyFile(out, final);
    if (isCanceled(job)) { await fs.rm(final, { force: true }); return; }
    const stat = await fs.stat(final);
    if (isCanceled(job)) { await fs.rm(final, { force: true }); return; }
    job.filePath = final;
    job.fileSize = stat.size;
    job.status = "completed";
    job.phase = "Clip ready";
    job.progress = 100;
    job.finishedAt = Date.now();
  } catch (error) {
    if (job.status !== "canceled") {
      job.status = "failed";
      job.phase = "Render failed";
      job.error = friendlyError(error);
      job.finishedAt = Date.now();
    }
  } finally {
    job.child = null;
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function startRender(input: { videoId: string; startMs: number; endMs: number; format: RenderFormat; height: number }): PublicJob {
  if (!isYouTubeId(input.videoId)) throw new Error("Invalid video ID.");
  if ([...store.jobs.values()].filter((job) => job.status === "queued" || job.status === "processing").length >= MAX_ACTIVE_JOBS) throw new Error("The render queue is full. Try again in a moment.");
  const job: Job = {
    ...input, id: randomUUID(), status: "queued", phase: "Preparing your clip", progress: 1,
    fileSize: null, error: null, createdAt: new Date().toISOString(), child: null, filePath: null, finishedAt: null,
  };
  store.jobs.set(job.id, job);
  void pruneJobs();
  void runJob(job);
  return publicJob(job);
}
