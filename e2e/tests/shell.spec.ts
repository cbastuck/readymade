import { test, expect } from "../support/test";

/**
 * Each host mounts the same shell and tells it how to look. Every one of them
 * asks for the playground theme — the website's pages, the desktop app and the
 * mobile app alike — so a profile showing anything else is a profile rendering
 * something nobody ships, and the suite would be reporting on a screen no user
 * ever sees.
 *
 * This caught exactly that: `hkp-frontend/src/main.tsx` named no theme, so the
 * standalone app fell back to the legacy `default` — the only place it was
 * still reachable.
 */
test("boots in the theme its host asks for", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "playground");
});
