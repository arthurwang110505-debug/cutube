import { getJob } from "@/lib/render";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  return job ? Response.json({ job }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Render not found or expired." }, { status: 404 });
}
