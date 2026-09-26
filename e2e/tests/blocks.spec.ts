import fs from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect } from "../support/test";

/**
 * Blocks on the running board: a use shows its block and params, its inside is
 * out of reach, and what saving writes is the use — with the params set on it
 * since, or, once detached, the ordinary copy it became.
 *
 * Web only: the browser runtime is the one hosting the pipeline in the page.
 */

test.skip(({ profile }) => profile !== "web", "a browser-hosted pipeline");

const BOARD_NAME = "Blocks e2e";

const board = {
  boardName: BOARD_NAME,
  runtimes: [{ id: "rt", name: "Browser", type: "browser", state: {} }],
  services: {
    rt: [
      {
        uuid: "bar",
        serviceId: "sub-service",
        serviceName: "Bar",
        state: {
          pipeline: [
            { block: "note", instanceId: "first", params: { trigger: "kick" } },
            { block: "note", instanceId: "second" },
          ],
        },
      },
    ],
  },
  blocks: [
    {
      id: "hit",
      name: "Hit",
      serviceId: "hookup.to/service/sound",
      params: { trigger: "kick", volume: 0.8 },
      state: {
        generator: "drums",
        trigger: "{{param.trigger}}",
        volume: "{{param.volume}}",
      },
    },
    {
      id: "note",
      name: "Note",
      serviceId: "sub-service",
      params: { trigger: "hihat", volume: 0.5, ms: 100 },
      state: {
        scope: { slots: "inherit" },
        pipeline: [
          {
            block: "hit",
            instanceId: "hit",
            params: {
              trigger: "{{param.trigger}}",
              volume: "{{param.volume}}",
            },
          },
          {
            serviceId: "hookup.to/service/timer",
            instanceId: "wait",
            state: {
              periodic: false,
              oneShotDelay: "{{param.ms}}",
              oneShotDelayUnit: "ms",
            },
          },
        ],
      },
    },
  ],
};

async function openBar(page: Page) {
  await expect(page.locator("#service-frame-bar")).toBeVisible({
    timeout: 20_000,
  });
  await page
    .getByRole("button", { name: "Show content inline" })
    .first()
    .click();
}

async function save(page: Page): Promise<any> {
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+s" : "Control+s",
  );
  await expect
    .poll(() =>
      page.evaluate(
        (key) => localStorage.getItem(key),
        `hkp-playground-${BOARD_NAME}`,
      ),
    )
    .not.toBeNull();
  const item = JSON.parse(
    (await page.evaluate(
      (key) => localStorage.getItem(key),
      `hkp-playground-${BOARD_NAME}`,
    ))!,
  );
  return item.source ? JSON.parse(item.source) : item;
}

const uses = (page: Page, block: string) =>
  page.locator(`[data-block-use="${block}"]`);

