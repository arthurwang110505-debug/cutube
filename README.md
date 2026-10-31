# CutterTube

A focused YouTube clipping workspace, combining the original projects' **fine timecodes, looping preview, chapters and share/embed links** with **optional MP4, WebM and MP3 rendering**. The editor, share links, local library and metadata exports work without an account or a database.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000>. The development server binds to `0.0.0.0` for proxied previews. Production: `npm run build && npm start`.

### What works out of the box

- Paste a YouTube watch, share, Shorts, live or embed URL (or an 11-character ID). A timestamp in the URL becomes the initial in point.
- Drag or keyboard-adjust the selection, type timecodes, nudge by 100 ms, preview/loop, or select creator chapters when metadata is available.
- Save clips in **this browser's local storage**, or share a self-contained link and copy embed HTML. Sharing points to YouTube; it does not upload the video.
- Export clip JSON, Markdown, a timecode sheet, WebVTT/SRT **marker** files, or a local `yt-dlp` / FFmpeg render script.
- When server metadata or the embedded player is unavailable, the editor still accepts manual timecodes. Video duration, chapters and preview depend on YouTube availability and embed permissions. Editing stores millisecond values, but YouTube playback/seeking can be approximate.

Up to 100 saved clips are stored locally; they are not synced across browsers and can disappear if site data is cleared. Share links work independently of the local library, as long as recipients can reach the deployment. Anyone with a link can view it: the video ID, times, title and note are included in the URL. Do not put sensitive information in a link; there is no revocation mechanism.

## Optional server-side rendering

Rendering is **disabled by default**. It requires a persistent Node server, a writable temporary directory, network access to YouTube, FFmpeg, and `yt-dlp` (either an executable or the `python3 -m yt_dlp` module). Copy `.env.example` to `.env.local`, set `ENABLE_SERVER_RENDER=true`, and optionally set `FFMPEG_PATH`, `YT_DLP_PATH`, or `CLIP_DATA_DIR`. Restart the server. The Download tab reports whether the renderer is ready; the downloadable local render script is available even when it is not.

The renderer accepts YouTube IDs only, limits output to 1–10 minutes and two concurrent jobs, passes a 500 MB size limit to yt-dlp, and supports cancellation. Enforce disk quotas separately, since source sizes are not always known in advance. Job IDs are unguessable bearer links: anyone who has an ID can check, cancel or download that job. Keep the tab open to track a render; refreshing loses the job reference. Jobs are held in one process's memory; they disappear on restart and are **not suitable for serverless or multi-instance deployment without a durable queue and shared storage**. Completed files are inaccessible after 24 hours and cleaned up by a periodic sweep. Before exposing rendering to untrusted users, add authentication, per-user authorization, rate/resource limits and an isolated worker appropriate to the deployment.

Only download or otherwise use content you own or have permission to use, and comply with applicable law and YouTube's terms. Sharing links and embeds still depend on the source video remaining available and embeddable.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The tests cover URL/timecode validation, chapter extraction, stateless sharing, exports, metadata fallback and render job state/cancellation. A real YouTube render additionally depends on the runtime's network access and installed tools.
