import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoardContextState } from "hkp-frontend/src/BoardContext";

const executeActions = vi.fn(async () => {});
vi.mock("../executeActions", () => ({ executeActions }));

const { useFacadeInit } = await import("../useFacadeInit");

/**
 * A facade's `init` draws a board's first view — the court calendar asks for
 * today as the board opens. On a remote runtime the answer is a notification
 * on the runtime's socket, so a call made before that socket is open is
 * answered into nothing. Init runs once; it has to wait.
 */
describe("a facade's init", () => {
  beforeEach(() => executeActions.mockClear());

  /** A board whose one runtime connects when `open` is called. */
  function boardOpening() {
    let open = () => {};
    const connected = new Promise<void>((resolve) => {
      open = resolve;
    });
    const boardContext = {
      runtimes: [{ id: "club", name: "Club", type: "rest", url: "http://127.0.0.1:18180" }],
      services: { club: [{ uuid: "give-back", serviceId: "sql", serviceName: "SQL" }] },
      scopes: { club: { whenConnected: () => connected } },
      runtimeApis: { rest: {} },
    } as unknown as BoardContextState;

    function Facade() {
      useFacadeInit({
        facade: {
          panels: [],
          init: [{ type: "process", serviceUuid: "give-back", payload: {} }],
        } as never,
        boardContext,
        boardName: "Court Booking",
        setState: () => {},
        stateRef: { current: {} },
        identity: {} as never,
      });
      return null;
    }
    return { Facade, open: () => open() };
  }

  it("waits until the runtime it calls can report back", async () => {
    const { Facade, open } = boardOpening();

    render(<Facade />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(executeActions).not.toHaveBeenCalled();

    open();
    await waitFor(() => expect(executeActions).toHaveBeenCalledTimes(1));
  });

  it("does not run for a board closed while it waited", async () => {
    const { Facade, open } = boardOpening();

    const { unmount } = render(<Facade />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    unmount();
    open();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(executeActions).not.toHaveBeenCalled();
  });
});