test.describe("a use on the running board", () => {
  test.beforeEach(async ({ seedBoard, openBoard, page }) => {
    await seedBoard("blocks-e2e", board);
    await openBoard("blocks-e2e");
    await openBar(page);
  });

  test("a use shows its block and params, and its inside is out of reach", async ({
    page,
  }) => {
    await expect(uses(page, "note")).toHaveCount(2);
    const first = uses(page, "note").first();
    await expect(first.getByText("Block · Note")).toBeVisible();
    await expect(first.getByLabel("trigger")).toHaveValue("kick");
    // The default fills in what the use does not say.
    await expect(first.getByLabel("volume")).toHaveValue("0.5");
    // Its panel is not shown, and out of reach should it be.
    const panel = first.locator(".hkp-block-locked").first();
    await expect(panel).toBeHidden();
    await expect(panel).toHaveAttribute("inert", "");
  });

  test("params changed on a use are what the board saves", async ({ page }) => {
    const volume = uses(page, "note").first().getByLabel("volume");
    await volume.fill("0.25");
    await volume.press("Enter");

    // The running use took them: its hit, one level in, now plays at 25%.
    // The bar's: the panel's own is hidden with the rest of the panel.
    await uses(page, "note")
      .first()
      .getByRole("button", { name: "Open Note as its own level" })
      .first()
      .click();
    await expect(uses(page, "hit").last().getByLabel("volume")).toHaveValue(
      "0.25",
    );
    // And the service itself, not only what linkage holds for it: the Sound
    // panel inside — mounted, though a use shows only its bar — reports what
    // it was configured with.
    await expect(
      uses(page, "hit").last().locator(".hkp-block-locked"),
    ).toContainText("25%");

    const saved = await save(page);
    expect(saved.services.rt[0].state.pipeline[0]).toEqual({
      block: "note",
      instanceId: "first",
      params: { trigger: "kick", volume: 0.25 },
    });
    expect(saved.blocks.map((entry: { id: string }) => entry.id)).toEqual([
      "hit",
      "note",
    ]);
  });

  test("a detached use saves as an ordinary copy, with the uses inside it still uses", async ({
    page,
  }) => {
    await uses(page, "note")
      .nth(1)
      .getByRole("button", { name: "Detach from block" })
      .click();
    await expect(uses(page, "note")).toHaveCount(1);

    const saved = await save(page);
    const [first, second] = saved.services.rt[0].state.pipeline;
    expect(first).toEqual({
      block: "note",
      instanceId: "first",
      params: { trigger: "kick" },
    });
    expect(second).toMatchObject({
      serviceId: "sub-service",
      instanceId: "second",
    });
    expect(second.state.pipeline[0]).toEqual({
      block: "hit",
      instanceId: "hit",
      params: { trigger: "hihat", volume: 0.5 },
    });
    expect(second.state.pipeline[1]).toMatchObject({
      serviceId: "hookup.to/service/timer",
      state: { oneShotDelay: 100 },
    });
  });

  test("an edit applied to the block keeps its parameters, and a changed param-driven field stays the use's", async ({
    page,
  }) => {
    const first = uses(page, "note").first();
    await first.getByRole("button", { name: "Edit block" }).click();
    await expect(page.getByText("Editing block · Note")).toBeVisible();
    // Only one working copy at a time.
    await expect(page.getByRole("button", { name: "Edit block" })).toHaveCount(0);

    await first.getByRole("button", { name: "Open Note as its own level" }).first().click();
    const wait = page.locator("#service-frame-wait").locator("input[type=range]").locator("visible=true").first();
    await wait.focus();
    await page.keyboard.press("ArrowRight");
    // And one that is not param-driven: the block's own, for every use.
    const power = page
      .locator("#service-frame-wait")
      .getByRole("button", { name: "Disable service" })
      .locator("visible=true")
      .first();
    await power.click();
    const disabled = (where: ReturnType<Page["locator"]>) =>
      where.getByRole("button", { name: "Enable service" }).locator("visible=true").first();
    await expect(disabled(page.locator("#service-frame-wait"))).toBeVisible();

    // The level's own: the bar on the level below is behind this one.
    await page.getByRole("button", { name: "Apply to the block" }).last().click();
    await expect(page.getByText("Editing block · Note")).toHaveCount(0);

    const saved = await save(page);
    const [written] = saved.services.rt[0].state.pipeline;
    expect(written).toMatchObject({ block: "note", instanceId: "first" });
    expect(written.params.trigger).toBe("kick");
    expect(written.params.ms).not.toBe(100);
    const definition = saved.blocks.find((entry: { id: string }) => entry.id === "note");
    expect(definition.state.pipeline[1].state.oneShotDelay).toBe("{{param.ms}}");
    expect(definition.state.pipeline[1].state.bypass).toBe(true);
    // The other use took the block's change: its timer is off too.
    // Applying re-instantiated the working copy, which closed the level on it.
    await expect(page.getByText("Editing block · Note")).toHaveCount(0);
    await uses(page, "note")
      .nth(1)
      .getByRole("button", { name: "Open Note as its own level" })
      .first()
      .click();
    await expect(disabled(page.locator("#service-frame-wait"))).toBeVisible();
    expect(definition.state.pipeline[0]).toEqual(board.blocks[1].state.pipeline[0]);
  });
});

