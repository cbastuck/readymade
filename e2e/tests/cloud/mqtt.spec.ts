import fs from "node:fs";
import path from "node:path";

import { test, expect, service } from "../../support/test";
import { NODE_URL } from "../../playwright.cloud.config";
import { cleanupCloud } from "../../support/cloudCleanup";

/**
 * The shipped MQTT Broker demo board, in a real playground against a real
 * runtime server.
 *
 * What only this can show: the two MQTT clients name the broker as
 * `hkp-mount://node/hub`, and it is the playground's coordinator that turns
 * that into the address the runtime assigned. Until it has, neither client
 * dials anything — so both going live means the reference was resolved, and a
 * message arriving under Heard means it went out through one connection,
 * through the broker and back in through the other.
 */

const REMOTE = { name: "E2E Node", url: NODE_URL, port: 0, aliases: ["node"] };
const USER_ID = "e2e-user";

const board = JSON.parse(
  fs.readFileSync(
    path.resolve(import.meta.dirname, "../../../boards/mqtt-broker-demo-board.json"),
    "utf8",
  ),
);

test.use({ hostConfig: { remotes: [REMOTE] } });

test.afterEach(async ({ request }, testInfo) => {
  await cleanupCloud(request, testInfo, `${NODE_URL}/coordinator`, USER_ID, [NODE_URL]);
});

test("a message goes out through the board's broker and comes back", async ({
  page,
  seedBoard,
  openBoard,
}) => {
  await seedBoard(board.boardName, board);
  await openBoard(board.boardName);

  // The broker is on, and says where it is reached.
  const hub = service(page, "hub");
  await expect(hub).toContainText(/ws:\/\/127\.0\.0\.1:\d+\/hosted\/[0-9a-f]{32}/);

  // Both clients found it by reference.
  await expect(service(page, "say")).toContainText("Live", { timeout: 15_000 });
  await expect(service(page, "hear")).toContainText("Live", { timeout: 15_000 });
  await expect(hub).toContainText("2 clients");

  await service(page, "message").getByRole("button", { name: "Inject Data" }).click();

  const heard = service(page, "heard").locator("textarea");
  await expect(heard).toHaveValue(/demo\/greeting/, { timeout: 15_000 });
  await expect(heard).toHaveValue(/hello/);
});

/**
 * The same loop with the clients in the page: the browser's own `mqtt`
 * service, the real client library and a real WebSocket, against the broker
 * on the Node runtime. Nothing here can be stood in for — whether a page can
 * speak MQTT to a mount at all is the question.
 */
const browserClients = {
  boardName: "e2e-mqtt-browser",
  runtimes: [
    { id: "ui", name: "Browser", type: "browser", state: { wrapServices: false } },
    { id: "node", name: "Node", type: "rest", remote: "node", state: { wrapServices: false } },
  ],
  services: {
    ui: [
      {
        uuid: "message",
        serviceId: "hookup.to/service/injector",
        serviceName: "Message",
        state: { recentInjection: { temperature: 21.5 } },
      },
      {
        uuid: "say",
        serviceId: "mqtt",
        serviceName: "Say",
        state: {
          url: "hkp-mount://node/hub",
          mode: "publish",
          topic: "demo/kitchen",
          enabled: true,
        },
      },
      { uuid: "published", serviceId: "hookup.to/service/stopper", serviceName: "Published" },
      {
        uuid: "hear",
        serviceId: "mqtt",
        serviceName: "Hear",
        state: { url: "hkp-mount://node/hub", topics: ["demo/#"], enabled: true },
      },
      { uuid: "heard", serviceId: "hookup.to/service/monitor", serviceName: "Heard" },
    ],
    node: [
      {
        uuid: "hub",
        serviceId: "mqtt-broker",
        serviceName: "Broker",
        state: { bypass: false, topics: [] },
      },
    ],
  },
};

test("the page's own clients reach the broker on the Node runtime", async ({
  page,
  seedBoard,
  openBoard,
}) => {
  await seedBoard(browserClients.boardName, browserClients);
  await openBoard(browserClients.boardName);

  await expect(service(page, "say")).toContainText("Live", { timeout: 15_000 });
  await expect(service(page, "hear")).toContainText("Live", { timeout: 15_000 });
  await expect(service(page, "hub")).toContainText("2 clients");

  await service(page, "message").getByRole("button", { name: "Inject Data" }).click();

  const heard = service(page, "heard").locator("textarea");
  await expect(heard).toHaveValue(/demo\/kitchen/, { timeout: 15_000 });
  await expect(heard).toHaveValue(/21\.5/);
});
