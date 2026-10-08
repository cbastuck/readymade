import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import SharedBoard from "../SharedBoard";

/**
 * A board somebody shared, opened by one of its members.
 *
 * What the coordinator sends a member is a projection: the facade, and of the
 * board only the services the facade names. So this view has no board to show
 * and shows none — it renders the facade, sends what the facade does over the
 * bridge, and draws what comes back. The coordinator here is the test.
 */

const PROJECTION = {
  boardName: "court",
  // Named and not located: there is nothing here for a browser to dial.
  runtimes: [{ id: "node", name: "Node", type: "rest" }],
  services: {
    node: [{ uuid: "book", serviceId: "sql", serviceName: "SQL", state: {} }],
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
            {
              type: "text",
              source: { serviceUuid: "book", path: "said" },
              placeholder: "nothing yet",
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
  /** The coordinator ending the bridge. */
  end(code = 1005) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  last(type: string) {
    return [...this.sent].reverse().find((message) => message.type === type);
  }
}

const USER = {
  userId: "auth0|anna",
  username: "anna-account",
  email: "anna@example.com",
  idToken: "anna-token",
} as never;

const SHARED = {
  coordinatorUrl: "https://node1.example.com/coordinator",
  owner: "auth0|owner",
  boardName: "court",
};

async function open() {
  render(<SharedBoard shared={SHARED} user={USER} />);
  await waitFor(() => expect(sockets.length).toBe(1));
  const bridge = sockets[0];
  await waitFor(() => expect(bridge.last("connect")).toBeTruthy());
  return bridge;
}

function snapshot(seq = 1, you = { email: "anna@example.com", name: "Anna" }) {
  return {
    type: "snapshot",
    seq,
    boardName: "court",
    status: "running",
    errors: [],
    role: "member",
    you,
    config: PROJECTION,
    runtimes: [{ runtimeId: "node", registry: [], services: { book: {} } }],
  };
}

describe("opening a shared board", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal("WebSocket", FakeSocket);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("attaches to the owner's board, hosting nothing", async () => {
    const bridge = await open();

    expect(bridge.url).toBe(
      "wss://node1.example.com/coordinator/bridge?access_token=anna-token",
    );
    expect(bridge.last("connect")).toEqual({
      type: "connect",
      userId: "auth0|owner",
      boardName: "court",
      runtimeIds: [],
    });
  });

  it("renders the facade from the projection, as who the board says you are", async () => {
    const bridge = await open();

    bridge.deliver(snapshot());

    await waitFor(() => expect(screen.getByText("Book")).toBeTruthy());
    // The board's name for her, not her account's.
    expect(screen.getByText("Anna")).toBeTruthy();
    expect(screen.queryByText("anna-account")).toBeNull();
  });

  it("sends what the facade does over the bridge, and draws what comes back", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bridge = await open();
    bridge.deliver(snapshot());
    await waitFor(() => expect(screen.getByText("Book")).toBeTruthy());

    fireEvent.click(screen.getByText("Book"));

    await waitFor(() => expect(bridge.last("processService")).toBeTruthy());
    expect(bridge.last("processService")).toMatchObject({
      type: "processService",
      runtimeId: "node",
      serviceUuid: "book",
      payload: { hour: 10 },
    });
    // Nothing dialled: the member was told no address, and has none to use.
    expect(fetchMock).not.toHaveBeenCalled();

    bridge.deliver({
      type: "notification",
      runtimeId: "node",
      serviceUuid: "book",
      payload: { said: "Court 2 at 10:00 is yours" },
    });
    await waitFor(() =>
      expect(screen.getByText("Court 2 at 10:00 is yours")).toBeTruthy(),
    );
  });

  it("says so when the board is not shared with them, and stops asking", async () => {
    const bridge = await open();

    // The one answer for a board that is not there and a board that is not
    // theirs.
    bridge.end(4404);

    await waitFor(() =>
      expect(screen.getByText("This board is not shared with you")).toBeTruthy(),
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(sockets.length).toBe(1);
  });

  it("asks again when the connection goes before the board was told, saying nothing of sharing", async () => {
    const bridge = await open();

    // No code: a coordinator restarting, a network that went away. Not an
    // answer about the board.
    bridge.end();

    await waitFor(() => expect(sockets.length).toBe(2), { timeout: 2000 });
    expect(screen.queryByText("This board is not shared with you")).toBeNull();
    expect(screen.getByText("Opening…")).toBeTruthy();

    // And the second try is as good as a first.
    const again = sockets[1];
    await waitFor(() => expect(again.last("connect")).toBeTruthy());
    again.deliver(snapshot());
    await waitFor(() => expect(screen.getByText("Book")).toBeTruthy());
  });

  it("says so when they have it open in too many places, and stops asking", async () => {
    const bridge = await open();

    bridge.end(4429);

    await waitFor(() =>
      expect(
        screen.getByText("This board is open in too many places"),
      ).toBeTruthy(),
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(sockets.length).toBe(1);
  });

  it("says so when they are taken off the list while it is open", async () => {
    const bridge = await open();
    bridge.deliver(snapshot());
    await waitFor(() => expect(screen.getByText("Book")).toBeTruthy());

    bridge.end(4403);

    await waitFor(() =>
      expect(
        screen.getByText("This board is no longer shared with you"),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("Book")).toBeNull();
  });
});
