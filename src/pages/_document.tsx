import { Head, Html, Main, NextScript } from "next/document";
import { assetPath } from "@/utils/assetPath";

export default function Document() {
  return (
    <Html lang="zh-Hans">
      <Head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="preload" href={assetPath("/assets/images/lion-city-ink-bg.webp")} as="image" />
        <link rel="preload" href={assetPath("/assets/images/world-cinematic-v3.webp")} as="image" />
      </Head>
      <body>
        <noscript>
          <section className="noscript-fallback">
            <article>
              <h1>狮城秘语</h1>
              <p>
                本游戏需要 JavaScript 才能运行。请在浏览器中启用 JavaScript 后重新打开页面。
                <br />
                Lion City Whispers needs JavaScript to run. Please enable JavaScript and reload the page.
              </p>
            </article>
          </section>
        </noscript>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
