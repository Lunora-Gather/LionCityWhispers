const { Builder, Key } = require("selenium-webdriver");
const { Pointer } = require("selenium-webdriver/lib/input");
const safari = require("selenium-webdriver/safari.js");
const { mkdir, writeFile } = require("node:fs/promises");
const { dirname } = require("node:path");
const { readFileSync } = require("node:fs");
const { setTimeout: delay } = require("node:timers/promises");

const testingLibrary = readFileSync(
  require.resolve("@testing-library/dom/dist/@testing-library/dom.umd.min.js"),
  "utf8"
);

function toWebDriverKey(key) {
  const special = {
    Space: Key.SPACE, Escape: Key.ESCAPE, Tab: Key.TAB, Enter: Key.ENTER,
    ArrowDown: Key.ARROW_DOWN, ArrowUp: Key.ARROW_UP, ArrowRight: Key.ARROW_RIGHT, ArrowLeft: Key.ARROW_LEFT
  };
  return special[key] ?? key.replace(/^Key([A-Z])$/, (_, letter) => letter.toLowerCase());
}

async function launchSafari(game, { viewport, mobile }) {
  const device = mobile ? process.env.SAFARI_IOS_UDID : undefined;
  if (mobile && !device) throw new Error("SAFARI_IOS_UDID is required for the native iOS Safari cases");
  async function connect() {
    const service = new safari.ServiceBuilder("/usr/bin/safaridriver").build();
    try {
      const builder = new Builder().disableEnvironmentOverrides().usingServer(await service.start()).forBrowser("safari");
      if (device) builder.withCapabilities({
        browserName: "safari", platformName: "iOS",
        "safari:useSimulator": true, "safari:deviceUDID": device
      });
      return { driver: await builder.build(), service };
    } catch (error) {
      await service.kill();
      throw error;
    }
  }
  const { driver, service } = await connect().catch(async error => {
    if (!/session timed out while connecting|Server terminated early/i.test(error.message)) throw error;
    await delay(1000);
    return connect();
  });
  let lastPointer = {x: 0, y: 0};
  const finger = new Pointer("ios-finger", Pointer.Type.TOUCH);
  const keyboard = {
    down: key => driver.actions().keyDown(toWebDriverKey(key)).perform(),
    up: key => driver.actions().keyUp(toWebDriverKey(key)).perform(),
    press(key) {
      const actions = driver.actions();
      if (key === "ControlOrMeta+v") {
        return actions.keyDown(Key.COMMAND).keyDown("v").keyUp("v").keyUp(Key.COMMAND).perform();
      }
      return actions.sendKeys(toWebDriverKey(key)).perform();
    }
  };
  async function preparePage() {
    await driver.executeScript(testingLibrary);
  }
  function selector(steps) {
    async function all() {
      return driver.executeScript(queries => {
        let nodes = [document.body];
        for (const {type, value, flags, options, role} of queries) {
          const search = flags === null ? value : new RegExp(value, flags);
          if (type === "first") {
            nodes = nodes.slice(0, 1);
            continue;
          }
          nodes = nodes.flatMap(root => {
            switch (type) {
              case "css": return [...(root === document.body ? document : root).querySelectorAll(search)];
              case "label": return TestingLibraryDom.queryAllByLabelText(root, search, options);
              case "text": return TestingLibraryDom.queryAllByText(root, search, options);
              case "title": return TestingLibraryDom.queryAllByTitle(root, search, options);
              case "placeholder": return TestingLibraryDom.queryAllByPlaceholderText(root, search, options);
              case "role": {
                const name = typeof search === "string" && !options.exact
                  ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
                  : search;
                return TestingLibraryDom.queryAllByRole(root, role, name == null ? options : {...options, name});
              }
            }
          });
        }
        return nodes;
      }, steps);
    }
    const first = () => driver.wait(async () => (await all())[0], 15000, JSON.stringify(steps));
    const evaluate = async (fn, ...args) => driver.executeScript(fn, await first(), ...args);
    async function isVisible() {
      try {
        const node = (await all())[0];
        return Boolean(node && await driver.executeScript(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
        }, node));
      } catch (error) {
        if (error.name === "StaleElementReferenceError") return false;
        throw error;
      }
    }
    return {
      ...queries(steps),
      first: () => selector([...steps, {type: "first", value: "", flags: null}]),
      count: async () => (await all()).length,
      evaluate, isVisible,
      async waitFor({state = "visible", timeout = 15000} = {}) {
        if (!["visible", "hidden"].includes(state)) throw new Error("Unsupported Safari wait state: " + state);
        await driver.wait(async () => await isVisible() === (state === "visible"), timeout, JSON.stringify(steps));
      },
      inputValue: async () => (await first()).getProperty("value"),
      textContent: async () => (await all())[0]?.getProperty("textContent"),
      allTextContents: async () => Promise.all((await all()).map(el => el.getProperty("textContent"))),
      isChecked: async () => Boolean(await (await all())[0]?.isSelected()),
      async boundingBox() {
        if (!await isVisible()) return null;
        return evaluate(el => el.getBoundingClientRect().toJSON());
      },
      focus: () => evaluate(el => el.focus()),
      async press(key) {
        await evaluate(el => el.focus());
        await keyboard.press(key);
      },
      async click() {
        const node = await first();
        await driver.executeScript(el => el.scrollIntoView({block:"center", behavior:"instant"}), node);
        if (!mobile) {
          await node.click();
          return;
        }
        const point = await driver.wait(() => driver.executeScript(el => {
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          if (!el.contains(document.elementFromPoint(x, y))) return null;
          return {
            x: Math.round(x - (visualViewport?.offsetLeft ?? 0)),
            y: Math.round(y - (visualViewport?.offsetTop ?? 0))
          };
        }, node), 5000, "The iOS tap target must be unobstructed");
        await driver.actions().insert(
          finger, finger.move({...point, duration: 0}), finger.press(), finger.release()
        ).perform();
      },
      async check() {
        const node = await first();
        if (await node.isSelected()) return;
        await driver.executeScript(el => el.scrollIntoView({block:"center",behavior:"instant"}), node);
        await node.click();
        if (!await node.isSelected()) {
          await driver.executeScript(el => el.focus(), node);
          await node.sendKeys(Key.SPACE);
        }
        await driver.wait(() => node.isSelected(), 5000, "Checkbox did not become checked");
      },
      fill: value => evaluate((el, nextValue) => {
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, nextValue);
        el.dispatchEvent(new Event("input", {bubbles: true}));
        el.dispatchEvent(new Event("change", {bubbles: true}));
      }, value),
      screenshot: async () => Buffer.from(await (await first()).takeScreenshot(true), "base64")
    };
  }
  function queries(steps) {
    function add(type, name, options = {}, role) {
      return selector([...steps, {type, value: name instanceof RegExp ? name.source : name ?? null,
        flags: name instanceof RegExp ? name.flags : null, options, role}]);
    }
    return {
      locator: css => add("css", css),
      getByLabel: (name, options) => add("label", name, options),
      getByText: (name, options = {}) => add("text", name, {exact: false, ...options}),
      getByTitle: (name, options) => add("title", name, options),
      getByPlaceholder: (name, options) => add("placeholder", name, options),
      getByRole: (role, {name, ...options} = {}) => add("role", name, options, role)
    };
  }
  const mouse = {
    async move(x, y, {steps = 1} = {}) {
      const actions = driver.actions();
      for (let step = 1; step <= steps; step++) {
        actions.move({x: Math.round(lastPointer.x + (x-lastPointer.x)*step/steps),
          y: Math.round(lastPointer.y + (y-lastPointer.y)*step/steps), duration: 18});
      }
      await actions.perform();
      lastPointer = {x, y};
    },
    async click(x,y) {await mouse.move(x,y); await driver.actions().click().perform();},
    down: () => driver.actions().press().perform(),
    up: () => driver.actions().release().perform()
  };
  const page = {
    ...queries([]), keyboard, mouse,
    async goto(value) {
      await driver.get(new URL(value, game.origin).href);
      await preparePage();
      if (mobile) {
        await driver.wait(() => driver.executeScript(isLandscape =>
          navigator.maxTouchPoints > 0 && matchMedia("(orientation: landscape)").matches === isLandscape,
        viewport.width > viewport.height), 10000, "Expected touch support and the requested Simulator orientation");
      }
    },
    async reload() {
      await driver.navigate().refresh();
      await preparePage();
    },
    addInitScript: fn => {game.scripts.push(fn);},
    setViewportSize: async ({width,height}) => {
      if (mobile) throw new Error("Set mobile viewport on the Simulator device");
      const [dx, dy] = await driver.executeScript("return [outerWidth-innerWidth,outerHeight-innerHeight]");
      await driver.manage().window().setRect({x:0,y:0,width:width+dx,height:height+dy});
    },
    evaluate: (fn, ...args) => driver.executeScript(fn, ...args),
    waitForFunction: fn => driver.wait(() => driver.executeScript(fn), 15000),
    waitForTimeout: delay,
    async screenshot(options) {
      const image = Buffer.from(await driver.takeScreenshot(), "base64");
      if (options?.path) {
        await mkdir(dirname(options.path), { recursive: true });
        await writeFile(options.path, image);
      }
      return image;
    },
    async close() {try {await driver.quit();} finally {await service.kill();}}
  };
  if (!mobile) await page.setViewportSize(viewport);
  return page;
}

module.exports = {launchSafari};
