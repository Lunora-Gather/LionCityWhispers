import Head from "next/head";
import { GameShell } from "@/components/GameShell";
import { assetPath } from "@/utils/assetPath";

const publicUrl = "https://wangjiehu.github.io/LionCityWhispers/";

export default function Home() {
  return (
    <>
      <Head>
        <title>狮城秘语 | Lion City Whispers</title>
        <meta
          name="description"
          content="直接在浏览器中游玩的狮城秘语修复冒险。"
        />
        <link rel="canonical" href={publicUrl} />
        <meta property="og:title" content="狮城秘语 | Lion City Whispers" />
        <meta
          property="og:description"
          content="直接在 GitHub Pages 游玩狮城秘语。"
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
