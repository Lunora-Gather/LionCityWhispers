import { expect, test } from "@playwright/test";

test("remaps the interaction key through settings and uses it in the world", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: /交互 Space/ }).click();
  await page.keyboard.press("KeyE");
  await expect(page.getByRole("button", { name: /交互 E/ })).toBeVisible();

  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("进度").getByText("河岸")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("button", { name: /交互 E/ })).toBeVisible();
  await page.getByRole("button", { name: "关闭设置" }).click();
  await expect(page.getByRole("dialog", { name: "设置" })).toBeHidden();
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
  });
  await page.waitForTimeout(800);

  await page.keyboard.press("KeyE");
  await expect(page.getByLabel("进度").getByText("对话")).toBeVisible({ timeout: 5000 });
});

test("swaps duplicate world bindings without changing rhythm bindings", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();

  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: /交互 Space/ }).click();
  await page.keyboard.press("KeyA");

  await expect(page.getByRole("button", { name: /交互 A/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /左移 Space/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /节奏 1 A/ })).toBeVisible();
  await expect(page.getByText("交互 已设为 A，并与 左移 交换键位。")).toBeVisible();
});

test("uses custom rhythm lane bindings during the ritual", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "lcw:save:v2",
      JSON.stringify({
        version: 2,
        inventoryIds: ["badang-stone", "rune-plaque", "harbor-seal"],
        flags: { jigsaw: true, runes: true, lock: true, rhythm: false },
        museum: { placements: {}, visitors: 0, complete: false },
        dialogue: "ready",
        easyMode: true,
        settings: {
          muted: true,
          volume: 0.5,
          effectsVolume: 0.5,
          ambientVolume: 0.3,
          reduceMotion: true,
          locale: "zh",
          bindings: {
            moveUp: "KeyW",
            moveDown: "KeyS",
            moveLeft: "KeyA",
            moveRight: "KeyD",
            action: "Space",
            rhythm: ["KeyJ", "KeyK", "KeyL", "Semicolon"]
          }
        }
      })
    );
  });

  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("lcw:chapter", { detail: "RhythmScene" }));
  });
  await expect(page.getByLabel("进度").getByText("仪式")).toBeVisible({ timeout: 5000 });
  await expect(page.locator(".rhythm-controls button")).toHaveText(["J", "K", "L", ";"]);
  await page.evaluate(() => {
    const codes = ["KeyJ", "KeyK", "KeyL", "Semicolon"];
    for (let time = 900; time <= 11200; time += 120) {
      for (const code of codes) {
        window.setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
        }, time);
      }
    }
  });
  await expect(page.getByLabel("背包").getByText("灵界清音")).toBeVisible({
    timeout: 16000
  });
});
