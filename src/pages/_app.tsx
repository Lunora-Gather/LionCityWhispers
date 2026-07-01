import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";
import "@/styles/globals.css";
import "@/styles/polish.css";
import "@/styles/experience-polish.css";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (!gaId) return;

    const handleRouteChange = (url: string) => {
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("config", gaId, {
          page_path: url,
        });
      }
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [router.events]);

  return <Component {...pageProps} />;
}
