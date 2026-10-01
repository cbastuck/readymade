import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreBoard, serializeBoard } from "../boardPersistence";
import type { BoardStateRefs } from "../boardContextTypes";

/**
 * A board that names a remote, from load to save.
 *
 * The name is resolved against this client's remotes when the board loads, the
 * runtime is restored at the address that gave, and the board that is saved
 * afterwards says the name again — the address was never the board's.
 */

const asRef = <T,>(current: T) => ({ current });

const remotes = [
  { name: "Laptop", type: "rest", url: "http://laptop:8080" },
  { name: "Studio", type: "rest", url: "http://studio:5000" },
];

function makeRefs(resolvesAddress = true) {
  const restoreRuntime = vi.fn(async (runtime: any) => ({
    runtime,
    services: [],
    scope: {},
    registry: [],
  }));
  const refs = {
    userRef: asRef({ idToken: "token-1", userId: "u" }),
    boardNameRef: asRef("board"),
    availableRuntimeEnginesRef: asRef(remotes),
    propsRef: asRef({
      user: null,
      runtimeApis: { rest: { resolvesAddress, restoreRuntime } },
    }),
  } as unknown as BoardStateRefs;
  return { refs, restoreRuntime };
}

function board(runtime: Record<string, unknown>) {
  return {
    boardName: "b",
    runtimes: [{ id: "rt", name: "RT", type: "rest", ...runtime }],
    services: { rt: [] },
  } as any;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("restoring a board that names a remote", () => {
  it("restores the runtime at the address the name resolves to here", async () => {
    const { refs, restoreRuntime } = makeRefs();

    const restored = await restoreBoard(
      board({ remote: "Studio" }),
      refs,
      async () => {},
    );

    expect(restoreRuntime.mock.calls[0][0]).toMatchObject({
      id: "rt",
      remote: "Studio",
      url: "http://studio:5000",
    });
    expect(restored.runtimes[0]).toMatchObject({ remote: "Studio" });
  });

  it("fails, naming the remote, when this client does not hold the name", async () => {
    const { refs, restoreRuntime } = makeRefs();

    await expect(
      restoreBoard(board({ remote: "Elsewhere" }), refs, async () => {}),
    ).rejects.toThrow(/Elsewhere/);
    expect(restoreRuntime).not.toHaveBeenCalled();
  });

  it("refuses a runtime carrying both a name and an address", async () => {
    // The shape a hostile board would use: an unresolvable name with an
    // address behind it. Neither is dialled.
    const { refs, restoreRuntime } = makeRefs();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      restoreBoard(
        board({ remote: "Elsewhere", url: "http://evil.example" }),
        refs,
        async () => {},
      ),
    ).rejects.toThrow(/more than once/);
    expect(restoreRuntime).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("places a requirement by asking this client's remotes what they are", async () => {
    const { refs, restoreRuntime } = makeRefs();
    const fetchMock = vi.fn(async (url: string) => {
      const server = url.startsWith("http://studio") ? "python" : "node";
      return new Response(JSON.stringify({ runtimes: [], server }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await restoreBoard(
      board({ requires: { kind: "python" } }),
      refs,
      async () => {},
    );

    expect(restoreRuntime.mock.calls[0][0]).toMatchObject({
      requires: { kind: "python" },
      url: "http://studio:5000",
    });
    // Asked as the person, the way every other call to those servers is.
    expect(fetchMock).toHaveBeenCalledWith("http://laptop:8080/runtimes", {
      headers: { Authorization: "Bearer token-1" },
    });
  });

  it("leaves a board that only has addresses exactly as it was", async () => {
    const { refs, restoreRuntime } = makeRefs();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await restoreBoard(board({ url: "http://h:8080" }), refs, async () => {});

    expect(restoreRuntime.mock.calls[0][0]).toEqual({
      id: "rt",
      name: "RT",
      type: "rest",
      url: "http://h:8080",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not resolve for an api that dials nothing", async () => {
    // A board attached through its coordinator: the name is a label there, and
    // this client may well not hold it.
    const { refs, restoreRuntime } = makeRefs(false);

    await restoreBoard(board({ remote: "Elsewhere" }), refs, async () => {});

    expect(restoreRuntime.mock.calls[0][0]).toEqual({
      id: "rt",
      name: "RT",
      type: "rest",
      remote: "Elsewhere",
    });
  });
});

describe("saving a board that named a remote", () => {
  function refsWith(runtime: Record<string, unknown>) {
    return {
      runtimesRef: asRef([{ id: "rt", name: "RT", type: "rest", ...runtime }]),
      servicesRef: asRef({ rt: [] }),
      scopesRef: asRef({}),
      propsRef: asRef({ runtimeApis: {} }),
    } as unknown as BoardStateRefs;
  }

  it("writes the name back and never the address it resolved to", async () => {
    const saved = await serializeBoard(
      refsWith({ remote: "Studio", url: "http://studio:5000" }),
    );

    expect(saved!.runtimes[0]).toMatchObject({ remote: "Studio" });
    expect(saved!.runtimes[0]).not.toHaveProperty("url");
  });

  it("writes a requirement back the same way", async () => {
    const saved = await serializeBoard(
      refsWith({ requires: { kind: "python" }, url: "http://studio:5000" }),
    );

    expect(saved!.runtimes[0]).toMatchObject({ requires: { kind: "python" } });
    expect(saved!.runtimes[0]).not.toHaveProperty("url");
  });

  it("keeps an address a person wrote", async () => {
    const saved = await serializeBoard(refsWith({ url: "http://h:8080" }));

    expect(saved!.runtimes[0]).toMatchObject({ url: "http://h:8080" });
  });
});
