import React, { useContext, useEffect } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import BoardProvider, {
  BoardContextState,
  BoardCtx,
} from "hkp-frontend/src/BoardContext";
import BrowserRegistry from "hkp-frontend/src/runtime/browser/BrowserRegistry";
import { allowedServices } from "hkp-frontend/src/runtime/browser/BrowserRegistry";
import {
  BoardDescriptor,
  RuntimeApi,
  RuntimeApiMap,
  RuntimeDescriptor,
  ServiceDescriptor,
  isBoardDescriptor,
} from "hkp-frontend/src/types";

const boardModules = import.meta.glob("../../../../boards/*.json", {
  eager: true,
  import: "default",
}) as Record<string, BoardDescriptor>;

const boardEntries = Object.entries(boardModules)
  .map(([modulePath, board]) => ({
    modulePath,
    fileName: modulePath.split("/").at(-1) || modulePath,
    board,
  }))
  .sort((a, b) => a.fileName.localeCompare(b.fileName));

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

function createRuntimeApiMock(
  restoreRuntimeSpy: ReturnType<typeof vi.fn>,
): RuntimeApi {
  return {
    addRuntime: vi.fn(async () => null),
    restoreRuntime: restoreRuntimeSpy,
    removeRuntime: vi.fn(async () => {}),
    processRuntime: vi.fn(async () => {}),
    addService: vi.fn(async () => null),
    removeService: vi.fn(async () => null),
    configureService: vi.fn(async () => ({})),
    getServiceConfig: vi.fn(async () => ({})),
    processService: vi.fn(async () => ({})),
    rearrangeServices: vi.fn(async (_scope, newOrder) => newOrder),
  };
}

function createRuntimeApis(runtimes: RuntimeDescriptor[]): {
  runtimeApis: RuntimeApiMap;
  restoreSpies: Map<string, ReturnType<typeof vi.fn>>;
} {
  const runtimeApis: RuntimeApiMap = {};
  const restoreSpies = new Map<string, ReturnType<typeof vi.fn>>();

  for (const runtime of runtimes) {
    if (runtimeApis[runtime.type]) {
      continue;
    }

    const restoreRuntimeSpy = vi.fn(
      async (
        descriptor: RuntimeDescriptor,
        services: ServiceDescriptor[] = [],
      ) => ({
        runtime: descriptor,
        services,
        scope: { descriptor } as any,
        registry: [],
      }),
    );

    restoreSpies.set(runtime.type, restoreRuntimeSpy);
    runtimeApis[runtime.type] = createRuntimeApiMock(restoreRuntimeSpy);
  }

  return { runtimeApis, restoreSpies };
}

function serviceIdsForRuntime(board: BoardDescriptor, runtimeId: string) {
  return (board.services[runtimeId] || []).map((service) => service.serviceId);
}

function getBoardByFileName(fileName: string): BoardDescriptor {
  const match = boardEntries.find((entry) => entry.fileName === fileName);
  if (!match) {
    throw new Error(`Board fixture not found: ${fileName}`);
  }
  return match.board;
}

