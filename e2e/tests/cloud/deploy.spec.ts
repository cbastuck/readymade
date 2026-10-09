import { test, expect, service } from "../../support/test";
import { NODE_URL } from "../../playwright.cloud.config";

/**
 * Deploying a board, end to end: a real playground, a real runtime server and
 * a real coordinator.
 *
 * The runtime server is on loopback, which a coordinator that dialled would
 * refuse — and this one is told no address at all. The board names a remote;
 * this client resolves the name, the runtime server connects to the
 * coordinator with the ticket it is handed, and the board is built over that
 * connection.
 */

const COORDINATOR = { name: "Local cloud", url: `${NODE_URL}/coordinator` };
const REMOTE = { name: "E2E Node", url: NODE_URL, port: 0 };
const USER_ID = "e2e-user";

/** An unsigned token: the app only reads who it is for and when it expires. */
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

function boardNamed(boardName: string, runtimeId: string, addressing: object) {
  return {
    boardName,
    runtimes: [
      { id: `${runtimeId}-ui`, name: "Browser", type: "browser" },
      { id: runtimeId, name: "Node", type: "rest", ...addressing },
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
}

test.use({ hostConfig: { remotes: [REMOTE] } });

test.beforeEach(async ({ context }) => {
  // Signed in, and with a coordinator configured — both live in storage the
  // desktop shell reads as it boots.
  await context.addInitScript(
    ([token, coordinators]) => {
      window.localStorage.setItem("readymade-id-token", token);
      window.localStorage.setItem("hkp-coordinators", coordinators);
    },
    [sessionToken(), JSON.stringify([COORDINATOR])] as [string, string],
  );
});

test.afterEach(async ({ request }) => {
  // The runtime server outlives the spec, and so would anything left on it.
  const boards = await request.get(
    `${COORDINATOR.url}/users/${USER_ID}/boards`,
  );
  for (const board of (await boards.json()).boards ?? []) {
    await request.delete(
      `${COORDINATOR.url}/users/${USER_ID}/boards/${encodeURIComponent(board.boardName)}`,
    );
  }
  await request.delete(`${NODE_URL}/runtimes`);
});

async function openDeployDialog(page: import("@playwright/test").Page) {
  await page.getByTitle("Deploy to a coordinator").click();
  await page.getByText(COORDINATOR.name, { exact: true }).click();
  await expect(page.getByTestId("deploy-dialog")).toBeVisible();
}

test.describe("deploying a board to a coordinator", () => {
  test("hands over a board whose runtime names a remote, and runs it", async ({
    page,
    request,
    seedBoard,
    openBoard,
  }) => {
    const runtimeId = "e2e-deploy-node";
    const board = boardNamed("e2e-cloud-deploy", runtimeId, {
      remote: REMOTE.name,
    });
    await seedBoard(board.boardName, board);
    await openBoard(board.boardName);
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

    await openDeployDialog(page);

    // Per runtime, before anything is handed over — and naming the remote.
    await expect(page.getByTestId(`deploy-finding-${runtimeId}`)).toHaveText(
      `“Node” is ready on “${REMOTE.name}”`,
    );
    await expect(page.getByTestId(`deploy-finding-${runtimeId}-ui`)).toHaveText(
      "“Browser” runs in the browser, only while the board is open",
    );

    await page.getByRole("button", { name: "Deploy", exact: true }).click();

    // The board is the coordinator's now, and this browser is attached to it.
    await expect(page).toHaveURL(/cloud-boards/);
    await expect(page.getByText(`Deployed to ${COORDINATOR.name}`)).toBeVisible();
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

    // What the coordinator holds: a running board, as authored — the name the
    // board gave, and no address anywhere in it.
    const held = await (
      await request.get(
        `${COORDINATOR.url}/users/${USER_ID}/boards/${board.boardName}`,
      )
    ).json();
    expect(held.status).toBe("running");
    expect(held.errors).toEqual([]);
    const deployed = held.config.runtimes.find(
      (runtime: { id: string }) => runtime.id === runtimeId,
    );
    expect(deployed.remote).toBe(REMOTE.name);
    expect(deployed.url).toBeUndefined();
    expect(JSON.stringify(held)).not.toContain(NODE_URL);

    // The runtime server connected in, and holds the runtime as the
    // coordinator's: it stays when this browser goes.
    const { participants } = await (
      await request.get(
        `${COORDINATOR.url}/users/${USER_ID}/boards/${board.boardName}/participants`,
      )
    ).json();
    expect(participants).toMatchObject([
      { runtimeId, connected: true, server: "node" },
    ]);
    // The board's runtime is not the one this browser built under the same
    // id: it is listed with the server's links, and is still there when the
    // browser has gone and taken its own with it.
    const boardsRuntime = async () =>
      (await (await request.get(`${NODE_URL}/coordinator-links`)).json()).links;
    expect(await boardsRuntime()).toMatchObject([
      { runtimeId, boardName: board.boardName, connected: true, running: true },
    ]);

    await page.close();
    await expect
      .poll(async () =>
        (await request.get(`${NODE_URL}/runtimes/${runtimeId}`)).status(),
      )
      .toBe(404);
    expect(await boardsRuntime()).toMatchObject([
      { runtimeId, boardName: board.boardName, connected: true, running: true },
    ]);
  });

  test("refuses to deploy while a runtime server is away, and lets it be checked again", async ({
    page,
    request,
    seedBoard,
    openBoard,
  }) => {
    const runtimeId = "e2e-away-node";
    const board = boardNamed("e2e-cloud-away", runtimeId, {
      remote: REMOTE.name,
    });
    await seedBoard(board.boardName, board);
    await openBoard(board.boardName);
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

    // The runtime server stops answering what it is.
    await page.route(`${NODE_URL}/runtimes`, (route) =>
      route.request().method() === "GET" ? route.abort() : route.fallback(),
    );
    await openDeployDialog(page);

    await expect(page.getByTestId(`deploy-finding-${runtimeId}`)).toContainText(
      `“Node”: its runtime server on “${REMOTE.name}” is not running`,
    );
    await expect(
      page.getByRole("button", { name: "Deploy", exact: true }),
    ).toBeDisabled();
    // Nothing was handed over: the coordinator has never heard of the board.
    const boards = await (
      await request.get(`${COORDINATOR.url}/users/${USER_ID}/boards`)
    ).json();
    expect(boards.boards).toEqual([]);

    // It comes back, and the same dialog finds it.
    await page.unroute(`${NODE_URL}/runtimes`);
    await page.getByRole("button", { name: "Check again" }).click();

    await expect(page.getByTestId(`deploy-finding-${runtimeId}`)).toHaveText(
      `“Node” is ready on “${REMOTE.name}”`,
    );
    await expect(
      page.getByRole("button", { name: "Deploy", exact: true }),
    ).toBeEnabled();
  });

  test("still deploys a board that gives an address, unchanged", async ({
    page,
    request,
    seedBoard,
    openBoard,
  }) => {
    // Every board that existed before remotes did. A loopback address, which
    // is exactly what a dialling coordinator refused.
    const runtimeId = "e2e-url-node";
    const board = boardNamed("e2e-cloud-url", runtimeId, { url: NODE_URL });
    await seedBoard(board.boardName, board);
    await openBoard(board.boardName);
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

    await openDeployDialog(page);
    await expect(page.getByTestId(`deploy-finding-${runtimeId}`)).toHaveText(
      "“Node” is ready",
    );
    await page.getByRole("button", { name: "Deploy", exact: true }).click();

    await expect(page.getByText(`Deployed to ${COORDINATOR.name}`)).toBeVisible();
    const held = await (
      await request.get(
        `${COORDINATOR.url}/users/${USER_ID}/boards/${board.boardName}`,
      )
    ).json();
    expect(held.status).toBe("running");
  });
});

test.describe("a deployed board whose runtime server goes away", () => {
  test("says which runtime it is waiting for, and runs again when it returns", async ({
    page,
    request,
    seedBoard,
    openBoard,
  }) => {
    const runtimeId = "e2e-drop-node";
    const board = boardNamed("e2e-cloud-drop", runtimeId, {
      remote: REMOTE.name,
    });
    await seedBoard(board.boardName, board);
    await openBoard(board.boardName);
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();
    await openDeployDialog(page);
    await page.getByRole("button", { name: "Deploy", exact: true }).click();
    await expect(page.getByText(`Deployed to ${COORDINATOR.name}`)).toBeVisible();

    // The runtime server leaves the board. The attached browser is told —
    // nothing here reloads or asks.
    await request.delete(
      `${NODE_URL}/coordinator-links/${board.boardName}/${runtimeId}`,
    );

    await expect(
      page.getByText(`Not fully running on ${COORDINATOR.name}`),
    ).toBeVisible();
    await expect(
      page.getByText(`Runtime "${runtimeId}" is not connected`, { exact: false }),
    ).toBeVisible();

    // It is introduced again, as a deploy would, and the board comes back
    // without being deployed again.
    const { tickets } = await (
      await request.post(
        `${COORDINATOR.url}/users/${USER_ID}/boards/${board.boardName}/tickets`,
        { data: { runtimeIds: [runtimeId] } },
      )
    ).json();
    await request.post(`${NODE_URL}/coordinator-links`, {
      data: {
        coordinatorUrl: COORDINATOR.url,
        ticket: tickets[runtimeId],
        boardName: board.boardName,
        runtimeId,
      },
    });

    await expect(page.getByText(`Deployed to ${COORDINATOR.name}`)).toBeVisible();
  });
});

test.describe("opening a board that names a remote", () => {
  test("asks which server an unknown name means, and opens the board there", async ({
    page,
    seedBoard,
    openBoard,
  }) => {
    // What a shipped board says: the kind of server, and no address.
    const runtimeId = "e2e-shared-name-node";
    const board = boardNamed("e2e-cloud-shared-name", runtimeId, {
      remote: "node",
    });
    await seedBoard(board.boardName, board);

    await openBoard(board.boardName);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Which runtime server is “node”?");
    await expect(dialog).toContainText("an hkp-node");
    await dialog
      .getByRole("button", { name: `Use ${REMOTE.name} as node` })
      .click();

    // The board opens on the server the person said, with nothing reloaded.
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();

    // And the answer is kept: the server answers to the name as well as its
    // own, so the next board that says `node` asks nothing.
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              __HKP_FAKE_HOST__: {
                remotes: Array<{ name: string; aliases?: string[] }>;
              };
            }
          ).__HKP_FAKE_HOST__.remotes.map((remote) => ({
            name: remote.name,
            aliases: [...(remote.aliases ?? [])],
          })),
        ),
      )
      .toEqual([{ name: REMOTE.name, aliases: ["node"] }]);
  });

  test("says which remote it wanted when the person names no server for it", async ({
    page,
    seedBoard,
    openBoard,
  }) => {
    const board = boardNamed("e2e-cloud-unknown", "e2e-unknown-node", {
      remote: "Somebody else's server",
    });
    await seedBoard(board.boardName, board);

    await openBoard(board.boardName);

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Do not open the board" })
      .click();

    await expect(
      page.getByText(
        'wants the remote "Somebody else\'s server", which this client does not know',
        { exact: false },
      ),
    ).toBeVisible();
  });
});
