import { expect, type Page, test } from "@playwright/test";

async function gamePoint(page: Page, gameX: number, gameY: number) {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
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

async function dragGame(page: Page, fromX: number, fromY: number, toX: number, toY: number) {
  const from = await gamePoint(page, fromX, fromY);
  const to = await gamePoint(page, toX, toY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function expectScene(page: Page, name: string) {
  await expect(page.getByLabel("进度").getByText(name)).toBeVisible({ timeout: 8000 });
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
  await expectScene(page, name);
}

async function waitForGameSettled(page: Page) {
  await page.waitForFunction(() => {
    const box = document.querySelector("canvas")?.getBoundingClientRect();
    return Boolean(box && box.width > 600 && box.height > 300);
  });
  await page.waitForTimeout(1000);
}

test("plays through the full prototype loop", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 588, 548, "拼图");
  await dragGame(page, 260, 500, 520, 345);
  await dragGame(page, 640, 514, 640, 335);
  await dragGame(page, 980, 500, 760, 345);
  await expect(page.getByLabel("背包").getByText("巴当巨石碎片")).toBeVisible({
    timeout: 4000
  });
  await expect(page.getByLabel("进度").getByText("1/3 谜题")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 840, 448, "符文");
  for (const point of [
    [550, 430],
    [910, 430],
    [370, 430],
    [730, 430]
  ]) {
    await clickGame(page, point[0], point[1]);
  }
  await expect(page.getByLabel("背包").getByText("狮门铭牌")).toBeVisible({
    timeout: 4000
  });
  await expect(page.getByLabel("进度").getByText("2/3 谜题")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 1010, 570, "机关");
  for (const point of [
    [355, 472],
    [925, 472],
    [545, 472],
    [735, 472]
  ]) {
    await clickGame(page, point[0], point[1]);
  }
  await expect(page.getByLabel("背包").getByText("海门钥纹")).toBeVisible({
    timeout: 4000
  });
  await expect(page.getByLabel("进度").getByText("3/3 谜题")).toBeVisible();
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 1092, 282, "仪式");
  await page.evaluate(() => {
    for (let time = 900; time <= 11200; time += 120) {
      for (let lane = 0; lane < 4; lane += 1) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("lcw:rhythm-hit", { detail: lane }));
        }, time);
      }
    }
  });
  await expect(page.getByLabel("背包").getByText("灵界清音")).toBeVisible({
    timeout: 16000
  });
  await expectScene(page, "河岸");
  await waitForGameSettled(page);

  await clickUntilScene(page, 185, 330, "博物馆");
  await dragGame(page, 276, 604, 334, 382);
  await dragGame(page, 466, 604, 545, 382);
  await dragGame(page, 656, 604, 758, 382);
  await dragGame(page, 846, 604, 968, 382);
  await expect(page.getByText("展览完成")).toBeVisible({ timeout: 4000 });
  await expect(page.getByLabel("进度").getByText("200 游客")).toBeVisible();

  expect(errors).toEqual([]);
});
