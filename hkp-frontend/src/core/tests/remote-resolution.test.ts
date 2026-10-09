import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreBoard, serializeBoard } from "../boardPersistence";
import type { BoardStateRefs } from "../boardContextTypes";
import { registerRemotePrompt, resetRemotePrompt } from "../remotePrompt";
import { addRuntime } from "../runtimeOperations";

/**
 * A board that names a remote, from load to save.
 *
 * The name is resolved against this client's remotes when the board loads, the
 * runtime is restored at the address that gave, and the board that is saved
 * afterwards says the name again — the address was never the board's.
 */

const asRef = <T>(current: T) => ({ current });

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
  resetRemotePrompt();
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

  it("hands the runtime the board's assets, wherever its address came from", async () => {
    for (const runtime of [{ remote: "Studio" }, { url: "http://h:8080" }]) {
      const { refs, restoreRuntime } = makeRefs();
      const assets = () => [];
      (refs as any).assetsFor = (rt: { id: string }) =>
        rt.id === "rt" ? assets : undefined;

      await restoreBoard(board(runtime), refs, async () => {});

      expect(restoreRuntime.mock.calls[0][4]).toBe(assets);
    }
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

  it("places nothing for a runtime that only says what kind of server would do", async () => {
    // No remote is chosen on a board's behalf, and no server is asked what it
    // is: a runtime lands where it was named or not at all.
    const { refs, restoreRuntime } = makeRefs();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      restoreBoard(
        board({ requires: { kind: "python" } }),
        refs,
        async () => {},
      ),
    ).rejects.toThrow(/names no runtime server/);
    expect(restoreRuntime).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
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

describe("a name this client keeps no server under, with somebody to ask", () => {
  function twoOnNode() {
    return {
      boardName: "b",
      runtimes: [
        { id: "in", name: "Intake", type: "rest", remote: "node" },
        { id: "out", name: "Review", type: "rest", remote: "node" },
      ],
      services: { in: [], out: [] },
    } as any;
  }

  it("restores at the server the person says the name means", async () => {
    const { refs, restoreRuntime } = makeRefs();
    const prompt = vi.fn(async () => ({
      name: "Laptop",
      type: "rest",
      url: "http://laptop:8080",
      aliases: ["node"],
    }));
    registerRemotePrompt(prompt);

    const restored = await restoreBoard(twoOnNode(), refs, async () => {});

    // Asked once for the name, however many runtimes say it, and told what
    // the name stands for.
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith({
      name: "node",
      runtimeName: expect.any(String),
      kind: "hkp-node",
    });
    expect(restoreRuntime.mock.calls.map(([rt]) => rt.url)).toEqual([
      "http://laptop:8080",
      "http://laptop:8080",
    ]);
    // The board still says the name, which is what it saves.
    expect(restored.runtimes.map((rt: any) => rt.remote)).toEqual([
      "node",
      "node",
    ]);
  });

  it("is not asked about a name this client does hold", async () => {
    const { refs } = makeRefs();
    const prompt = vi.fn(async () => null);
    registerRemotePrompt(prompt);

    await restoreBoard(board({ remote: "Studio" }), refs, async () => {});

    expect(prompt).not.toHaveBeenCalled();
  });

  it("fails as before, with nothing built, when the person says none", async () => {
    const { refs, restoreRuntime } = makeRefs();
    registerRemotePrompt(async () => null);

    await expect(
      restoreBoard(
        {
          ...twoOnNode(),
          runtimes: [
            { id: "first", name: "First", type: "rest", remote: "Studio" },
            ...twoOnNode().runtimes,
          ],
          services: { first: [], in: [], out: [] },
        },
        refs,
        async () => {},
      ),
    ).rejects.toThrow(/wants the remote "node"/);
    // Not even the runtime whose name did resolve.
    expect(restoreRuntime).not.toHaveBeenCalled();
  });

  it("does not take an answer that does not answer to the name", async () => {
    // Whatever a prompt hands back, the board lands only on a remote kept
    // under the name it said.
    const { refs, restoreRuntime } = makeRefs();
    registerRemotePrompt(async () => ({
      name: "Laptop",
      type: "rest",
      url: "http://laptop:8080",
    }));

    await expect(
      restoreBoard(board({ remote: "node" }), refs, async () => {}),
    ).rejects.toThrow(/wants the remote "node"/);
    expect(restoreRuntime).not.toHaveBeenCalled();
  });

  it("is not asked about a runtime that is malformed", async () => {
    const { refs } = makeRefs();
    const prompt = vi.fn(async () => null);
    registerRemotePrompt(prompt);

    await expect(
      restoreBoard(
        board({ remote: "Elsewhere", url: "http://evil.example" }),
        refs,
        async () => {},
      ),
    ).rejects.toThrow(/more than once/);
    expect(prompt).not.toHaveBeenCalled();
  });
});

describe("putting a runtime on a server this client keeps", () => {
  const kept = [
    { name: "Browser Runtime", type: "browser" },
    { name: "embedded", type: "rest", url: "hkp://remotes/embedded" },
    { name: "Laptop", type: "rest", url: "http://laptop:8080", aliases: ["node"] },
    { name: "Studio", type: "rest", url: "http://studio:5000" },
  ];

  async function added(url: string) {
    const runtimes: any[] = [];
    const refs = {
      userRef: asRef(null),
      boardNameRef: asRef("board"),
      availableRuntimeEnginesRef: asRef(kept),
      propsRef: asRef({
        runtimeApis: {
          rest: {
            addRuntime: async (rtClass: any) => ({
              runtime: { id: "new", name: rtClass.name, type: "rest", url: rtClass.url },
              services: [],
              registry: [],
              scope: {},
            }),
          },
        },
      }),
      setRuntimes: (update: any) => runtimes.splice(0, runtimes.length, ...update(runtimes)),
      setServices: () => {},
      setRegistry: () => {},
      setScopes: () => {},
    } as unknown as BoardStateRefs;
    return addRuntime(
      { type: "rest", name: "Runtime 1", url } as any,
      refs,
      async () => {},
    );
  }

  it("gives the board the server's name, and keeps the address beside it", async () => {
    expect(await added("http://studio:5000")).toMatchObject({
      remote: "Studio",
      url: "http://studio:5000",
    });
  });

  it("prefers a name boards share over the one the server is listed under", async () => {
    expect(await added("http://laptop:8080")).toMatchObject({ remote: "node" });
  });

  it("calls the runtime a host embeds `embedded`, whatever it is listed as", async () => {
    expect(await added("hkp://remotes/embedded")).toMatchObject({
      remote: "embedded",
    });
  });

  it("gives an address this client keeps nothing under as an address", async () => {
    const runtime = await added("http://elsewhere:9000");

    expect(runtime).toMatchObject({ url: "http://elsewhere:9000" });
    expect(runtime?.remote).toBeUndefined();
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

  it("keeps an address a person wrote", async () => {
    const saved = await serializeBoard(refsWith({ url: "http://h:8080" }));

    expect(saved!.runtimes[0]).toMatchObject({ url: "http://h:8080" });
  });
});
