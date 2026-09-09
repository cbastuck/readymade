import { test, expect, service } from "../support/test";
import timerMonitor from "../fixtures/boards/timer-monitor.json" with { type: "json" };

/**
 * The load-bearing check: a board restores, its services render, and the
 * engine actually runs — a Timer's ticks reach a Monitor downstream.
 *
 * Browser runtime only, so it needs no network and gives the same answer on
 * every host profile. Whatever else the suite grows into, if this fails the
 * app is broken on that target.
 */
test.describe("a board runs", () => {
  test.beforeEach(async ({ seedBoard }) => {
    await seedBoard(timerMonitor.boardName, timerMonitor);
  });

  test("restores its services and passes data down the pipeline", async ({
    page,
    openBoard,
  }) => {
    await openBoard(timerMonitor.boardName);

    await expect(service(page, "e2e-timer")).toBeVisible();
    await expect(service(page, "e2e-monitor")).toBeVisible();

    // The Timer emits `{ triggerCount: n }` each second; the Monitor renders
    // whatever reaches it into its textarea. Seeing the field there means the
    // whole push path ran, not just that two panels mounted.
    const output = service(page, "e2e-monitor").locator("textarea");
    await expect(output).toHaveValue(/triggerCount/, { timeout: 15_000 });
  });
});
