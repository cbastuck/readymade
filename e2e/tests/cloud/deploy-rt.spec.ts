import { test, expect, service } from "../../support/test";
import { NODE_URL, RT_BIN, RT_URL } from "../../playwright.cloud.config";

/**
 * Deploying a board whose runtime lives on hkp-rt, the C++ runtime server.
 *
 * The same journey as deploying to hkp-node, with the other implementation of
 * a runtime server's end: the playground loads the runtime on hkp-rt, the
 * deploy dialog finds that server able to join, and hkp-rt connects to the
 * coordinator with the ticket it is handed.
 *
 * Skipped where hkp-rt has not been built (`hkp-rt/run-tests.sh` builds it).
 */

const COORDINATOR = { name: "Local cloud", url: `${NODE_URL}/coordinator` };
const REMOTE = { name: "E2E Cpp", url: RT_URL, port: 0 };
const USER_ID = "e2e-user";

function sessionToken(): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode({
      sub: USER_ID,
      nickname: "e2e",
      email: "e2e@example.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    "",
  ].join(".");
}

test.skip(!RT_BIN, "hkp-rt has not been built");

// The coordinator's own server is also a runtime server this client keeps, as
// it is wherever one hkp-node plays both parts.
test.use({
  hostConfig: {
    remotes: [REMOTE, { name: "E2E Node", url: NODE_URL, port: 0 }],
  },
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript(
    ([token, coordinators]) => {
      window.localStorage.setItem("readymade-id-token", token);
      window.localStorage.setItem("hkp-coordinators", coordinators);
    },
    [sessionToken(), JSON.stringify([COORDINATOR])] as [string, string],
  );
});

test.afterEach(async ({ request }) => {
  const boards = await request.get(
    `${COORDINATOR.url}/users/${USER_ID}/boards`,
  );
  for (const board of (await boards.json()).boards ?? []) {
    await request.delete(
      `${COORDINATOR.url}/users/${USER_ID}/boards/${encodeURIComponent(board.boardName)}`,
    );
  }
  await request.delete(`${RT_URL}/runtimes`);
});

test("hands over a board whose runtime is on the C++ runtime server, and runs it", async ({
  page,
  request,
  seedBoard,
  openBoard,
}) => {
  const runtimeId = "e2e-deploy-cpp";
  const board = {
    boardName: "e2e-cloud-deploy-cpp",
    runtimes: [
      { id: `${runtimeId}-ui`, name: "Browser", type: "browser" },
      { id: runtimeId, name: "C++", type: "rest", remote: REMOTE.name },
    ],
    services: {
      [`${runtimeId}-ui`]: [],
      [runtimeId]: [
        {
          uuid: `${runtimeId}-monitor`,
          serviceId: "monitor",
          serviceName: "Monitor",
        },
      ],
    },
  };
  await seedBoard(board.boardName, board);
  await openBoard(board.boardName);
  // Loaded on hkp-rt by the playground itself, before anything is deployed.
  await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

  await page.getByTitle("Deploy to a coordinator").click();
  await page.getByText(COORDINATOR.name, { exact: true }).click();
  await expect(page.getByTestId("deploy-dialog")).toBeVisible();
  await expect(page.getByTestId(`deploy-finding-${runtimeId}`)).toHaveText(
    `“C++” is ready on “${REMOTE.name}”`,
  );

  await page.getByRole("button", { name: "Deploy", exact: true }).click();

  await expect(page).toHaveURL(/cloud-boards/);
  await expect(page.getByText(`Deployed to ${COORDINATOR.name}`)).toBeVisible();
  await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

  const held = await (
    await request.get(
      `${COORDINATOR.url}/users/${USER_ID}/boards/${board.boardName}`,
    )
  ).json();
  expect(held.status).toBe("running");
  expect(held.errors).toEqual([]);
  expect(JSON.stringify(held)).not.toContain(RT_URL);

  // hkp-rt connected in, saying what it is, and holds the runtime as the
  // coordinator's: it stays when this browser goes.
  const { participants } = await (
    await request.get(
      `${COORDINATOR.url}/users/${USER_ID}/boards/${board.boardName}/participants`,
    )
  ).json();
  expect(participants).toMatchObject([
    { runtimeId, connected: true, server: "c++" },
  ]);
  const { links } = await (
    await request.get(`${RT_URL}/coordinator-links`)
  ).json();
  expect(links).toMatchObject([
    { runtimeId, boardName: board.boardName, connected: true },
  ]);

  await page.close();
  expect((await request.get(`${RT_URL}/runtimes/${runtimeId}`)).status()).toBe(
    200,
  );
});
