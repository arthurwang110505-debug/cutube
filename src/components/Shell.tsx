"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, Clapperboard, FolderHeart, GraduationCap, Moon, Plus, Scissors, Sun } from "lucide-react";
import { LIBRARY_EVENT, readLibrary } from "@/lib/library";

type Theme = "dark" | "light";
const THEME_KEY = "cuttertube.theme.v1";

const links = [
  { href: "/", label: "Studio", mobileLabel: "Studio", icon: Clapperboard },
  { href: "/library", label: "My clips", mobileLabel: "My clips", icon: FolderHeart },
  { href: "/learn", label: "Learn", mobileLabel: "Learn", icon: GraduationCap },
  { href: "/guides", label: "Quick guide", mobileLabel: "Guide", icon: BookOpen },
];

export function Brand() {
  return <Link href="/" className="brand" aria-label="CutterTube home">
    <span className="brand-mark"><Scissors size={18} strokeWidth={2.1} aria-hidden="true" /></span>
    <span className="brand-name">CutterTube</span>
  </Link>;
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [clipCount, setClipCount] = useState(0);
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const refresh = () => setClipCount(readLibrary().length);
    refresh();
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(LIBRARY_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);
  useEffect(() => {
    const syncTheme = () => {
      let savedTheme: Theme = "dark";
      try { if (window.localStorage.getItem(THEME_KEY) === "light") savedTheme = "light"; } catch { /* Storage can be disabled; keep the default dark theme. */ }
      document.documentElement.dataset.theme = savedTheme;
      setTheme(savedTheme);
    };
    syncTheme();
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);
  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    try { window.localStorage.setItem(THEME_KEY, nextTheme); } catch { /* The current tab still changes theme without storage. */ }
  };
  const current = pathname === "/library" ? "My clips" : pathname === "/learn" ? "Learn" : pathname === "/guides" ? "Quick guide" : pathname === "/clip" ? "Shared clip" : "Studio";
  const isStudio = pathname === "/";

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <p className="nav-heading">Workspace</p>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return <Link key={href} href={href} className={`side-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
            {href === "/library" && clipCount > 0 && <span className="nav-count" aria-label={`${clipCount} saved ${clipCount === 1 ? "clip" : "clips"}`}>{clipCount}</span>}
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <span className="local-dot" aria-hidden="true" />
        <p>Your clips are saved in this browser.</p>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><span>Workspace</span><span className="crumb-slash" aria-hidden="true">/</span><strong>{current}</strong></div>
        <div className="mobile-brand"><Brand /></div>
        <div className="topbar-right">
          <span className="topbar-status">Local workspace</span>
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
          {!isStudio && <Link href="/#source" className="topbar-action"><Plus size={16} aria-hidden="true" /> New clip <ArrowUpRight size={14} aria-hidden="true" /></Link>}
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Main navigation">
      {links.map(({ href, mobileLabel, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return <Link key={href} href={href} className={`mobile-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
          <Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span>{mobileLabel}</span>
        </Link>;
      })}
    </nav>
  </div>;
}
