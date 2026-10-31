import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getJobFile } from "@/lib/render";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = getJobFile(id);
  if (!file) return Response.json({ error: "This render is not ready or has expired." }, { status: 404 });
  try { await stat(file.path); } catch { return Response.json({ error: "This render has expired." }, { status: 410 }); }
  const type = file.format === "mp3" ? "audio/mpeg" : file.format === "webm" ? "video/webm" : "video/mp4";
  const stream = Readable.toWeb(createReadStream(file.path)) as ReadableStream;
  return new Response(stream, { headers: { "Content-Type": type, "Content-Length": String(file.size), "Content-Disposition": `attachment; filename="cuttertube-clip.${file.format}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
