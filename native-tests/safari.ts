import { expect as checks, test as runner, type Page as PlaywrightPage, type Browser as PlaywrightBrowser } from "@playwright/test";
// Safari runs under the system's WebDriver. The test runner supplies scheduling and assertions.
// @ts-expect-error The native JavaScript fixture has no TypeScript declaration.
import { launchSafari } from "./session.cjs";
// @ts-expect-error The native JavaScript fixture has no TypeScript declaration.
import { serveGame } from "./game-server.cjs";

export type Page = PlaywrightPage;
type Locator = {
  isVisible(): Promise<boolean>;
  isChecked(): Promise<boolean>;
  count(): Promise<number>;
  inputValue(): Promise<string>;
  textContent(): Promise<string | null>;
  allTextContents(): Promise<string[]>;
};
type MatcherOptions = {timeout?: number};
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

async function waitForMatch(
  negated: boolean, description: string, predicate: () => Promise<boolean>, options?: MatcherOptions
) {
  const desired = !negated;
  try {
    await checks.poll(predicate, {timeout: options?.timeout ?? 15000}).toBe(desired);
    return {pass: desired, message: () => `Expected Safari element ${description}`};
  } catch (error) {
    return {pass: !desired, message: () => `Expected Safari element ${description}\n${error}`};
  }
}

export const expect = checks.extend({
  toBeVisible: function (locator: Locator, options?: MatcherOptions) {
    return waitForMatch(this.isNot, "to be visible", () => locator.isVisible(), options);
  },
  toBeHidden: function (locator: Locator, options?: MatcherOptions) {
    return waitForMatch(this.isNot, "to be hidden", async () => !await locator.isVisible(), options);
  },
  toBeChecked: function (locator: Locator, options?: MatcherOptions) {
    return waitForMatch(this.isNot, "to be checked", () => locator.isChecked(), options);
  },
  toHaveCount: function (locator: Locator, expected: number, options?: MatcherOptions) {
    return waitForMatch(this.isNot, `to have count ${expected}`, async () => await locator.count() === expected, options);
  },
  toHaveValue: function (locator: Locator, expected: string, options?: MatcherOptions) {
    return waitForMatch(this.isNot, `to have value ${expected}`, async () => await locator.inputValue() === expected, options);
  },
  toContainText: function (locator: Locator, expected: string, options?: MatcherOptions) {
    return waitForMatch(this.isNot, `to contain ${expected}`, async () => normalize(await locator.textContent() ?? "").includes(normalize(expected)), options);
  },
  toHaveText: function (locator: Locator, expected: string[], options?: MatcherOptions) {
    return waitForMatch(this.isNot, `to have texts ${expected.join(", ")}`, async () => {
      const texts = await locator.allTextContents();
      return texts.length === expected.length && texts.every((text, i) => normalize(text) === normalize(expected[i]));
    }, options);
  }
});

type Game = {
  origin: string;
  scripts: (() => void)[];
  close(): Promise<void>;
};
export const test = runner.extend<{game: Game, nativeBrowser: Pick<PlaywrightBrowser, "newPage">}>({
  game: async ({}, use) => {
    const game = await serveGame();
    try { await use(game); } finally { await game.close(); }
  },
  baseURL: async ({game}, use) => use(game.origin),
  page: async ({game, viewport, isMobile}, use, info) => {
    const page = await launchSafari(game, {viewport: viewport ?? {width: 1280, height: 800}, mobile: isMobile});
    try {
      await use(page as Page);
    } finally {
      try {
        if (info.status !== info.expectedStatus) {
          await info.attach("safari", {body: await page.screenshot(), contentType: "image/png"}).catch(() => {});
        }
      } finally { await page.close(); }
    }
  },
  nativeBrowser: async ({game}, use) => {
    const pages = new Set<Awaited<ReturnType<typeof launchSafari>>>();
    const browser = {
      async newPage({viewport = {width: 1280, height: 800}, isMobile = false} = {}) {
        const page = await launchSafari(game, {viewport, mobile: isMobile});
        pages.add(page);
        const close = page.close.bind(page);
        page.close = async () => {
          if (pages.delete(page)) await close();
        };
        return page;
      }
    };
    try {await use(browser as unknown as PlaywrightBrowser);} finally {
      for (const page of pages) await page.close();
    }
  }
});
