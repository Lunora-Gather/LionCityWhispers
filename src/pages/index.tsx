import Head from "next/head";
import { GameShell } from "@/components/GameShell";
import { assetPath } from "@/utils/assetPath";

export default function Home() {
  return (
    <>
      <Head>
        <title>Lion City Whispers</title>
        <meta
          name="description"
          content="A playable browser prototype for Lion City Whispers."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#101817" />
        <link rel="manifest" href={assetPath("/manifest.webmanifest")} />
        <link rel="preload" as="image" href={assetPath("/assets/images/world-cinematic.webp")} />
        <link rel="preload" as="image" href={assetPath("/assets/images/museum-gallery.webp")} />
        <link rel="preload" as="image" href={assetPath("/assets/images/artifact-sheet.webp")} />
        <link rel="preload" as="image" href={assetPath("/assets/images/curator-lin.webp")} />
        <link rel="preload" as="audio" href={assetPath("/assets/audio/ui-click.wav")} />
      </Head>
      <GameShell />
    </>
  );
}
