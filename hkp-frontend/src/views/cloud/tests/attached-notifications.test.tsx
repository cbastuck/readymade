import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";

import BoardProvider, {
  BoardProviderHandle,
  useBoardContext,
} from "hkp-frontend/src/BoardContext";
import { createBoardCoordinator } from "hkp-frontend/src/core/coordinator";
import { createBridgeRuntimeApi } from "../bridgeRuntimeApi";
import { CoordinatorSnapshotStore } from "../coordinatorSnapshot";
import { useCoordinatorBridge } from "../useCoordinatorBridge";
import CloudBoard from "../Board";

/**
 * What a service on an attached cloud board says, and whether the panel hears
 * it. A Monitor's output is not part of its state — it exists only as a
 * notification — so a browser that renders the board but misses those shows an
 * empty panel for a board that is plainly running.
 *
 * The board here is set twice: once from the coordinator's listing (what
 * opening a board by URL does, before any snapshot has arrived) and again from
 * the snapshot. Each restore builds fresh scopes, and the panels must follow.
 */

const board = {
  boardName: "board-1",
  runtimes: [
    { id: "node", name: "Node", type: "rest", url: "http://unreachable:8080" },
  ],
  services: {
    node: [
      { uuid: "timer-1", serviceId: "timer" },
      { uuid: "mon-1", serviceId: "monitor" },
    ],
  },
};

const sockets: FakeSocket[] = [];

/** The bridge socket, driven by the test rather than a coordinator. */
class FakeSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send(_data: string) {}
  close() {
    this.readyState = 3;
  }
  deliver(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const handleRef = { current: null as BoardProviderHandle | null };

function AttachedBoard({ snapshot }: { snapshot: CoordinatorSnapshotStore }) {
  const boardContext = useBoardContext();
  const { ws } = useCoordinatorBridge(
    "ws://coordinator.test/coordinator/bridge",
    "user-1",
    "board-1",
    boardContext,
    null,
    snapshot,
  );

  const hydrated = useRef(false);
  useEffect(() => {
    const hydrate = () => {
      const config = snapshot.getConfig();
      if (!config || hydrated.current) {
        return;
      }
      hydrated.current = true;
      handleRef.current?.setBoardState(config as never);
    };
    hydrate();
    return snapshot.subscribe(hydrate);
  }, [snapshot]);

  if (!boardContext) {
    return null;
  }
  return (
    <CloudBoard
      boardContext={boardContext}
      boardName="board-1"
      bridgeWs={ws as never}
    />
  );
}

describe("a monitor on an attached cloud board", () => {
  beforeEach(() => {
    sockets.length = 0;
    handleRef.current = null;
    vi.stubGlobal("WebSocket", FakeSocket);
  });

  it("shows what the coordinator forwards, across a re-restore", async () => {
    const snapshot = new CoordinatorSnapshotStore();
    const api = createBridgeRuntimeApi({
      snapshot,
      configureRemoteService: async () => ({}),
    });

    render(
      <BoardProvider
        ref={(handle) => {
          handleRef.current = handle;
        }}
        user={{ userId: "user-1", idToken: "t" } as never}
        coordinator={createBoardCoordinator(() => ({}) as never)}
        runtimeApis={{ rest: api } as never}
        availableRuntimeEngines={[]}
        onRemoveRuntime={async () => {}}
        onUnmountRuntime={() => {}}
      >
        <AttachedBoard snapshot={snapshot} />
      </BoardProvider>,
    );

    await waitFor(() => expect(sockets.length).toBe(1));
    const bridge = sockets[0];

    // Opening by URL renders the board from the listing before the coordinator
    // has said anything.
    handleRef.current?.setBoardState(board as never);
    await waitFor(() => expect(screen.getByText(/[Mm]onitor/)).toBeTruthy());

    bridge.deliver({
      type: "snapshot",
      seq: 1,
      boardName: "board-1",
      status: "running",
      config: board,
      runtimes: [
        {
          runtimeId: "node",
          registry: [
            { serviceId: "monitor", serviceName: "Monitor" },
            { serviceId: "timer", serviceName: "Timer" },
          ],
          services: { "mon-1": { logToConsole: true }, "timer-1": {} },
        },
      ],
    });
    await waitFor(() => expect(screen.getByText(/[Mm]onitor/)).toBeTruthy());

    bridge.deliver({
      type: "notification",
      runtimeId: "node",
      serviceUuid: "mon-1",
      payload: { triggerCount: 7 },
    });

    await waitFor(() =>
      expect(screen.getByDisplayValue(/triggerCount/)).toBeTruthy(),
    );
  });
});
