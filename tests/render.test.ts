import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Small deterministic stand-ins exercise process lifecycle without requiring YouTube.
// Actual media encoding should also be checked with real FFmpeg in an integration environment.
const root = mkdtempSync(path.join(tmpdir(), "cuttertube-test-"));
const ffmpeg = path.join(root, "fake-ffmpeg");
const ytdlp = path.join(root, "fake-ytdlp");
writeFileSync(ffmpeg, `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('-version')) process.exit(0);
fs.writeFileSync(args.at(-1), 'fake encoded clip');
console.error('time=00:00:02.00');
`, { mode: 0o755 });
writeFileSync(ytdlp, `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('--version')) process.exit(0);
const output = args[args.indexOf('-o') + 1].replace('%(ext)s', 'mp4');
if (args.some(arg => arg.includes('canceltest'))) {
  console.log('[download] 1.0%');
  setTimeout(() => fs.writeFileSync(output, 'late source'), 30000);
} else {
  fs.writeFileSync(output, 'fake source');
  console.log('[download] 100.0%');
}
`, { mode: 0o755 });
process.env.ENABLE_SERVER_RENDER = "true";
process.env.FFMPEG_PATH = ffmpeg;
process.env.YT_DLP_PATH = ytdlp;
process.env.CLIP_DATA_DIR = path.join(root, "data");

const render = import("../src/lib/render");
const base = { videoId: "aqz-KE-bpKQ", startMs: 1000, endMs: 3000, height: 360, format: "mp4" as const };
async function waitUntil(predicate: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for render job");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test.after(() => { rmSync(root, { recursive: true, force: true }); });

test("configured render job reaches completed and exposes a download", async () => {
  const engine = await render;
  assert.equal(engine.rendererStatus().ready, true);
  const job = engine.startRender(base);
  await waitUntil(() => !["queued", "processing"].includes(engine.getJob(job.id)?.status ?? ""));
  const completed = engine.getJob(job.id);
  assert.equal(completed?.status, "completed");
  assert.equal(completed?.progress, 100);
  assert.ok(engine.getJobFile(job.id)?.size);
  assert.equal(engine.getJob("unknown"), null);
});

test("queue limit and cancellation keep canceled jobs from becoming failures", async () => {
  const engine = await render;
  const one = engine.startRender({ ...base, videoId: "canceltest1" });
  const two = engine.startRender({ ...base, videoId: "canceltest2" });
  assert.throws(() => engine.startRender(base), /queue is full/);
  await waitUntil(() => engine.getJob(one.id)?.status === "processing" && engine.getJob(two.id)?.status === "processing");
  assert.equal(engine.cancelJob(one.id)?.status, "canceled");
  assert.equal(engine.cancelJob(two.id)?.status, "canceled");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(engine.getJob(one.id)?.status, "canceled");
  assert.equal(engine.getJob(two.id)?.status, "canceled");
  assert.equal(engine.getJobFile(one.id), null);
});
