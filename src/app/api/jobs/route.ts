import { validateClip } from "@/lib/clip";
import { rendererStatus, startRender, type RenderFormat } from "@/lib/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error();
    body = raw as Record<string, unknown>;
  } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  const videoId = typeof body.videoId === "string" ? body.videoId : "";
  const startMs = typeof body.startMs === "number" ? body.startMs : NaN;
  const endMs = typeof body.endMs === "number" ? body.endMs : NaN;
  const error = validateClip({ videoId, startMs, endMs, title: "", note: "" });
  if (error) return Response.json({ error }, { status: 422 });
  if (endMs - startMs < 1000 || endMs - startMs > 10 * 60 * 1000) return Response.json({ error: "Server renders must be between 1 second and 10 minutes." }, { status: 422 });
  if (typeof body.format !== "string" || !["mp4", "webm", "mp3"].includes(body.format)) return Response.json({ error: "Choose MP4, WebM, or MP3." }, { status: 422 });
  const height = typeof body.height === "number" ? body.height : 720;
  if (![360, 480, 720, 1080].includes(height)) return Response.json({ error: "Choose a supported resolution." }, { status: 422 });
  const status = rendererStatus();
  if (!status.ready) return Response.json({ error: status.message }, { status: 503 });
  try {
    const job = startRender({ videoId, startMs, endMs, height, format: body.format as RenderFormat });
    return Response.json({ job }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    return Response.json({ error: caught instanceof Error ? caught.message : "Could not start rendering." }, { status: 429 });
  }
}
