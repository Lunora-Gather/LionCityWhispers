import Head from "next/head";
import { GameShell } from "@/components/GameShell";
import { assetPath } from "@/utils/assetPath";

const publicUrl = "https://wangjiehu.github.io/LionCityWhispers/";
const publicImageUrl = `${publicUrl}icon-512.png`;

export default function Home() {
  return (
    <>
      <Head>
        <title>狮城秘语 | Lion City Whispers</title>
        <meta
          name="description"
          content="狮城秘语 1.0.0：直接在浏览器中游玩的文物修复、节奏仪式与博物馆布展冒险。"
        />
        <meta name="application-name" content="狮城秘语" />
        <link rel="canonical" href={publicUrl} />
        <meta property="og:title" content="狮城秘语 | Lion City Whispers" />
        <meta
          property="og:description"
          content="1.0.0 public release. Restore Lion City legends through puzzles, rhythm, and museum curation directly in the browser."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={publicUrl} />
        <meta property="og:image" content={publicImageUrl} />
        <meta property="og:site_name" content="狮城秘语" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="狮城秘语 | Lion City Whispers" />
        <meta
          name="twitter:description"
          content="Play the 1.0.0 browser release of Lion City Whispers on GitHub Pages."
        />
        <meta name="twitter:image" content={publicImageUrl} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#101817" />
        <link rel="manifest" href={assetPath("/manifest.webmanifest")} />
      </Head>
      <GameShell />
    </>
  );
}
