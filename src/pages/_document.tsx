import { Head, Html, Main, NextScript } from "next/document";
import { assetPath } from "@/utils/assetPath";

export default function Document() {
  return (
    <Html lang="zh-Hans">
      <Head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;800&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="preload" href={assetPath("/assets/images/lion-city-ink-bg.webp")} as="image" />
        <link rel="preload" href={assetPath("/assets/images/world-cinematic-v3.webp")} as="image" />
        {process.env.NEXT_PUBLIC_GA_ID ? (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        ) : null}
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
