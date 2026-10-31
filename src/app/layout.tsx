import type { Metadata } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CutterTube — Create and share YouTube clips",
  description: "Choose a moment, fine-tune the timecodes, preview it, and share a link. No account needed; videos stay on YouTube.",
  applicationName: "CutterTube",
  openGraph: {
    title: "CutterTube — Create and share YouTube clips",
    description: "Find the moment. Set the cut. Share a time-range link — no account needed.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CutterTube — Create and share YouTube clips",
    description: "Find the moment. Set the cut. Share a time-range link — no account needed.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
}
