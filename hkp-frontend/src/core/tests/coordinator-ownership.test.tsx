import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { BoardCoordinator } from "hkp-frontend/src/core/coordinator";

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

async function coordinatorOf(
  props: Partial<React.ComponentProps<typeof BoardProvider>> = {},
): Promise<BoardCoordinator> {
  let context: BoardContextState | null = null;
  render(
    <BoardProvider user={null} {...props}>
      <ContextProbe onChange={(ctx) => (context = ctx)} />
    </BoardProvider>,
  );
  await waitFor(() => expect(context).not.toBeNull());
  return (context as unknown as BoardContextState).coordinator;
}

describe("board ownership", () => {
  it("coordinates the board itself when no owner is given", async () => {
    // The playground and Readymade: this browser holds the engine state, so it
    // answers cross-runtime questions from it.
    const coordinator = await coordinatorOf({
      initialState: {
        runtimes: [],
        services: {
          node: [
            {
              uuid: "peer-svc",
              state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc" },
            } as any,
          ],
        },
        registry: {},
        scopes: {},
      },
    });

    expect(coordinator.resolveMountUrl("hkp-mount://node/peer-svc")).toBe(
      "http://127.0.0.1:8080/hosted/abc",
    );
  });

  it("defers to the coordinator the host provides", async () => {
    // A cloud board is coordinated by hkp-node; this browser is a participant,
    // so it must ask the owner rather than answer from its own board state.
    const owner = {
      getServiceState: vi.fn(),
      resolveMount: vi.fn(),
      resolveMountUrl: vi.fn(() => "http://elsewhere:9000/hosted/xyz"),
      referenceMount: vi.fn(),
      resolveMountsInBoard: vi.fn(),
    } as unknown as BoardCoordinator;

    const coordinator = await coordinatorOf({ coordinator: owner });

    expect(coordinator).toBe(owner);
    expect(coordinator.resolveMountUrl("hkp-mount://node/peer-svc")).toBe(
      "http://elsewhere:9000/hosted/xyz",
    );
  });
});
