import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

const themeBootstrap = `(()=>{try{const theme=localStorage.getItem("cuttertube.theme.v1");if(theme==="light"||theme==="dark")document.documentElement.dataset.theme=theme;}catch{}})();`;

export const metadata: Metadata = {
  title: "CutterTube: Create and share YouTube clips",
  description: "Choose a moment, fine-tune the timecodes, preview it, and share a link. No account needed; videos stay on YouTube.",
  applicationName: "CutterTube",
  openGraph: {
    title: "CutterTube: Create and share YouTube clips",
    description: "Find the moment. Set the cut. Share a time-range link, no account needed.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CutterTube: Create and share YouTube clips",
    description: "Find the moment. Set the cut. Share a time-range link, no account needed.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning><body>
    <Script id="cuttertube-theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
    <a className="skip-link" href="#main-content">Skip to content</a>{children}
  </body></html>;
}
