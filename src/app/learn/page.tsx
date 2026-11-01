import Link from "next/link";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import Shell from "@/components/Shell";

export const metadata = { title: "Learn — CutterTube" };

const programs = [
  {
    id: "first-clip", level: "Getting started", title: "Make your first clip", description: "Go from a YouTube link to a shareable moment.",
    lessons: [
      ["Add a video", "Paste a YouTube link or video ID into the studio and select Load video. You can also try the example."],
      ["Choose the moment", "Drag the green timeline handles, type start and end times, or use Set to playhead. Preview the range and adjust until it feels right."],
      ["Save or share", "Save the clip to this browser or copy its share link. Your video remains on YouTube; a share link describes the selected range."],
    ],
  },
  {
    id: "precision", level: "Editing", title: "Trim with confidence", description: "Fine-tune a selection and check it before sharing.",
    lessons: [
      ["Find the boundaries", "Play the video to locate the beginning and end. Use Set to playhead for each point, then preview with loop enabled."],
      ["Fine-tune the timing", "Type a timecode or use the plus and minus buttons to adjust by 0.1 seconds. Focus a timeline handle and use arrow keys; hold Shift for one-second steps."],
      ["Check the result", "YouTube seeking can be approximate even though the editor stores milliseconds. Replay the selection, and check the original video if the embed is unavailable."],
    ],
  },
  {
    id: "sharing", level: "Sharing responsibly", title: "Share, save & export", description: "Choose the right output and understand its limits.",
    lessons: [
      ["Know where clips live", "The library is stored in this browser only; clearing site data can remove it. A copied share link works independently of the library."],
      ["Share thoughtfully", "Anyone with the link can view the video ID, times, title and note. Avoid sensitive information: links cannot be revoked."],
      ["Choose an export", "Export timecodes or other metadata from Share & save. Server rendering is optional; a local script is available when the server cannot render. Only use content you own or have permission to use."],
    ],
  },
];

export default function LearnPage() {
  return <Shell><div className="inner-page learn-page">
    <div className="section-overline">Learn with CutterTube <span className="overline-rule" /> Practical programs</div>
    <div className="inner-page-head"><div><h1>Learn the art of <em>the cut.</em></h1><p>Short, practical programs to help you find, refine, and share a moment.</p></div><Link href="/#source" className="inner-primary">Open the studio <ArrowRight size={15} /></Link></div>
    <nav className="learn-index" aria-label="Learning programs">{programs.map((program, index) => <a href={`#${program.id}`} key={program.id}><span>0{index + 1}</span><strong>{program.title}</strong><ArrowRight size={15} /></a>)}</nav>
    <div className="learn-programs">{programs.map((program, index) => <section className="learn-program panel" id={program.id} key={program.id} aria-labelledby={`${program.id}-title`}>
      <div className="learn-program-header"><div><div className="section-overline">Program 0{index + 1} <span className="overline-rule" /> {program.level}</div><h2 id={`${program.id}-title`}>{program.title}</h2><p>{program.description}</p></div><span className="learn-lesson-count"><BookOpen size={15} aria-hidden="true" /> {program.lessons.length} lessons</span></div>
      <ol className="learn-lessons">{program.lessons.map(([title, body], lessonIndex) => <li key={title}><span className="learn-number">0{lessonIndex + 1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
      <div className="learn-footer"><span><Clock3 size={14} /> Learn at your own pace</span><Link href="/#source">Practice in the studio <ArrowRight size={14} /></Link></div>
    </section>)}</div>
    <p className="learn-more">Looking for quick answers? Visit the <Link href="/guides">quick guide</Link>.</p>
  </div></Shell>;
}
