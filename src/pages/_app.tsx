import type { AppProps } from "next/app";
import "@/styles/globals.css";
import "@/styles/polish.css";
import "@/styles/experience-polish.css";
import "@/styles/redesign.css";

// The site is a single static route, so there are no client route changes to
// report to GA; _document.tsx already sends the initial page view.
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
