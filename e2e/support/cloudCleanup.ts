import type { APIRequestContext, TestInfo } from "@playwright/test";

/** Attempt every cleanup step, report failures, and preserve the test failure. */
export async function cleanupCloud(
  request: APIRequestContext,
  testInfo: TestInfo,
  coordinator: string,
  user: string,
  servers: string[],
): Promise<void> {
  const errors: string[] = [];
  const attempt = async (label: string, action: () => Promise<void>) => {
    try { await action(); } catch (error) { errors.push(`${label}: ${String(error)}`); }
  };
  await attempt("list boards", async () => {
    const response = await request.get(`${coordinator}/users/${user}/boards`, { timeout: 5_000 });
    if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    for (const board of (await response.json()).boards ?? []) {
      await attempt(`delete board ${board.boardName}`, async () => {
        const deleted = await request.delete(`${coordinator}/users/${user}/boards/${encodeURIComponent(board.boardName)}`, { timeout: 5_000 });
        if (!deleted.ok()) throw new Error(`HTTP ${deleted.status()}`);
      });
    }
  });
  await attempt("verify boards removed", async () => {
    const response = await request.get(`${coordinator}/users/${user}/boards`, { timeout: 5_000 });
    if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    if ((await response.json()).boards.length) throw new Error("Boards remain after cleanup");
  });
  for (const server of servers) await attempt(`clear runtimes on ${server}`, async () => {
    const response = await request.delete(`${server}/runtimes`, { timeout: 5_000 });
    if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
    const remaining = await request.get(`${server}/runtimes`, { timeout: 5_000 });
    if (!remaining.ok()) throw new Error(`Verification HTTP ${remaining.status()}`);
    const body = await remaining.json();
    if (body.runtimes.length) throw new Error("Runtimes remain after cleanup");
  });
  if (errors.length) {
    await testInfo.attach("cleanup-failures", { body: errors.join("\n"), contentType: "text/plain" });
    if (testInfo.status === "passed") throw new Error(`Cloud cleanup failed: ${errors.join("; ")}`);
  }
}
