import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
  EngineState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApiMap } from "hkp-frontend/src/types";

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

/**
 * A board whose consumer names a mount its owner has already published — the
 * state right after both runtimes have come up.
 */
function boardState(): EngineState {
  return {
    runtimes: [
      { id: "endpoint-node", name: "Endpoint", type: "rest" },
      { id: "caller-node", name: "Caller", type: "rest" },
    ] as any,
    services: {
      "endpoint-node": [
        {
          uuid: "echo-server",
          serviceId: "http-server-subservices",
          state: { __hkpMount: "http://127.0.0.1:8080/hosted/abc123" },
        },
      ],
      "caller-node": [
        {
          uuid: "call",
          serviceId: "http-client",
          state: { __hkpMount: "hkp-mount://endpoint-node/echo-server" },
        },
      ],
    } as any,
    registry: {},
    scopes: {
      "endpoint-node": { descriptor: { id: "endpoint-node" } } as any,
      "caller-node": { descriptor: { id: "caller-node" } } as any,
    },
  };
}

describe("handing mount addresses to remote services", () => {
  it("configures the consumer once, not on every board update", async () => {
    // A remote runtime reports state constantly — a service notifying progress,
    // a timer ticking. None of that is a reason to reconfigure it, and doing so
    // would spin: each configure updates board state, which would trigger the
    // next configure.
    const configureService = vi.fn(async () => ({}));
    const runtimeApis: RuntimeApiMap = {
      rest: {
        configureService,
        restoreRuntime: vi.fn(),
        addRuntime: vi.fn(),
        removeRuntime: vi.fn(async () => {}),
        processRuntime: vi.fn(),
        addService: vi.fn(async () => ({
          uuid: "monitor-1",
          serviceId: "monitor",
          serviceName: "Monitor",
          state: {},
        })),
        removeService: vi.fn(),
        getServiceConfig: vi.fn(),
        processService: vi.fn(),
        rearrangeServices: vi.fn(),
      } as any,
    };

    let ctx: BoardContextState | null = null;
    render(
      <BoardProvider
        user={null}
        boardName="mount-board"
        initialState={boardState()}
        runtimeApis={runtimeApis}
        onRemoveRuntime={vi.fn(async () => {})}
      >
        <ContextProbe onChange={(next) => (ctx = next)} />
      </BoardProvider>,
    );

    await waitFor(() => expect(configureService).toHaveBeenCalledTimes(1));
    expect(configureService.mock.calls[0][2]).toEqual({
      __hkpMount: "http://127.0.0.1:8080/hosted/abc123",
    });

    // Board state churns while a board runs. Any change rebuilds the service
    // table, which must not be read as "this consumer needs configuring again".
    await act(async () => {
      (ctx as unknown as BoardContextState).addService(
        { serviceId: "monitor", serviceName: "Monitor" } as any,
        { id: "caller-node", name: "Caller", type: "rest" } as any,
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The board table did change, so the effect really did re-run.
    expect(
      (ctx as unknown as BoardContextState).services["caller-node"],
    ).toHaveLength(2);

    expect(configureService).toHaveBeenCalledTimes(1);
  });
});
