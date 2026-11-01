import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Shell from "@/components/Shell";

export default function NotFound() {
  return <Shell><div className="inner-page not-found"><span className="section-overline">Shared clip</span><h1>That moment isn’t here<span>.</span></h1><p>The link may be incomplete or no longer valid.</p><Link href="/" className="inner-primary"><ArrowLeft size={16} aria-hidden="true" /> Back to the studio</Link></div></Shell>;
}
