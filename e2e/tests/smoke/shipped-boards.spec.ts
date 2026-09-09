import { test, expect, service } from "../../support/test";
import { browserOnlyBoards } from "../../support/boards";

/**
 * Every shipped browser-only board loads and instantiates the services it
 * declares.
 *
 * The bug this exists for is drift: a board naming a `serviceId` the registry
 * no longer has. The browser runtime treats that as a `console.error` and
 * returns null, so the service is simply missing — the board still opens,
 * looking fine, minus a piece. Nothing else in the test suite would notice,
 * and neither would anyone opening the board casually.
 *
 * So the assertion is per declared uuid rather than "the page rendered": a
 * frame exists for each service the board asks for. That is narrow on purpose.
 * It does not claim these boards *work* — many want a camera, a key or a
 * network — only that every part they are made of still exists.
 */
const boards = browserOnlyBoards();

/**
 * Boards known to be broken, and why. Recorded rather than skipped: a listed
 * board is expected to fail, so the suite stays honest and green, and the day
 * someone fixes one it passes unexpectedly and this entry has to go — which is
 * the only reliable way a known failure ever gets cleaned up.
 */
const KNOWN_BROKEN: Record<string, string> = {
  "reduce-demo-board":
    "hookup.to/service/reduce is not in the browser registry. It was removed " +
    "from registry/Default.ts by 03bb6d6 (Cleanup service stubs), which left " +
    "the board, docs/content/services/reduce.md and the allowedServices entry " +
    "behind. Buffer and GroupBy went the same way and were re-registered; " +
    "Reduce was not. Either re-register it or retire the board and its page.",
};

test.describe("shipped boards", () => {
  test("the sweep found boards to check", () => {
    // A refactor that moves or renames the boards directory would otherwise
    // turn this whole file into zero tests, passing silently.
    expect(boards.length).toBeGreaterThan(40);
  });

  for (const board of boards) {
    test(board.slug, async ({ page, seedBoard, openBoard }) => {
      const known = KNOWN_BROKEN[board.slug];
      if (known) {
        test.fail(true, known);
      }

      // Boards reach for cameras, microphones and external APIs. Refusing is
      // fine — a service that cannot get a device still has to render — but it
      // must be refused rather than left hanging on a permission prompt.
      await page.context().clearPermissions();

      const crashes: string[] = [];
      page.on("pageerror", (error) => crashes.push(String(error)));

      await seedBoard(board.slug, board.descriptor);
      await openBoard(board.slug);

      for (const uuid of board.browserServiceUuids) {
        await expect(
          service(page, uuid),
          `service ${uuid} did not render — its serviceId may no longer be in the registry`,
        ).toBeAttached({ timeout: 15_000 });
      }

      expect(crashes, "uncaught exceptions while loading the board").toEqual([]);
    });
  }
});
