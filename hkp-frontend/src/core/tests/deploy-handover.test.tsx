import { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApi, RuntimeDescriptor, RuntimeScope } from "hkp-frontend/src/types";

/**
 * Giving a board away.
 *
 * A board built here runs on runtimes this browser provisioned and tears down
 * on its way out. Deploying gives them to a coordinator, which provisions them
 * under the same ids — they are the board's ids. Tearing them down afterwards
 * would delete a running board that now belongs to someone else, and the
 * deleting would look like ordinary cleanup, which is why it is pinned here.
 */

function ContextProbe({
  onChange,
}: {
  onChange: (ctx: BoardContextState | null) => void;
}) {
  const ctx = useContext(BoardCtx);
  useEffect(() => {
    onChange(ctx);
  }, [ctx, onChange]);
  return null;
}

const nodeRuntime = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const browserRuntime = {
  id: "ui",
  name: "Browser",
  type: "browser",
} as RuntimeDescriptor;

async function mountBoard() {
  const removeRuntime = vi.fn(async () => {});
  const close = vi.fn();
  const api = { removeRuntime } as unknown as RuntimeApi;
  const scope = { close } as unknown as RuntimeScope;

  let context: BoardContextState | null = null;
  const view = render(
    <BoardProvider
      user={null}
      runtimeApis={{ rest: api, browser: api }}
      initialState={{
        runtimes: [nodeRuntime, browserRuntime],
        services: {},
        registry: {},
        scopes: { node: scope, ui: scope },
      }}
    >
      <ContextProbe onChange={(ctx) => (context = ctx)} />
    </BoardProvider>,
  );
  await waitFor(() => expect(context).not.toBeNull());
  return {
    context: context as unknown as BoardContextState,
    view,
    removeRuntime,
    close,
  };
}

describe("a board this browser owns", () => {
  it("takes its runtimes down with it", async () => {
    const { view, removeRuntime } = await mountBoard();

    view.unmount();

    expect(removeRuntime.mock.calls.map((call) => (call as unknown as [unknown, RuntimeDescriptor])[1].id)).toEqual([
      "node",
      "ui",
    ]);
  });
});

describe("a board that has been deployed", () => {
  it("leaves the remote runtimes running", async () => {
    // The coordinator provisioned them under these ids; deleting one here would
    // stop the board it just deployed.
    const { context, view, removeRuntime, close } = await mountBoard();

    context.handOverRuntimes();
    view.unmount();

    const removed = removeRuntime.mock.calls.map(
      (call) => (call as unknown as [unknown, RuntimeDescriptor])[1].id,
    );
    expect(removed).not.toContain("node");
    // Still disconnected: the socket is the one thing this browser still owns.
    expect(close).toHaveBeenCalled();
  });

  it("still takes down the runtimes that live in this browser", async () => {
    // A browser runtime cannot be handed over — it runs in this tab, and no
    // coordinator can adopt it.
    const { context, view, removeRuntime } = await mountBoard();

    context.handOverRuntimes();
    view.unmount();

    expect(
      removeRuntime.mock.calls.map(
        (call) => (call as unknown as [unknown, RuntimeDescriptor])[1].id,
      ),
    ).toEqual(["ui"]);
  });
});
