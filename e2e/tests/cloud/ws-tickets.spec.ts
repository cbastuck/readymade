import type { Page, Request, WebSocket } from "@playwright/test";

import { test, expect, service } from "../../support/test";
import { NODE_URL, RT_BIN, RT_URL } from "../../playwright.cloud.config";
import { cleanupCloud } from "../../support/cloudCleanup";

/**
 * A runtime's notification socket is opened with a ticket, never with the
 * person's token in its address (hkp-frontend `runtime/rest/wsTicket.ts`).
 *
 * Signed in, the client buys a ticket from every runtime server it opens a
 * socket to — `POST /ws-tickets`, the token in the `Authorization` header — and
 * opens the socket with `?ticket=`. The servers here run without
 * authentication, so this proves the client's half and that each server issues
 * and redeems tickets; that a server verifies a real token is left to its own
 * tests.
 *
 * hkp-rt joins where it has been built (`hkp-rt/run-tests.sh` builds it).
 */

const USER_ID = "e2e-ticket-user";
const COORDINATOR_URL = `${NODE_URL}/coordinator`;

const SERVERS = [
  { name: "E2E Node", url: NODE_URL, runtimeId: "e2e-ticket-node" },
  ...(RT_BIN
    ? [{ name: "E2E Cpp", url: RT_URL, runtimeId: "e2e-ticket-cpp" }]
    : []),
];
type Server = (typeof SERVERS)[number];

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

const TOKEN = sessionToken();

const BOARD = {
  boardName: "e2e-ws-tickets",
  runtimes: SERVERS.map(({ name, runtimeId }) => ({
    id: runtimeId,
    name,
    type: "rest",
    remote: name,
  })),
  services: Object.fromEntries(
    SERVERS.map(({ runtimeId }) => [
      runtimeId,
      [
        {
          uuid: `${runtimeId}-monitor`,
          serviceId: "monitor",
          serviceName: "Monitor",
        },
      ],
    ]),
  ),
};

test.use({
  hostConfig: {
    remotes: SERVERS.map(({ name, url }) => ({ name, url, port: 0 })),
  },
});

test.beforeEach(async ({ context }) => {
  await context.addInitScript((token) => {
    if (!/^https?:$/.test(location.protocol) || window !== window.top) return;
    window.localStorage.setItem("readymade-id-token", token);
  }, TOKEN);
});

test.afterEach(async ({ request }, testInfo) => {
  await cleanupCloud(
    request,
    testInfo,
    COORDINATOR_URL,
    USER_ID,
    SERVERS.map(({ url }) => url),
  );
});

/** Every ticket request and socket the page makes, and every address it uses. */
function observe(page: Page) {
  const seen = {
    tickets: [] as Request[],
    sockets: [] as WebSocket[],
    addresses: [] as string[],
  };
  page.on("request", (request) => {
    seen.addresses.push(request.url());
    if (new URL(request.url()).pathname === "/ws-tickets") {
      seen.tickets.push(request);
    }
  });
  page.on("websocket", (socket) => {
    seen.addresses.push(socket.url());
    seen.sockets.push(socket);
  });
  return seen;
}

type Seen = ReturnType<typeof observe>;

const onServer = (address: string, server: Server) =>
  new URL(address).port === new URL(server.url).port;

/**
 * The sockets the page opened to `server`, each with a ticket that server
 * issued for this person's token — and nothing else in their address.
 */
async function ticketedSockets(seen: Seen, server: Server) {
  await expect
    .poll(() => seen.sockets.filter((s) => onServer(s.url(), server)).length, {
      message: `a socket to ${server.name}`,
    })
    .toBeGreaterThan(0);

  const issued: string[] = [];
  for (const request of seen.tickets.filter((r) => onServer(r.url(), server))) {
    expect(request.method()).toBe("POST");
    expect(await request.headerValue("authorization")).toBe(`Bearer ${TOKEN}`);
    const response = await request.response();
    expect(response?.status(), `${server.name} issues a ticket`).toBe(200);
    issued.push((await response!.json()).ticket);
  }

  const sockets = seen.sockets.filter((s) => onServer(s.url(), server));
  const tickets = sockets.map((socket) => {
    const query = new URL(socket.url()).searchParams;
    expect([...query.keys()], socket.url()).toEqual(["ticket"]);
    return query.get("ticket")!;
  });
  for (const ticket of tickets) {
    expect(issued, `${server.name}'s socket carries a ticket it issued`).toContain(ticket);
  }
  expect(new Set(tickets).size, "a ticket per socket").toBe(tickets.length);
  return { sockets, tickets };
}

/** The server let the socket in: what a run says arrives on it. */
async function expectAdmitted(
  socket: WebSocket,
  server: Server,
  request: import("@playwright/test").APIRequestContext,
) {
  expect(socket.isClosed(), `${server.name} kept the socket open`).toBe(false);
  const said = socket.waitForEvent("framereceived");
  const run = await request.post(`${server.url}/runtimes/${server.runtimeId}`, {
    data: {},
  });
  expect(run.ok(), `${server.name} runs the runtime`).toBe(true);
  await said;
}

test("opens every runtime socket with a fresh ticket, never with the token", async ({
  page,
  request,
  seedBoard,
  openBoard,
}) => {
  const seen = observe(page);
  await seedBoard(BOARD.boardName, BOARD);
  await openBoard(BOARD.boardName);
  for (const { runtimeId } of SERVERS) {
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();
  }

  const first = new Map<string, string[]>();
  for (const server of SERVERS) {
    const { sockets, tickets } = await ticketedSockets(seen, server);
    await expectAdmitted(sockets[sockets.length - 1], server, request);
    first.set(server.name, tickets);
  }

  // Opened again, every socket buys a new ticket: one is good for one socket.
  seen.tickets.length = 0;
  seen.sockets.length = 0;
  await openBoard(BOARD.boardName);
  for (const { runtimeId } of SERVERS) {
    await expect(service(page, `${runtimeId}-monitor`)).toBeVisible();
  }
  for (const server of SERVERS) {
    const { tickets } = await ticketedSockets(seen, server);
    for (const ticket of tickets) {
      expect(first.get(server.name)).not.toContain(ticket);
    }
  }

  // The token rode in a header only, never in an address.
  expect(seen.addresses.filter((address) => address.includes("access_token"))).toEqual([]);
  expect(seen.addresses.filter((address) => address.includes(TOKEN))).toEqual([]);
});
