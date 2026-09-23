import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";
import { FacadeNotices } from "../FacadeNotices";
import type { FacadeNotice } from "../types";

/**
 * Notices: what a board says without being looked at.
 *
 * The condition is the whole design, so it is what is pinned: a notice fires on
 * a value arriving with something in it, and stays quiet otherwise — which is
 * how a service that reports `error: ""` on every good run can be watched
 * without saying anything all day. The other half is that it never speaks for
 * the state a service was already in: a failure from before this board was open
 * is not news.
 */

const handlers: ((notification: unknown) => void)[] = [];

const service = {
  uuid: "writer",
  state: { error: "a failure from before the board was opened" },
  app: {
    registerNotificationTarget: (_svc: unknown, handler: (n: unknown) => void) => {
      handlers.push(handler);
    },
    unregisterNotificationTarget: () => {},
  },
};

vi.mock("../boardServices", () => ({
  findService: (_ctx: unknown, uuid: string) => (uuid === "writer" ? service : null),
  processService: () => {},
}));

const pushed: { type: string; message: string }[] = [];

const boardContext = {
  scopes: {},
  services: {},
  runtimes: [],
  appContext: {
    pushNotification: (n: { type: string; message: string }) => {
      pushed.push(n);
    },
  },
} as unknown as BoardContextState;

function watch(notices: FacadeNotice[]) {
  handlers.length = 0;
  pushed.length = 0;
  render(<FacadeNotices notices={notices} boardContext={boardContext} />);
}

/** What the watched service reports, as the board would hear it. */
function reports(notification: unknown) {
  act(() => {
    handlers.forEach((handler) => handler(notification));
  });
}

const errorNotice: FacadeNotice = {
  source: { serviceUuid: "writer", path: "error" },
};

describe("facade notices", () => {
  it("says nothing about the state a service was already in", () => {
    watch([errorNotice]);
    expect(pushed).toEqual([]);
  });

  it("raises what the service reports, as an error by default", () => {
    watch([errorNotice]);
    reports({ error: "insert failed: UNIQUE constraint" });
    expect(pushed).toEqual([
      { type: "error", message: "insert failed: UNIQUE constraint" },
    ]);
  });

  it("stays quiet for a run that reports nothing wrong", () => {
    watch([errorNotice]);
    reports({ error: "" });
    reports({ rows: [{ id: 1 }], count: 1 });
    expect(pushed).toEqual([]);
  });

  it("says the same thing twice when it happens twice", () => {
    watch([errorNotice]);
    reports({ error: "no such court" });
    reports({ error: "no such court" });
    expect(pushed).toHaveLength(2);
  });

  it("ignores what the machinery says to itself", () => {
    watch([errorNotice]);
    reports({ error: "internal chatter", __internal: true });
    expect(pushed).toEqual([]);
  });

  it("wraps the value in the board's own words", () => {
    watch([
      {
        source: { serviceUuid: "writer", path: "error" },
        tone: "info",
        message: "Could not book it — {{value}}",
      },
    ]);
    reports({ error: "the hour is taken" });
    expect(pushed).toEqual([
      { type: "info", message: "Could not book it — the hour is taken" },
    ]);
  });

  it("draws nothing at all", () => {
    const { container } = render(
      <FacadeNotices notices={[errorNotice]} boardContext={boardContext} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
