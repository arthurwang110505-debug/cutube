import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Clapperboard, Link2, Scissors, Share2 } from "lucide-react";
import Shell from "@/components/Shell";

export const metadata = { title: "Quick guide — CutterTube" };
const steps = [
  { icon: Link2, label: "01 / BRING IT IN", title: "Start with a link.", body: "Paste a YouTube watch URL, a Shorts link, a share link, or a video ID. If the link has a timestamp, we’ll use it as your starting point." },
  { icon: Scissors, label: "02 / FIND THE MOMENT", title: "Make the cut.", body: "Drag the handles, enter timecodes, or use the + and − buttons to nudge by 0.1 seconds. Use a quick length to get in the ballpark." },
  { icon: Clapperboard, label: "03 / TAKE A LOOK", title: "Preview the magic.", body: "Play and loop your selection before sharing it. Creator chapters appear when available. YouTube’s player can seek approximately depending on the source." },
  { icon: Share2, label: "04 / PASS IT ON", title: "Keep or share it.", body: "Save a clip in this browser or copy a link anyone can open. Download a timecode sheet, data, marker files, or a local render script." },
];
const faqs = [
  ["Where are my saved clips?", "Saved clips live in this browser’s local storage, not an account. Clearing site data or switching browsers can remove them. A copied share link works independently of your library."],
  ["Are share links private?", "Anyone with a link can view it. The link contains the video ID, selected times, title and note, so don’t put sensitive information in it. There is no account or revocation system."],
  ["Can I download an actual video or audio file?", "The Download file tab can render MP4, WebM, or MP3 when the server is explicitly configured with FFmpeg and yt-dlp. Otherwise, use the render script on your own machine. Only download content you own or are permitted to use."],
  ["Why can’t I see a preview?", "Some creators restrict embedding, a browser may block YouTube, or the video may be unavailable. You can still type timecodes and create a link; check the original video to confirm your selection."],
  ["How precise is the cut?", "Timecodes are stored in milliseconds and can be nudged by 100 ms. YouTube playback is approximate and can seek to nearby keyframes; check the preview. Rendered file accuracy also depends on the source and encoder."],
];

export default function GuidesPage() {
  return <Shell><div className="inner-page guides-page">
    <div className="section-overline"><span>✳</span> THE LITTLE HOW-TO <span className="overline-rule" /> START HERE</div>
    <div className="inner-page-head"><div><h1>Good clips start <em>here.</em></h1><p>A few little tips for finding the moments worth sharing.</p></div><Link href="/#source" className="inner-primary">Open the studio <ArrowRight size={15} /></Link></div>
    <div className="guide-grid">{steps.map(({ icon: Icon, label, title, body }) => <article className="guide-card" key={label}><div className="guide-card-top"><span>{label}</span><Icon size={19} /></div><h2>{title}</h2><p>{body}</p></article>)}</div>
    <div className="guide-columns"><section className="faq-section"><div className="section-overline"><span>✳</span> GOOD TO KNOW</div><h2>Questions, answered<span>.</span></h2><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section><aside className="shortcut-card"><div className="shortcut-icon"><BookOpen size={20} /></div><span className="section-kicker">A LITTLE SHORTCUT</span><h2>Work a little faster.</h2><p>Use these when you’re not typing in a field.</p><dl><div><dt>Play / pause</dt><dd>SPACE</dd></div><div><dt>Set start / end</dt><dd>[ &nbsp; ]</dd></div><div><dt>Seek 1 second</dt><dd>← &nbsp; →</dd></div><div><dt>Seek 10 seconds</dt><dd>SHIFT + ← / →</dd></div><div><dt>Toggle loop</dt><dd>L</dd></div></dl><Link href="/">Try it in the studio <ArrowUpRight size={15} /></Link></aside></div>
    <footer className="workspace-footer"><span>✳ &nbsp; MADE FOR THE MOMENTS THAT MATTER.</span><span>All video belongs to its original creators.</span></footer>
  </div></Shell>;
}
