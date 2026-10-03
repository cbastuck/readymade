import { useContext, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, { BoardCtx, BoardContextState } from "hkp-frontend/src/BoardContext";
import { AssetDescriptor } from "hkp-frontend/src/runtime/board/assets";
import { RuntimeApiMap, RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * An edit to assets belongs to the board it was started on.
 *
 * It is several steps with a runtime answering in between. When another board
 * replaces the one it was started on, the steps still to come would be taken on
 * that board's runtimes and assets — so they are not taken.
 */

const relay = {
  id: "relay",
  name: "Relay",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const page: AssetDescriptor = { id: "page", mediaType: "text/html", text: "<p>v1</p>" };
const player: AssetDescriptor = { ...page, id: "player" };

function ContextProbe({ onChange }: { onChange: (ctx: BoardContextState | null) => void }) {
  const ctx = useContext(BoardCtx);
  useEffect(() => {
    onChange(ctx);
  }, [ctx, onChange]);
  return null;
}

async function boardOn(api: Record<string, unknown>) {
  let context: BoardContextState | null = null;
  render(
    <BoardProvider
      user={null}
      runtimeApis={{ rest: api } as unknown as RuntimeApiMap}
      onRemoveRuntime={async () => {}}
      initialState={{
        runtimes: [relay],
        services: { relay: [{ uuid: "radio", serviceId: "x", serviceName: "Radio" } as never] },
        registry: {},
        scopes: { relay: {} as never },
      }}
    >
      <ContextProbe onChange={(ctx) => (context = ctx)} />
    </BoardProvider>,
  );
  await waitFor(() => expect(context).not.toBeNull());
  return () => context as unknown as BoardContextState;
}

describe("an asset edit and the board it was started on", () => {
  it("renames on the runtimes, then removes the old id", async () => {
    const pushAssets = vi.fn(async () => null);
    const configureService = vi.fn(async () => ({}));
    const board = await boardOn({
      getServiceConfig: async () => ({ body: "hkp-asset://page" }),
      pushAssets,
      configureService,
      removeRuntime: async () => {},
    });
    await act(async () => {
      await board().setAsset(page);
    });
    pushAssets.mockClear();

    let failures: unknown;
    await act(async () => {
      failures = await board().setAsset(player, "page");
    });

    expect(failures).toEqual([]);
    expect(pushAssets.mock.calls.map(([, push]) => push)).toEqual([{ player }, { page: null }]);
    expect(configureService).toHaveBeenCalledTimes(1);
    expect(board().assets).toEqual([player]);
  });

  it("puts the board back when a runtime does not take the renamed asset", async () => {
    const pushAssets = vi.fn(async (): Promise<string | null> => null);
    const configureService = vi.fn(async () => ({}));
    const board = await boardOn({
      getServiceConfig: async () => ({ body: "hkp-asset://page" }),
      pushAssets,
      configureService,
      removeRuntime: async () => {},
    });
    await act(async () => {
      await board().setAsset(page);
    });
    pushAssets.mockResolvedValue("Relay answered 503");

    await act(async () => {
      await expect(board().setAsset(player, "page")).rejects.toThrow("Relay answered 503");
    });

    expect(configureService).not.toHaveBeenCalled();
    expect(board().assets).toEqual([page]);
  });

  it("stops a rename when another board is opened before the runtime answers", async () => {
    let answer: (problem: string | null) => void = () => {};
    const pushAssets = vi.fn(async (): Promise<string | null> => null);
    const configureService = vi.fn(async () => ({}));
    const board = await boardOn({
      getServiceConfig: async () => ({ body: "hkp-asset://page" }),
      pushAssets,
      configureService,
      removeRuntime: async () => {},
    });
    await act(async () => {
      await board().setAsset(page);
    });
    // The runtime is slow to take the renamed asset.
    pushAssets.mockImplementation(
      () => new Promise<string | null>((resolve) => (answer = resolve)),
    );

    let renaming: Promise<unknown> = Promise.resolve();
    await act(async () => {
      renaming = board().setAsset(player, "page");
    });
    await waitFor(() => expect(pushAssets).toHaveBeenCalledTimes(2));
    // Both ids resolve while the runtimes are moved from one to the other.
    expect(board().assets).toEqual([page, player]);
    await act(async () => {
      await board().clearBoard();
    });
    expect(board().assets).toBeUndefined();

    // It did not take it, which would have put the old board's assets back.
    await act(async () => {
      answer("Relay answered 503");
      expect(await renaming).toEqual([]);
    });

    expect(configureService).not.toHaveBeenCalled();
    expect(board().assets).toBeUndefined();
  });

  it("refuses an edit while a board is being replaced", async () => {
    let cleared: () => void = () => {};
    const board = await boardOn({
      getServiceConfig: async () => ({}),
      pushAssets: async () => null,
      configureService: async () => ({}),
      removeRuntime: () => new Promise<void>((resolve) => (cleared = resolve)),
    });

    let clearing: Promise<unknown> = Promise.resolve();
    await act(async () => {
      clearing = board().clearBoard();
    });
    await expect(board().setAsset(page)).rejects.toThrow("the board is being replaced");
    await expect(board().deleteAsset("page")).rejects.toThrow("the board is being replaced");

    await act(async () => {
      cleared();
      await clearing;
    });
    expect(board().assets).toBeUndefined();
  });
});
