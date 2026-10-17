import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";

/**
 * Two coordinators, each with a board of the same name.
 *
 * A board's name is unique only on the coordinator that holds it — the same
 * demo deployed twice is called the same twice. Opening one after the other
 * must open the second: hydrate it from what its own coordinator says, and run
 * its facade's `init` against it, rather than take it for the board that was
 * open before because the names agree.
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

const CLUB = "https://club.example/coordinator";
const ANNEX = "https://annex.example/coordinator";

/** The same board as deployed to `where`: only its button says which. */
function board(where: string) {
  return {
    boardName: "court",
    runtimes: [{ id: "node", name: "Club", type: "rest", remote: "node" }],
    services: {
      node: [
        { uuid: "book", serviceId: "sql", serviceName: "Book", state: {} },
      ],
    },
    facade: {
      layout: "single",
      init: [
        { type: "process", serviceUuid: "book", payload: { opening: where } },
      ],
      panels: [
        {
          id: "main",
          layout: {
            direction: "column",
            items: [
              {
                type: "button",
                label: `Book at the ${where}`,
                actions: [
                  {
                    type: "process",
                    serviceUuid: "book",
                    payload: { hour: 10 },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  };
}

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

function snapshotOf(where: string) {
  return {
    type: "snapshot",
    seq: 1,
    boardName: "court",
    status: "running",
    errors: [],
    role: "owner",
    you: { email: OWNER.email },
    config: board(where),
    runtimes: [{ runtimeId: "node", registry: [], services: { book: {} } }],
  };
}

/** What a host does to open a board on a view that is already up. */
function OpenAnnex() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() =>
        navigate("/cloud-boards", {
          state: {
            openBoard: { coordinatorUrl: ANNEX, boardName: "court", at: 2 },
          },
        })
      }
    >
      Open the annex
    </button>
  );
}

describe("boards of the same name on two coordinators", () => {
  beforeEach(() => {
    sockets.length = 0;
    localStorage.clear();
    localStorage.setItem(
      "hkp-coordinators",
      JSON.stringify([
        { name: "Club", url: CLUB },
        { name: "Annex", url: ANNEX },
      ]),
    );
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        const where = href.startsWith(ANNEX) ? "annex" : "club";
        const boards = href.endsWith("/boards")
          ? [
              {
                boardName: "court",
                status: "running",
                createdAt: "2026-10-16T00:00:00Z",
                config: board(where),
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

  it("hydrates and initialises the second, not the first again", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/cloud-boards",
            state: {
              openBoard: { coordinatorUrl: CLUB, boardName: "court", at: 1 },
            },
          },
        ]}
      >
        <OpenAnnex />
        <CloudBoards />
      </MemoryRouter>,
    );

    await waitFor(() => expect(sockets.length).toBe(1));
    const club = sockets[0];
    expect(club.url).toContain("club.example");
    await waitFor(() => expect(club.last("connect")).toBeTruthy());
    club.deliver(snapshotOf("club"));

    await waitFor(() =>
      expect(screen.getByText("Book at the club")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(club.last("processService")).toMatchObject({
        serviceUuid: "book",
        payload: { opening: "club" },
      }),
    );

    fireEvent.click(screen.getByText("Open the annex"));

    await waitFor(() => expect(sockets.length).toBe(2));
    const annex = sockets[1];
    expect(annex.url).toContain("annex.example");
    await waitFor(() => expect(annex.last("connect")).toBeTruthy());
    // Until the annex has said what its board is, the club's is not shown as
    // though it were.
    expect(screen.queryByText("Book at the club")).toBeNull();

    annex.deliver(snapshotOf("annex"));

    await waitFor(() =>
      expect(screen.getByText("Book at the annex")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(annex.last("processService")).toMatchObject({
        serviceUuid: "book",
        payload: { opening: "annex" },
      }),
    );
  });
});
