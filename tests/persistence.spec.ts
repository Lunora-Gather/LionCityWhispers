import { expect, type Page, test } from "@playwright/test";

async function gamePoint(page: Page, gameX: number, gameY: number) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) {
    throw new Error("Game canvas is not visible");
  }
  return {
    x: box.x + (box.width * gameX) / 1280,
    y: box.y + (box.height * gameY) / 720
  };
}

async function clickGame(page: Page, gameX: number, gameY: number) {
  const point = await gamePoint(page, gameX, gameY);
  await page.mouse.click(point.x, point.y);
}

async function clickUntilScene(page: Page, gameX: number, gameY: number, name: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickGame(page, gameX, gameY);
    try {
      await page.getByLabel("进度").getByText(name).waitFor({ state: "visible", timeout: 2500 });
      return;
    } catch {
      await page.waitForTimeout(300);
    }
  }
  await expect(page.getByLabel("进度").getByText(name)).toBeVisible();
}

test("saves progress, restores it, and clears it after confirmed reset", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible();
  await page.waitForTimeout(1000);

  await clickUntilScene(page, 588, 548, "拼图");
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await page.keyboard.press("3");
  await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible({
    timeout: 5000
  });

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("1/3 谜题")).toBeVisible();

  await page.getByRole("button", { name: "重新开始" }).click();
  await page.getByRole("button", { name: "确认重置" }).click();
  await expect(page.getByLabel("背包").getByText("背包空")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("0/3 谜题")).toBeVisible();
});

test("recovers from malformed saved data", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("lcw:save:v2", "{not-json");
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("背包").getByText("背包空")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("0/3 谜题")).toBeVisible();
  await expect(
    page.locator(".objective").getByText("在河岸寻找巴当巨石碎片，并修复第一件文物。", {
      exact: true
    })
  ).toBeVisible();
});
