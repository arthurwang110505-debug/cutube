import { notFound } from "next/navigation";
import EmbedView from "@/components/EmbedView";
import { clipFromParams } from "@/lib/clip";
export default async function EmbedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  const clip = clipFromParams(params);
  if (!clip) notFound();
  return <EmbedView clip={clip} />;
}
