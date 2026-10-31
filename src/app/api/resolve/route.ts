import { NextResponse } from "next/server";
import { fetchVideoMeta, parseYouTubeInput } from "@/lib/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const value = typeof body === "object" && body !== null && "url" in body && typeof body.url === "string" ? body.url : "";
  const parsed = parseYouTubeInput(value);
  if (!parsed) return NextResponse.json({ error: "Enter a valid YouTube watch, share, Shorts, live, or embed link." }, { status: 422 });
  try {
    const video = await fetchVideoMeta(parsed.videoId);
    return NextResponse.json({ video, startSeconds: parsed.startSeconds }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load this video. Please try again." }, { status: 502 });
  }
}
