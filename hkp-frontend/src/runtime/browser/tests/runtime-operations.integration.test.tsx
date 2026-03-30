import React, { useContext, useEffect } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import BoardProvider, {
  BoardCtx,
  BoardContextState,
} from "hkp-frontend/src/BoardContext";
import { RuntimeApiMap, RuntimeClass, RuntimeDescriptor } from "hkp-frontend/src/types";

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

function makeApi(overrides: Record<string, unknown> = {}) {
  const defaultApi = {
    addRuntime: vi.fn(async () => {}),
    removeRuntime: vi.fn(async () => {}),
    restoreRuntime: vi.fn(),
    processRuntime: vi.fn(),
    addService: vi.fn(async () => ({})),
    removeService: vi.fn(async () => {}),
    configureService: vi.fn(async () => {}),
    getServiceConfig: vi.fn(async () => ({})),
    processService: vi.fn(),
    rearrangeServices: vi.fn(async (_: unknown, svcs: unknown) => svcs),
  };
  return { ...defaultApi, ...overrides } as any;
}

function makeRuntime(id: string, name = "Runtime"): RuntimeDescriptor {
  return { id, name, type: "browser" };
}

function renderWithRuntimes(
  api: any,
  runtimes: RuntimeDescriptor[],
  extraProps: Record<string, unknown> = {},
) {
  const runtimeApis: RuntimeApiMap = { browser: api };
  const scopes = Object.fromEntries(
    runtimes.map((rt) => [rt.id, { id: `scope-${rt.id}` } as any]),
  );
  let latestCtx: BoardContextState | null = null;

  render(
    <BoardProvider
      user={null}
      boardName="test-board"
      runtimeApis={runtimeApis}
      onRemoveRuntime={vi.fn(async () => {})}
      initialState={{
        runtimes,
        services: Object.fromEntries(runtimes.map((rt) => [rt.id, []])),
        scopes,
        registry: Object.fromEntries(runtimes.map((rt) => [rt.id, []])),
      }}
      {...(extraProps as any)}
    >
      <ContextProbe onChange={(ctx) => (latestCtx = ctx)} />
    </BoardProvider>,
  );

  return { getCtx: () => latestCtx };
}

