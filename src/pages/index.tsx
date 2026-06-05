import Head from "next/head";
import { GameShell } from "@/components/GameShell";
import { assetPath } from "@/utils/assetPath";

const publicUrl = "https://wangjiehu.github.io/LionCityWhispers/";

export default function Home() {
  return (
    <>
      <Head>
        <title>Lion City Whispers</title>
        <meta
          name="description"
          content="A playable browser prototype for Lion City Whispers."
        />
        <link rel="canonical" href={publicUrl} />
        <meta property="og:title" content="Lion City Whispers" />
        <meta
          property="og:description"
          content="Play the browser prototype directly on GitHub Pages."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={publicUrl} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#101817" />
        <link rel="manifest" href={assetPath("/manifest.webmanifest")} />
      </Head>
      <GameShell />
    </>
  );
}