describe("demo boards regression", () => {
  describe("structure", () => {
    it("discovers demo boards", () => {
      expect(boardEntries.length).toBeGreaterThan(0);
    });

    for (const { fileName, board } of boardEntries) {
      it(`${fileName} matches board descriptor contract`, () => {
        expect(isBoardDescriptor(board)).toBe(true);

        const runtimeIds = new Set(board.runtimes.map((runtime) => runtime.id));
        expect(runtimeIds.size).toBe(board.runtimes.length);

        for (const runtime of board.runtimes) {
          const services = board.services[runtime.id];
          expect(Array.isArray(services)).toBe(true);

          const uuids = new Set<string>();
          for (const service of services || []) {
            expect(typeof service.uuid).toBe("string");
            expect(service.uuid.length).toBeGreaterThan(0);
            expect(typeof service.serviceId).toBe("string");
            expect(service.serviceId.length).toBeGreaterThan(0);
            expect(typeof service.serviceName).toBe("string");
            expect(service.serviceName.length).toBeGreaterThan(0);
            expect(uuids.has(service.uuid)).toBe(false);
            uuids.add(service.uuid);
          }
        }

        for (const runtimeId of Object.keys(board.services)) {
          expect(runtimeIds.has(runtimeId)).toBe(true);
        }
      });
    }
  });

  describe("browser service resolution", () => {
    let browserRegistry: BrowserRegistry;

    beforeAll(async () => {
      browserRegistry = await BrowserRegistry.create();
    });

    for (const { fileName, board } of boardEntries) {
      it(`${fileName} resolves browser service modules`, () => {
        for (const runtime of board.runtimes) {
          if (runtime.type !== "browser") {
            continue;
          }

          for (const service of board.services[runtime.id] || []) {
            const module = browserRegistry.findServiceModule(service.serviceId);
            const allowlisted = allowedServices.includes(service.serviceId);
            expect(
              module || allowlisted,
              `${fileName} references missing browser service: ${service.serviceId}`,
            ).toBeTruthy();
          }
        }
      });
    }
  });

  describe("restore smoke", () => {
    for (const { fileName, board } of boardEntries) {
      it(`restores ${fileName} through BoardProvider setBoardState`, async () => {
        const { runtimeApis, restoreSpies } = createRuntimeApis(board.runtimes);
        let latestCtx: BoardContextState | null = null;

        render(
          <BoardProvider
            user={null}
            boardName="demo-regression"
            runtimeApis={runtimeApis}
            onRemoveRuntime={vi.fn(async () => {})}
            initialState={{
              runtimes: [],
              services: {},
              scopes: {},
              registry: {},
            }}
          >
            <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
          </BoardProvider>,
        );

        await waitFor(() => expect(latestCtx).toBeTruthy());

        await act(async () => {
          await latestCtx!.setBoardState(board);
        });

        await waitFor(() => {
          expect(latestCtx!.runtimes.map((runtime) => runtime.id)).toEqual(
            board.runtimes.map((runtime) => runtime.id),
          );
        });

        for (const runtime of board.runtimes) {
          expect(latestCtx!.services[runtime.id]).toHaveLength(
            (board.services[runtime.id] || []).length,
          );
        }

        const expectedRestoreCallsByType = board.runtimes.reduce(
          (all, runtime) => ({
            ...all,
            [runtime.type]: (all[runtime.type] || 0) + 1,
          }),
          {} as Record<string, number>,
        );

        for (const [runtimeType, restoreSpy] of restoreSpies.entries()) {
          expect(restoreSpy).toHaveBeenCalledTimes(
            expectedRestoreCallsByType[runtimeType] || 0,
          );
        }
      });
    }
  });

  describe("board contracts", () => {
    it("animate board includes animation pipeline services", () => {
      const board = getBoardByFileName("animate-board.json");
      expect(board.runtimes).toHaveLength(1);

      const runtimeId = board.runtimes[0].id;
      expect(serviceIdsForRuntime(board, runtimeId)).toEqual([
        "hookup.to/service/timer",
        "hookup.to/service/stack",
        "hookup.to/service/monitor",
        "hookup.to/service/canvas",
        "hookup.to/service/gif-encoder",
      ]);
    });

    it("game of life board includes visual and audio branches", () => {
      const board = getBoardByFileName("game-of-life-board.json");
      expect(board.runtimes).toHaveLength(1);
      const runtimeId = board.runtimes[0].id;

      const topLevelServiceIds = serviceIdsForRuntime(board, runtimeId);
      expect(topLevelServiceIds).toEqual([
        "hookup.to/service/timer",
        "hookup.to/service/game-of-life",
        "hookup.to/service/stack",
      ]);

      const stackService = (board.services[runtimeId] || []).find(
        (service) => service.serviceId === "hookup.to/service/stack",
      ) as any;
      expect(stackService).toBeTruthy();

      const branchServiceIds = (stackService.state?.services || []).flatMap(
        (branch: any) =>
          (branch.pipeline || []).map((step: any) => step.serviceId),
      );

      expect(branchServiceIds).toEqual([
        "hookup.to/service/game-of-life-renderer",
        "hookup.to/service/canvas",
        "hookup.to/service/map",
        "hookup.to/service/map",
        "hookup.to/service/sort",
        "hookup.to/service/limit",
        "hookup.to/service/map",
        "hookup.to/service/sound",
      ]);
    });

    it("encrypt board keeps separate encrypt and decrypt runtimes", () => {
      const board = getBoardByFileName("encrypt-board.json");
      expect(board.runtimes).toHaveLength(2);

      const encryptRuntime = board.runtimes.find(
        (runtime) => runtime.name === "Encrypt",
      );
      const decryptRuntime = board.runtimes.find(
        (runtime) => runtime.name === "Decrypt",
      );

      expect(encryptRuntime).toBeTruthy();
      expect(decryptRuntime).toBeTruthy();

      const encryptServices = serviceIdsForRuntime(board, encryptRuntime!.id);
      const decryptServices = serviceIdsForRuntime(board, decryptRuntime!.id);

      expect(encryptServices).toEqual([
        "hookup.to/service/injector",
        "hookup.to/service/encrypt",
        "hookup.to/service/monitor",
      ]);
      expect(decryptServices).toEqual([
        "hookup.to/service/decrypt",
        "hookup.to/service/monitor",
      ]);
    });
  });
});