describe("runtime operations integration", () => {
  describe("arrangeRuntime", () => {
    it("reorders two runtimes", async () => {
      const rtA = makeRuntime("rt-a", "Runtime A");
      const rtB = makeRuntime("rt-b", "Runtime B");
      const api = makeApi();
      const { getCtx } = renderWithRuntimes(api, [rtA, rtB]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      // reorderRuntime adjusts position for post-removal indexing when moving
      // forward: position 2 places rt-a after rt-b in a 2-element array.
      await act(async () => {
        await getCtx()!.arrangeRuntime(rtA.id, 2);
      });

      await waitFor(() => {
        expect(getCtx()!.runtimes.map((r) => r.id)).toEqual(["rt-b", "rt-a"]);
      });
    });

    it("moving the last item to position 0 puts it first", async () => {
      const rtA = makeRuntime("rt-a");
      const rtB = makeRuntime("rt-b");
      const rtC = makeRuntime("rt-c");
      const api = makeApi();
      const { getCtx } = renderWithRuntimes(api, [rtA, rtB, rtC]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.arrangeRuntime(rtC.id, 0);
      });

      await waitFor(() => {
        expect(getCtx()!.runtimes[0].id).toBe("rt-c");
      });
    });
  });

  describe("setRuntimeName", () => {
    it("updates the name of the target runtime", async () => {
      const rt = makeRuntime("rt-rename", "Old Name");
      const api = makeApi();
      const { getCtx } = renderWithRuntimes(api, [rt]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.setRuntimeName(rt.id, "New Name");
      });

      await waitFor(() => {
        expect(getCtx()!.runtimes[0].name).toBe("New Name");
      });
    });

    it("only renames the targeted runtime", async () => {
      const rtA = makeRuntime("rt-a", "Alpha");
      const rtB = makeRuntime("rt-b", "Beta");
      const api = makeApi();
      const { getCtx } = renderWithRuntimes(api, [rtA, rtB]);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        await getCtx()!.setRuntimeName(rtA.id, "Alpha Renamed");
      });

      await waitFor(() => {
        expect(getCtx()!.runtimes[0].name).toBe("Alpha Renamed");
      });
      expect(getCtx()!.runtimes[1].name).toBe("Beta");
    });
  });

  describe("addAvailableRuntime", () => {
    it("appends a new runtime class to availableRuntimeEngines", async () => {
      const api = makeApi();
      const { getCtx } = renderWithRuntimes(api, []);
      await waitFor(() => expect(getCtx()).toBeTruthy());

      const rtClass: RuntimeClass = { name: "My Runtime", type: "browser", color: "#f00" };

      await act(async () => {
        getCtx()!.addAvailableRuntime(rtClass, false);
      });

      await waitFor(() => {
        const engines = getCtx()!.availableRuntimeEngines;
        expect(engines.some((e) => e.name === "My Runtime")).toBe(true);
      });
    });

    it("replaces an existing entry when overwriteIfExists is true", async () => {
      const api = makeApi();
      const rtClass: RuntimeClass = { name: "My Runtime", type: "browser", color: "#f00" };

      const { getCtx } = renderWithRuntimes(api, [], {
        availableRuntimeEngines: [rtClass],
      });
      await waitFor(() => expect(getCtx()).toBeTruthy());

      const updated: RuntimeClass = { name: "My Runtime", type: "browser", color: "#0f0" };

      await act(async () => {
        getCtx()!.addAvailableRuntime(updated, true);
      });

      await waitFor(() => {
        const engines = getCtx()!.availableRuntimeEngines;
        const match = engines.filter((e) => e.name === "My Runtime");
        expect(match).toHaveLength(1);
        expect(match[0].color).toBe("#0f0");
      });
    });

    it("does not replace when overwriteIfExists is false", async () => {
      const api = makeApi();
      const rtClass: RuntimeClass = { name: "My Runtime", type: "browser", color: "#f00" };

      const { getCtx } = renderWithRuntimes(api, [], {
        availableRuntimeEngines: [rtClass],
      });
      await waitFor(() => expect(getCtx()).toBeTruthy());

      const duplicate: RuntimeClass = { name: "My Runtime", type: "browser", color: "#0f0" };

      await act(async () => {
        getCtx()!.addAvailableRuntime(duplicate, false);
      });

      await waitFor(() => {
        const engines = getCtx()!.availableRuntimeEngines;
        expect(engines.filter((e) => e.name === "My Runtime")).toHaveLength(2);
      });
    });
  });

  describe("removeAvailableRuntime", () => {
    it("removes the named runtime class from availableRuntimeEngines", async () => {
      const api = makeApi();
      const rtClass: RuntimeClass = { name: "Removable Runtime", type: "browser" };

      const { getCtx } = renderWithRuntimes(api, [], {
        availableRuntimeEngines: [rtClass],
      });
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        getCtx()!.removeAvailableRuntime(rtClass);
      });

      await waitFor(() => {
        const engines = getCtx()!.availableRuntimeEngines;
        expect(engines.some((e) => e.name === "Removable Runtime")).toBe(false);
      });
    });

    it("keeps other entries intact", async () => {
      const api = makeApi();
      const keep: RuntimeClass = { name: "Keep Me", type: "browser" };
      const remove: RuntimeClass = { name: "Remove Me", type: "browser" };

      const { getCtx } = renderWithRuntimes(api, [], {
        availableRuntimeEngines: [keep, remove],
      });
      await waitFor(() => expect(getCtx()).toBeTruthy());

      await act(async () => {
        getCtx()!.removeAvailableRuntime(remove);
      });

      await waitFor(() => {
        const engines = getCtx()!.availableRuntimeEngines;
        expect(engines.some((e) => e.name === "Keep Me")).toBe(true);
        expect(engines.some((e) => e.name === "Remove Me")).toBe(false);
      });
    });
  });
});