test.describe("making a block", () => {
  const plain = {
    boardName: "Blocks make e2e",
    runtimes: [{ id: "rt", name: "Browser", type: "browser", state: {} }],
    services: {
      rt: [
        {
          uuid: "pair",
          serviceId: "sub-service",
          serviceName: "Pair",
          state: {
            pipeline: [
              {
                serviceId: "hookup.to/service/sound",
                instanceId: "hit",
                state: { generator: "drums", trigger: "kick" },
              },
            ],
          },
        },
      ],
    },
  };

  test.beforeEach(async ({ seedBoard, openBoard, page }) => {
    await seedBoard("blocks-make-e2e", plain);
    await openBoard("blocks-make-e2e");
    await expect(page.locator("#service-frame-pair")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("a sub-service made a block is saved as its first use, and is added again from the palette", async ({
    page,
  }) => {
    await page
      .locator("#service-frame-pair")
      .getByRole("button", { name: "Service options" })
      .click();
    await page.getByRole("menuitem", { name: "Make block" }).click();
    await expect(uses(page, "pair")).toHaveCount(1);

    const card = page.locator(".hkp-palette-card", { hasText: "Pair" }).first();
    await card.dragTo(page.locator(".hkp-runtime-container").first());
    await expect(uses(page, "pair")).toHaveCount(2);

    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+s" : "Control+s",
    );
    const key = "hkp-playground-Blocks make e2e";
    await expect
      .poll(() => page.evaluate((k) => localStorage.getItem(k), key))
      .not.toBeNull();
    const item = JSON.parse(
      (await page.evaluate((k) => localStorage.getItem(k), key))!,
    );
    const saved = JSON.parse(item.source ?? JSON.stringify(item));
    expect(saved.blocks.map((entry: { id: string }) => entry.id)).toEqual([
      "pair",
    ]);
    expect(saved.blocks[0]).toMatchObject({
      name: "Pair",
      serviceId: "sub-service",
    });
    expect(saved.services.rt).toEqual([
      { block: "pair", uuid: "pair" },
      { block: "pair", uuid: expect.any(String) },
    ]);
  });
});

test.describe("inside a Switch case", () => {
  const demo = JSON.parse(
    fs.readFileSync(new URL("../../boards/nested-rhythm-demo-board.json", import.meta.url), "utf8"),
  );

  test("a Note's volume, stepped with the arrows, reaches the Sound panel below it", async ({
    page,
    seedBoard,
    openBoard,
  }) => {
    // Panels three levels into a Switch case used to fall back to proxies
    // reading a stored copy, so a change made anywhere but on the knob itself
    // never showed on it.
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedBoard("nested-rhythm", demo);
    await openBoard("nested-rhythm");
    await expect(page.locator("#service-frame-groove")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Show the board controls" }).click();
    await page.getByRole("button", { name: "Show the board only" }).click();
    for (const level of ["Groove", "Patterns · case 2", "Four on the floor", "Beat 2"]) {
      await page.getByRole("button", { name: `Open ${level} as its own level` }).first().click();
    }
    const snare = uses(page, "note").filter({ hasText: "Snare" }).first();
    await expect(snare.getByLabel("volume")).toHaveValue("0.6");
    await snare.getByLabel("volume").focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("ArrowUp");
    }
    // No Enter, no blur: a number is taken once it stops changing.
    await expect(snare.getByLabel("volume")).toHaveValue("0.9");

    // The Sound is inside the Note, a level further in.
    await page.getByRole("button", { name: "Open Snare as its own level" }).first().click();
    await expect(page.getByText("90%")).toBeVisible();
  });
});
