import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { LayoutNode } from "../panels/LayoutNode";
import { FacadeIdentityProvider } from "../FacadeIdentity";
import { readThread, stillPending } from "../panels/renderers/MessageListRenderer";
import type { LayoutItem } from "../types";

/**
 * A message list fed a whole thread.
 *
 * A chat kept in a database is said as rows, again and again — after each
 * message anybody sends — so an array is the thread as it now stands rather
 * than one more message, and the list has to be drawn from it each time: whose
 * each message is, which are the viewer's own, and what was sent from here that
 * the thread does not hold yet.
 */

const handlers: ((notification: unknown) => void)[] = [];
const processed: { uuid: string; payload: unknown }[] = [];

const thread = {
  uuid: "thread",
  state: {},
  app: {
    registerNotificationTarget: (_svc: unknown, handler: (n: unknown) => void) => {
      handlers.push(handler);
    },
    unregisterNotificationTarget: () => {},
  },
};

vi.mock("../boardServices", () => ({
  findService: (_ctx: unknown, uuid: string) => (uuid === "thread" ? thread : null),
  processService: (_ctx: unknown, uuid: string, payload: unknown) => {
    processed.push({ uuid, payload });
  },
}));

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
} as unknown as BoardContextState;

const widget = {
  type: "message-list",
  source: { serviceUuid: "thread", path: "rows" },
  mineWhen: { field: "author", equals: { $user: "name" } },
  composer: {
    placeholder: "Say something",
    actions: [
      { type: "process", serviceUuid: "thread", payload: { intent: "post", text: "$$input" } },
    ],
  },
} as unknown as LayoutItem;

function show(as = "Anna") {
  handlers.length = 0;
  processed.length = 0;
  return render(
    <FacadeIdentityProvider identity={{ name: as }}>
      <LayoutNode
        item={widget}
        boardContext={boardContext}
        panelContext={{ knobValues: {}, onKnobChange: () => {} }}
      />
    </FacadeIdentityProvider>,
  );
}

function says(rows: unknown[]) {
  act(() => {
    handlers.forEach((handler) => handler({ rows }));
  });
}

const rows = [
  { id: 1, author: "Ben", text: "anyone around?", time: "10:01" },
  { id: 2, author: "Ben", text: "lunch?", time: "10:02" },
  { id: 3, author: "Anna", text: "yes", time: "10:03" },
];

afterEach(cleanup);

describe("a message list fed a whole thread", () => {
  it("draws the thread it is given, replacing what it showed", () => {
    show();
    says(rows);
    says(rows.slice(1));

    expect(screen.queryByText("anyone around?")).toBeNull();
    expect(screen.getByText("lunch?")).toBeTruthy();
    expect(screen.getByText("yes")).toBeTruthy();
  });

  it("names the author once for a run of their messages, and not on the viewer's own", () => {
    show();
    says(rows);

    expect(screen.getAllByText("Ben")).toHaveLength(1);
    expect(screen.queryByText("Anna")).toBeNull();
  });

  it("shows what was sent from here until the thread holds it", () => {
    show();
    says(rows);

    const input = screen.getByLabelText("Say something");
    fireEvent.change(input, { target: { value: "on my way" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("sending…")).toBeTruthy();
    expect(screen.getByText("on my way")).toBeTruthy();

    says([...rows, { id: 4, author: "Anna", text: "on my way", time: "10:04" }]);

    expect(screen.queryByText("sending…")).toBeNull();
    expect(screen.getAllByText("on my way")).toHaveLength(1);
  });

  it("sends the message through the composer's steps", async () => {
    show();
    says(rows);

    const input = screen.getByLabelText("Say something");
    fireEvent.change(input, { target: { value: "  hello  " } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });

    expect(processed).toEqual([
      { uuid: "thread", payload: { intent: "post", text: "hello" } },
    ]);
  });
});

describe("reading a thread", () => {
  it("reads the fields a widget names, and marks the viewer's own", () => {
    const read = readThread(
      [{ key: "a", body: "hi", who: "Ben", at: "9:00" }, "plain", { body: null }],
      {
        textField: "body",
        authorField: "who",
        timeField: "at",
        idField: "key",
        mineWhen: { field: "who", equals: "Ben" },
      },
      "Ben",
    );

    expect(read).toEqual([
      { id: "a", text: "hi", direction: "sent", author: "Ben", time: "9:00" },
      { id: "#1", text: "plain", direction: "received" },
    ]);
  });

  it("marks nothing as the viewer's own when it does not know who is looking", () => {
    const read = readThread(
      [{ id: 1, author: "", text: "hi" }],
      { mineWhen: { field: "author", equals: { $user: "name" } } },
      undefined,
    );
    expect(read[0].direction).toBe("received");
  });

  it("lets a sent message go once it has waited long enough to have been refused", () => {
    const sent = { id: "s", text: "hi", direction: "sent" as const, pending: true };
    const at = new Map([["s", 1_000]]);

    expect(stillPending([sent], [], at, 2_000)).toEqual([sent]);
    expect(stillPending([sent], [], at, 20_000)).toEqual([]);
  });
});
