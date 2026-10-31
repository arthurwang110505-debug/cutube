"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, Clapperboard, FolderHeart, GraduationCap, Plus, Scissors, Sparkles } from "lucide-react";
import { LIBRARY_EVENT, readLibrary } from "@/lib/library";

const links = [
  { href: "/", label: "Studio", icon: Clapperboard },
  { href: "/library", label: "My clips", icon: FolderHeart },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/guides", label: "Quick guide", icon: BookOpen },
];

export function Brand() {
  return <Link href="/" className="brand" aria-label="CutterTube home">
    <span className="brand-mark"><Scissors size={18} strokeWidth={2.4} aria-hidden="true" /></span>
    <span>cutter<span className="brand-accent">tube</span><span className="brand-dot">.</span></span>
  </Link>;
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const refresh = () => setCount(readLibrary().length);
    refresh();
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(LIBRARY_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  const current = pathname === "/library" ? "My clips" : pathname === "/learn" ? "Learn" : pathname === "/guides" ? "Quick guide" : pathname === "/clip" ? "Shared clip" : "Studio";
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-section-label">YOUR WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={`side-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
            {href === "/library" && count > 0 && <span className="nav-count">{count}</span>}
          </Link>;
        })}
      </nav>
      <div className="sidebar-spacer" />
      <div className="side-note">
        <span className="side-note-icon"><Sparkles size={15} aria-hidden="true" /></span>
        <p>Big moments, <br /><strong>little cuts.</strong></p>
        <Link href="/guides">Explore the guide <ArrowUpRight size={13} /></Link>
      </div>
      <div className="sidebar-bottom"><span className="green-dot" /> MADE FOR THE MOMENT <span>✳</span></div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><span className="topbar-crumb">WORKSPACE</span><span className="crumb-slash">/</span><strong>{current}</strong></div>
        <div className="topbar-right"><span className="topbar-status"><span className="green-dot" /> No account needed</span><Link href="/#source" className="top-new"><Plus size={15} /> New clip</Link></div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  </div>;
}
