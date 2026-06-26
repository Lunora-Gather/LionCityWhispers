import type { AppProps } from "next/app";
import "@/styles/globals.css";
import "@/styles/layout-polish.css";
import "@/styles/experience-polish.css";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
