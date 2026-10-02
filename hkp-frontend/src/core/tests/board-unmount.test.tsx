import { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApi, RuntimeDescriptor, RuntimeScope } from "hkp-frontend/src/types";

/**
 * Leaving a board.
 *
 * A board built here runs on runtimes this browser provisioned, and takes them
 * down on its way out — whether or not the board was deployed meanwhile. What
 * a coordinator builds for a deployed board is kept apart from them by the
 * runtime server, so taking these down stops nothing but this browser's copy.
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
