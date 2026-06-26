import Head from "next/head";
import { GameShell } from "@/components/GameShell";
import { assetPath } from "@/utils/assetPath";

const publicUrl = "https://lunora-gather.github.io/LionCityWhispers/";
const publicImageUrl = `${publicUrl}icon-512.png`;
const title = "狮城秘语 | Lion City Whispers";
const description =
  "狮城秘语 1.0.0：直接在浏览器中游玩的双语叙事解谜游戏，融合文物修复、节奏仪式与博物馆布展冒险。";
const englishDescription =
  "Play Lion City Whispers 1.0.0, a bilingual browser game about artifact restoration, rhythm ritual, and museum curation.";
const structuredData = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "狮城秘语 | Lion City Whispers",
  url: publicUrl,
  image: publicImageUrl,
  description: englishDescription,
  genre: ["Narrative puzzle", "Browser game", "Educational adventure"],
  applicationCategory: "GameApplication",
  operatingSystem: "Web browser",
  inLanguage: ["zh-Hans", "en"],
  isAccessibleForFree: true,
  publisher: {
    "@type": "Organization",
    name: "Lunora Gather"
  }
};

export default function Home() {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta
          name="keywords"
          content="狮城秘语,Lion City Whispers,browser game,narrative puzzle game,Phaser,Next.js,GitHub Pages,PWA"
        />
        <meta name="application-name" content="狮城秘语" />
        <meta name="robots" content="index,follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#101817" />
        <meta name="color-scheme" content="dark" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="狮城秘语" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="canonical" href={publicUrl} />
        <link rel="manifest" href={assetPath("/manifest.webmanifest")} />
        <link rel="apple-touch-icon" href={assetPath("/icon-192.png")} />
        <link rel="icon" href={assetPath("/icon.svg")} type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={englishDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={publicUrl} />
        <meta property="og:image" content={publicImageUrl} />
        <meta property="og:image:alt" content="Lion City Whispers game icon" />
        <meta property="og:site_name" content="狮城秘语" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={englishDescription} />
        <meta name="twitter:image" content={publicImageUrl} />
        <meta name="twitter:image:alt" content="Lion City Whispers game icon" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      <GameShell />
    </>
  );
}
