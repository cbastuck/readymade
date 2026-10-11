import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isAllowedUnasked,
  isBlockedAsMixedContent,
  reachesServer,
  registerReachPrompt,
  requestFromServer,
  resetRuntimeReach,
  type ReachDecision,
} from "../runtimeReach";

/**
 * A runtime server that gives this page no answer: asking what to do, and
 * making the request again once somebody has done it.
 */

const server = { url: "http://127.0.0.1:8080", runtimeName: "Node" };

// What `fetch` rejects with when nothing could be read.
const noAnswer = () => Promise.reject(new TypeError("Failed to fetch"));
const answered = () => Promise.resolve(new Response("{}", { status: 200 }));

afterEach(() => {
  resetRuntimeReach();
  vi.restoreAllMocks();
});

describe("a request to a server that gives no answer", () => {
  it("fails as it always did when nobody can be asked", async () => {
    await expect(requestFromServer(server, noAnswer)).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("is made again once the person says the server should answer now", async () => {
    const asked = vi.fn(async (): Promise<ReachDecision> => "retry");
    registerReachPrompt(asked);
    const request = vi
      .fn<() => Promise<Response>>()
      .mockImplementationOnce(noAnswer)
      .mockImplementationOnce(noAnswer)
      .mockImplementationOnce(answered);

    const response = await requestFromServer(server, request);

    expect(response.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(3);
    expect(asked).toHaveBeenCalledTimes(2);
    expect(asked).toHaveBeenCalledWith(server);
  });

  it("fails with the original error when the person gives up", async () => {
    registerReachPrompt(async () => "give-up");
    const request = vi.fn(noAnswer);

    await expect(requestFromServer(server, request)).rejects.toThrow(
      "Failed to fetch",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("asks once for a server several runtimes are waiting on", async () => {
    let settle: (decision: ReachDecision) => void = () => {};
    const asked = vi.fn(
      () => new Promise<ReachDecision>((resolve) => (settle = resolve)),
    );
    registerReachPrompt(asked);
    let up = false;
    const request = () => (up ? answered() : noAnswer());

    const waiting = Promise.all([
      requestFromServer({ ...server, runtimeName: "A" }, request),
      requestFromServer({ ...server, runtimeName: "B" }, request),
      requestFromServer(
        { url: "http://127.0.0.1:8080/", runtimeName: "C" },
        request,
      ),
    ]);
    await vi.waitFor(() => expect(asked).toHaveBeenCalled());
    up = true;
    settle("retry");

    expect((await waiting).map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it("asks separately about separate servers", async () => {
    const asked = vi.fn(async (): Promise<ReachDecision> => "give-up");
    registerReachPrompt(asked);

    await Promise.allSettled([
      requestFromServer(server, noAnswer),
      requestFromServer(
        { url: "http://127.0.0.1:8887", runtimeName: "RT" },
        noAnswer,
      ),
    ]);

    expect(asked).toHaveBeenCalledTimes(2);
  });

  it("does not ask about an answer it did get, however unwelcome", async () => {
    const asked = vi.fn(async (): Promise<ReachDecision> => "retry");
    registerReachPrompt(asked);

    const response = await requestFromServer(server, () =>
      Promise.resolve(new Response("", { status: 401 })),
    );

    expect(response.status).toBe(401);
    expect(asked).not.toHaveBeenCalled();
  });

  it("does not ask about a failure that is something else", async () => {
    const asked = vi.fn(async (): Promise<ReachDecision> => "retry");
    registerReachPrompt(asked);

    await expect(
      requestFromServer(server, () => Promise.reject(new Error("aborted"))),
    ).rejects.toThrow("aborted");
    expect(asked).not.toHaveBeenCalled();
  });

  it("does not ask about a runtime that is not reached over the network", async () => {
    const asked = vi.fn(async (): Promise<ReachDecision> => "retry");
    registerReachPrompt(asked);

    await expect(
      requestFromServer(
        { url: "hkp://remotes/meander-cpp", runtimeName: "Embedded" },
        noAnswer,
      ),
    ).rejects.toThrow("Failed to fetch");
    expect(asked).not.toHaveBeenCalled();
  });

  it("asks whoever registered last, and the one before once that has left", async () => {
    const first = vi.fn(async (): Promise<ReachDecision> => "give-up");
    const second = vi.fn(async (): Promise<ReachDecision> => "give-up");
    registerReachPrompt(first);
    const leave = registerReachPrompt(second);

    await requestFromServer(server, noAnswer).catch(() => {});
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();

    leave();
    await requestFromServer(server, noAnswer).catch(() => {});
    expect(first).toHaveBeenCalledTimes(1);
  });
});

describe("checking whether a server answers this page", () => {
  it("counts any answer, a refusal for want of a token included", async () => {
    const fetched = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 401 }));

    expect(await reachesServer("http://127.0.0.1:8080/")).toBe(true);
    // Nothing a browser would ask permission for first.
    expect(fetched).toHaveBeenCalledWith("http://127.0.0.1:8080/runtimes");
  });

  it("is no when nothing could be read", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(noAnswer);

    expect(await reachesServer("http://127.0.0.1:8080")).toBe(false);
  });
});

describe("what to tell somebody", () => {
  it("knows the pages a server allows without being told", () => {
    for (const origin of [
      "http://localhost:5173",
      "http://127.0.0.1:8555",
      "http://[::1]:3000",
      "saucer://embedded",
      "hkp://app",
      "https://appassets.androidplatform.net",
    ]) {
      expect(isAllowedUnasked(origin), origin).toBe(true);
    }
    for (const origin of [
      "https://readymadeit.com",
      "http://localhost.evil.example",
      "http://127.0.0.1.evil.example",
      "http://192.168.1.5:9090",
      "null",
    ]) {
      expect(isAllowedUnasked(origin), origin).toBe(false);
    }
  });

  it("knows when the browser, not the server, is what stops the request", () => {
    expect(
      isBlockedAsMixedContent(
        "https://readymadeit.com/playground",
        "http://192.168.1.5:8080",
      ),
    ).toBe(true);
    // A page may call the machine it is shown on over http.
    expect(
      isBlockedAsMixedContent(
        "https://readymadeit.com/playground",
        "http://127.0.0.1:8080",
      ),
    ).toBe(false);
    expect(
      isBlockedAsMixedContent(
        "http://localhost:5173/",
        "http://192.168.1.5:8080",
      ),
    ).toBe(false);
    expect(
      isBlockedAsMixedContent(
        "https://readymadeit.com/",
        "https://node.example.com",
      ),
    ).toBe(false);
  });
});
