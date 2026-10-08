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
 * Arriving by a link to a shared board.
 *
 * A link names a coordinator, and anybody can write one naming a server of
 * their own. Opening a board means sending that server the person's sign-in —
 * so what is pinned here is that nothing at all is sent to a coordinator the
 * person does not already keep until they have said yes.
 */

const USER = {
  userId: "auth0|anna",
  username: "anna",
  email: "anna@example.com",
  idToken: "anna-token",
};

vi.mock("../../../AppContext", async (original) => ({
  ...(await original<typeof import("../../../AppContext")>()),
  useAppContext: () => ({ user: USER }),
}));
vi.mock("../../../auth/useCloudLogin", () => ({
  useCloudLogin: () => async () => {},
  useCanCloudLogin: () => true,
}));

import CloudBoards from "../index";

const KEPT = "https://kept.example/coordinator";
const UNKNOWN = "https://collector.example/coordinator";

const sockets: string[] = [];

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  readyState = 1;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(url);
  }
  send() {}
  close() {
    this.readyState = 3;
  }
}

let fetched: string[] = [];

function arriveAt(coordinatorUrl: string) {
  const query = new URLSearchParams({
    shared: coordinatorUrl,
    owner: "auth0|owner",
    board: "court",
  });
  return render(
    <MemoryRouter initialEntries={[`/cloud-boards?${query.toString()}`]}>
      <CloudBoards />
    </MemoryRouter>,
  );
}

const sentTo = (host: string) =>
  [...fetched, ...sockets].filter((url) => url.includes(host));

describe("a link to a shared board", () => {
  beforeEach(() => {
    sockets.length = 0;
    fetched = [];
    localStorage.clear();
    localStorage.setItem(
      "hkp-coordinators",
      JSON.stringify([{ name: "Club", url: KEPT }]),
    );
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        fetched.push(String(url));
        return new Response(JSON.stringify({ boards: [] }), {
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

  it("opens at once on a coordinator the person keeps", async () => {
    arriveAt(KEPT);

    await waitFor(() =>
      expect(sockets).toContain(
        "wss://kept.example/coordinator/bridge?access_token=anna-token",
      ),
    );
    expect(screen.queryByText("Open a shared board?")).toBeNull();
  });

  it("asks first for any other coordinator, having sent it nothing", async () => {
    arriveAt(UNKNOWN);

    await waitFor(() =>
      expect(screen.getByText("Open a shared board?")).toBeTruthy(),
    );
    expect(screen.getByText("collector.example")).toBeTruthy();
    // Long enough for anything that was going to be sent to have been.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sentTo("collector.example")).toEqual([]);
  });

  it("sends nothing when the person declines", async () => {
    arriveAt(UNKNOWN);
    await waitFor(() =>
      expect(screen.getByText("Open a shared board?")).toBeTruthy(),
    );

    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() =>
      expect(screen.queryByText("Open a shared board?")).toBeNull(),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(sentTo("collector.example")).toEqual([]);
    expect(localStorage.getItem("hkp-coordinators")).not.toContain("collector");
  });

  it("opens, and keeps the coordinator, once they agree", async () => {
    arriveAt(UNKNOWN);
    await waitFor(() =>
      expect(screen.getByText("Open a shared board?")).toBeTruthy(),
    );

    fireEvent.click(screen.getByText("Add coordinator and open"));

    await waitFor(() =>
      expect(sockets).toContain(
        "wss://collector.example/coordinator/bridge?access_token=anna-token",
      ),
    );
    expect(localStorage.getItem("hkp-coordinators")).toContain(
      "collector.example",
    );
  });
});
