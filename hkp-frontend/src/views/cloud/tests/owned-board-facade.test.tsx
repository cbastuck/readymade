import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A deployed board opened by its owner.
 *
 * Deployed, a board is something to use rather than to build: structural edits
 * are refused, and what is left to do with it is what its facade offers —
 * calling a meeting, putting up a date. So the owner's view opens on the facade
 * where the board has one, with the playground's choice of facade, split and
 * runtimes beside it, and what the facade does goes over the bridge as the
 * owner's own action. The coordinator here is the test.
 */

const OWNER = {
  userId: "auth0|owner",
  username: "owner-account",
  email: "owner@club.example",
  idToken: "owner-token",
};

vi.mock("../../../AppContext", async (original) => ({
  ...(await original<typeof import("../../../AppContext")>()),
  useAppContext: () => ({ user: OWNER }),
}));
vi.mock("../../../auth/useCloudLogin", () => ({
  useCloudLogin: () => async () => {},
  useCanCloudLogin: () => true,
}));

import CloudBoards from "../index";

const COORDINATOR = "https://club.example/coordinator";

const BOARD = {
  boardName: "court",
  runtimes: [{ id: "node", name: "Club", type: "rest", remote: "node" }],
  services: {
    node: [
      {
        uuid: "book",
        serviceId: "sql",
        serviceName: "Book an hour",
        state: {},
      },
    ],
  },
  facade: {
    layout: "single",
    panels: [
      {
        id: "main",
        layout: {
          direction: "column",
          items: [
            { type: "text", label: "Booking as", value: { $user: "name" } },
            {
              type: "button",
              label: "Book",
              actions: [
                { type: "process", serviceUuid: "book", payload: { hour: 10 } },
              ],
            },
          ],
        },
      },
    ],
  },
};

const sockets: FakeSocket[] = [];

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  readyState = 1;
  binaryType = "";
  sent: Array<Record<string, unknown>> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  deliver(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  last(type: string) {
    return [...this.sent].reverse().find((message) => message.type === type);
  }
}

/**
 * Whether what `text` is in is on screen. Both halves stay mounted, so that
 * widgets and panels keep what they hold and hear; the one put away is
 * collapsed rather than removed.
 */
function onScreen(text: string): boolean {
  for (
    let el: HTMLElement | null = screen.getByText(text);
    el;
    el = el.parentElement
  ) {
    if (el.style.flex === "0 0 0px" || el.style.height === "0px") {
      return false;
    }
  }
  return true;
}

async function openAsOwner() {
  render(
    <MemoryRouter initialEntries={["/cloud-boards"]}>
      <CloudBoards initialCoordinatorName="Club" initialBoardName="court" />
    </MemoryRouter>,
  );
  await waitFor(() => expect(sockets.length).toBe(1));
  const bridge = sockets[0];
  await waitFor(() => expect(bridge.last("connect")).toBeTruthy());
  bridge.deliver({
    type: "snapshot",
    seq: 1,
    boardName: "court",
    status: "running",
    errors: [],
    role: "owner",
    // What the board's own list calls its owner, where it names them.
    you: { email: OWNER.email, name: "Club secretary" },
    config: BOARD,
    runtimes: [{ runtimeId: "node", registry: [], services: { book: {} } }],
  });
  return bridge;
}

describe("a deployed board, opened by its owner", () => {
  beforeEach(() => {
    sockets.length = 0;
    localStorage.clear();
    localStorage.setItem(
      "hkp-coordinators",
      JSON.stringify([{ name: "Club", url: COORDINATOR }]),
    );
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const boards = String(url).endsWith("/boards")
          ? [
              {
                boardName: "court",
                status: "running",
                createdAt: "2026-10-16T00:00:00Z",
                config: BOARD,
              },
            ]
          : [];
        return new Response(JSON.stringify({ boards }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens on its facade, showing the owner as the board calls them", async () => {
    await openAsOwner();

    await waitFor(() =>
      expect(screen.getByText("Club secretary")).toBeTruthy(),
    );
    expect(screen.getByText("Book")).toBeTruthy();
    expect(onScreen("Book")).toBe(true);
    // The facade is the board here; the runtimes are a press away.
    expect(onScreen("Book an hour")).toBe(false);
  });

  it("sends what the facade does over the bridge", async () => {
    const bridge = await openAsOwner();
    await waitFor(() => expect(screen.getByText("Book")).toBeTruthy());

    fireEvent.click(screen.getByText("Book"));

    await waitFor(() =>
      expect(bridge.last("processService")).toMatchObject({
        runtimeId: "node",
        serviceUuid: "book",
        payload: { hour: 10 },
      }),
    );
  });

  it("switches between the facade, both, and the runtimes", async () => {
    await openAsOwner();
    await waitFor(() => expect(screen.getByText("Book")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Show the board only"));
    await waitFor(() => expect(onScreen("Book an hour")).toBe(true));
    expect(onScreen("Book")).toBe(false);

    fireEvent.click(screen.getByLabelText("Show the facade and the board"));
    await waitFor(() => expect(onScreen("Book")).toBe(true));
    expect(onScreen("Book an hour")).toBe(true);

    fireEvent.click(screen.getByLabelText("Show the facade only"));
    await waitFor(() => expect(onScreen("Book an hour")).toBe(false));
    expect(onScreen("Book")).toBe(true);
  });
});
