import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import ShareView from "@/components/ShareView";
import { clipFromParams } from "@/lib/clip";

export const metadata = { title: "Shared clip — CutterTube" };
export default async function ClipPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (typeof value === "string") params.set(key, value);
  const clip = clipFromParams(params);
  if (!clip) notFound();
  return <Shell><ShareView clip={clip} /></Shell>;
}
