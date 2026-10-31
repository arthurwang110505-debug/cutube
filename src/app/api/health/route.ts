import { rendererStatus } from "@/lib/render";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ renderer: rendererStatus() }, { headers: { "Cache-Control": "no-store" } });
}
