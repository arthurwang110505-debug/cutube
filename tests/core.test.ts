import test from "node:test";
import assert from "node:assert/strict";
import { clipFromParams, clipParams, clipUrl, validateClip, type Clip } from "../src/lib/clip";
import { renderExport } from "../src/lib/exports";
import { formatClipLength, formatTime, parseTime } from "../src/lib/time";
import { extractChapters, fetchVideoMeta, parseYouTubeInput } from "../src/lib/youtube";

const id = "aqz-KE-bpKQ";
const clip: Clip = { videoId: id, title: "A moment & a <story>", note: "A note\n第二行", startMs: 12_345, endMs: 32_500, durationMs: 120_000 };

test("timecode parser accepts flexible inputs and rejects invalid ranges", () => {
  assert.equal(parseTime("90"), 90_000);
  assert.equal(parseTime("1:02.34"), 62_340);
  assert.equal(parseTime("01:02:03.004"), 3_723_004);
  assert.equal(parseTime("1:99"), null);
  assert.equal(parseTime("01:60:01"), null);
  assert.equal(parseTime("-1"), null);
  assert.equal(parseTime("24:00:00.001"), null);
  assert.equal(formatTime(3_723_004), "01:02:03.004");
  assert.equal(formatClipLength(100), "0:00.1");
  assert.equal(formatClipLength(20_155), "0:20.155");
});

test("YouTube parser supports common links and their timestamps", () => {
  assert.deepEqual(parseYouTubeInput(id), { videoId: id, startSeconds: 0 });
  assert.deepEqual(parseYouTubeInput(`https://youtu.be/${id}?t=1h2m3s`), { videoId: id, startSeconds: 3723 });
  assert.deepEqual(parseYouTubeInput(`youtube.com/shorts/${id}?start=42`), { videoId: id, startSeconds: 42 });
  assert.deepEqual(parseYouTubeInput(`https://www.youtube-nocookie.com/embed/${id}#t=1m`), { videoId: id, startSeconds: 60 });
  assert.deepEqual(parseYouTubeInput(`https://music.youtube.com/watch?v=${id}`), { videoId: id, startSeconds: 0 });
});

test("YouTube parser rejects spoofed domains, user info and unrelated paths", () => {
  for (const input of [
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://evil.test@youtube.com/watch?v=${id}`,
    `https://youtube.com/channel/example?v=${id}`,
    `https://youtube.com:8080/watch?v=${id}`,
    "file:///etc/passwd",
    "not a link",
  ]) assert.equal(parseYouTubeInput(input), null, input);
});

test("chapter extraction sorts and deduplicates real description markers", () => {
  assert.deepEqual(extractChapters("0:40 Middle\n0:00 Introduction\n0:40 Duplicate\n1:40 Finish", 180), [
    { title: "Introduction", startSeconds: 0 }, { title: "Middle", startSeconds: 40 }, { title: "Finish", startSeconds: 100 },
  ]);
  assert.deepEqual(extractChapters("0:10 Just one", 100), []);
  assert.deepEqual(extractChapters("0:90 Invalid\n2:00 Past the end", 60), []);
});

test("share links round-trip safely, including Unicode and reserved characters", () => {
  const url = new URL(clipUrl(clip, "https://example.test"));
  assert.equal(url.pathname, "/clip");
  assert.deepEqual(clipFromParams(url.searchParams), clip);
  assert.deepEqual(clipFromParams(clipParams(clip)), clip);
  assert.equal(clipFromParams(new URLSearchParams(`v=${id}&start=500&end=501`)), null);
  assert.equal(clipFromParams(new URLSearchParams(`v=${id}&start=20&end=1000&duration=300`)), null);
  assert.equal(clipFromParams(new URLSearchParams(`v=${id}&start=Infinity&end=1000`)), null);
});

test("clip validation enforces duration and time boundaries", () => {
  assert.equal(validateClip(clip), null);
  assert.match(validateClip({ ...clip, endMs: clip.startMs + 99 })!, /0.1 seconds/);
  assert.match(validateClip({ ...clip, endMs: clip.startMs + 3_600_001, durationMs: undefined })!, /one hour/);
  assert.match(validateClip({ ...clip, endMs: 130_000 })!, /end of the video/);
  assert.ok(validateClip({ ...clip, videoId: "not-a-valid-video-id" }));
});

test("exports preserve precise times and don't inject title text into shell commands", () => {
  const parsed = JSON.parse(renderExport("json", clip, "https://example.test"));
  assert.equal(parsed.startMs, 12_345);
  assert.equal(parsed.endMs, 32_500);
  assert.match(renderExport("vtt", clip, "https://example.test"), /00:00:00\.000 --> 00:00:20\.155/);
  assert.match(renderExport("srt", clip, "https://example.test"), /00:00:00,000 --> 00:00:20,155/);
  const script = renderExport("sh", { ...clip, title: "$(touch /tmp/not-safe)" }, "https://example.test");
  assert.doesNotMatch(script, /not-safe/);
  assert.match(script, /-ss 12\.345/);
  assert.throws(() => renderExport("sh", { ...clip, videoId: "';rm -rf /" }, "https://example.test"));
});

test("metadata is useful even when the server cannot reach YouTube", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("network unavailable"); }) as typeof fetch;
  try {
    const video = await fetchVideoMeta(id);
    assert.equal(video.metadataSource, "fallback");
    assert.equal(video.videoId, id);
    assert.equal(video.durationSeconds, 0);
  } finally { globalThis.fetch = original; }
});

test("metadata combines the watch page and creator chapters", async () => {
  const original = globalThis.fetch;
  const html = String.raw`<meta property="og:title" content="The &amp; Story"><script>{"videoDetails":{"title":"Fallback title","author":"A Creator","lengthSeconds":"120","shortDescription":"0:00 Intro\n0:30 A scene"}}</script>`;
  globalThis.fetch = (async (input: string | URL | Request) => String(input).includes("oembed")
    ? new Response(JSON.stringify({ title: "OEmbed title", author_name: "OEmbed author" }), { status: 200 })
    : new Response(html, { status: 200 })) as typeof fetch;
  try {
    const video = await fetchVideoMeta(id);
    assert.equal(video.title, "The & Story");
    assert.equal(video.channel, "A Creator");
    assert.equal(video.durationSeconds, 120);
    assert.equal(video.chapters.length, 2);
    assert.equal(video.metadataSource, "watch_page");
  } finally { globalThis.fetch = original; }
});
