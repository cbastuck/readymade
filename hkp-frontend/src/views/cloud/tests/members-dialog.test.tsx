import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import MembersDialog from "../MembersDialog";
import { listSharedBoards } from "../coordinatorClient";

/**
 * The owner's list of who a deployed board is shared with. The list lives on
 * the board's coordinator, so every change here is a request to it, and what
 * is shown is what it answered with.
 */

const COORDINATOR = "https://node1.example.com/coordinator";
const MEMBERS = `${COORDINATOR}/users/auth0%7Cowner/boards/Court%20booking/members`;

type Call = { url: string; method: string; body: unknown; auth: string | null };

let calls: Call[] = [];
let members: Array<{ email: string; name: string }> = [];

function open() {
  return render(
    <MembersDialog
      isOpen
      coordinatorUrl={COORDINATOR}
      userId="auth0|owner"
      idToken="owner-token"
      boardName="Court booking"
      onClose={() => {}}
    />,
  );
}

describe("the members dialog", () => {
  beforeEach(() => {
    calls = [];
    members = [{ email: "anna@example.com", name: "Anna" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init: RequestInit = {}) => {
        const method = init.method ?? "GET";
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({
          url: String(url),
          method,
          body,
          auth: new Headers(init.headers).get("Authorization"),
        });
        if (method === "POST") {
          members = [
            ...members.filter((member) => member.email !== body.email),
            body,
          ];
        }
        if (method === "DELETE") {
          const email = decodeURIComponent(String(url).split("/").pop() ?? "");
          members = members.filter((member) => member.email !== email);
        }
        return new Response(JSON.stringify({ members }), {
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

  it("shows who the board is shared with, asked as its owner", async () => {
    open();

    await waitFor(() => expect(screen.getByText("Anna")).toBeTruthy());
    expect(screen.getByText("anna@example.com")).toBeTruthy();
    expect(calls[0]).toMatchObject({
      url: MEMBERS,
      method: "GET",
      auth: "Bearer owner-token",
    });
  });

  it("shares the board with an address under a name", async () => {
    open();
    await waitFor(() => expect(screen.getByText("Anna")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " ben@example.com " },
    });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ben" },
    });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(screen.getByText("Ben")).toBeTruthy());
    expect(calls.at(-1)).toMatchObject({
      url: MEMBERS,
      method: "POST",
      body: { email: "ben@example.com", name: "Ben" },
    });
  });

  it("does not offer to add half an entry", async () => {
    open();
    await waitFor(() => expect(screen.getByText("Anna")).toBeTruthy());
    const add = screen.getByText("Add") as HTMLButtonElement;

    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ben@example.com" },
    });
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ben" } });
    expect(add.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "not an address" },
    });
    expect(add.disabled).toBe(true);
  });

  it("renames an entry, keyed by its address", async () => {
    open();
    await waitFor(() => expect(screen.getByText("Anna")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Rename anna@example.com"));
    const field = screen.getByLabelText("Name for anna@example.com");
    fireEvent.change(field, { target: { value: "Anna K." } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("Anna K.")).toBeTruthy());
    expect(calls.at(-1)).toMatchObject({
      method: "POST",
      body: { email: "anna@example.com", name: "Anna K." },
    });
  });

  it("stops sharing with somebody", async () => {
    open();
    await waitFor(() => expect(screen.getByText("Anna")).toBeTruthy());

    fireEvent.click(screen.getByLabelText("Remove anna@example.com"));

    await waitFor(() =>
      expect(screen.getByText("Not shared with anybody yet.")).toBeTruthy(),
    );
    expect(calls.at(-1)).toMatchObject({
      url: `${MEMBERS}/anna%40example.com`,
      method: "DELETE",
    });
  });

  it("says what the coordinator said when it refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init: RequestInit = {}) =>
        init.method === "POST"
          ? new Response(
              JSON.stringify({
                error: "A board can be shared with at most 1 people",
              }),
              { status: 429 },
            )
          : new Response(JSON.stringify({ members }), { status: 200 }),
      ),
    );
    open();
    await waitFor(() => expect(screen.getByText("Anna")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ben@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ben" } });
    fireEvent.click(screen.getByText("Add"));

    await waitFor(() =>
      expect(
        screen.getByText("A board can be shared with at most 1 people"),
      ).toBeTruthy(),
    );
  });
});

describe("asking what is shared with me", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the coordinator as the person signed in, naming nobody", async () => {
    const fetchMock = vi.fn(
      async (_url: string | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            boards: [
              { owner: "auth0|owner", boardName: "court", status: "running", name: "Anna" },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const boards = await listSharedBoards(COORDINATOR, "anna-token");

    expect(boards).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${COORDINATOR}/shared`);
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer anna-token");
  });

  it("is nothing on a coordinator that predates sharing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );

    expect(await listSharedBoards(COORDINATOR, "anna-token")).toEqual([]);
  });
});
