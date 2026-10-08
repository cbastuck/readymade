import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { FloatRingBufferSymbol } from "../../../runtime/rest/Data";
import { BoardContextState } from "../../../BoardContext";
import {
  decodeBinaryFrame,
  encodeBinaryFrame,
  fromBinaryValue,
  toBinaryValue,
} from "../bridgeBinary";
import { useCoordinatorBridge } from "../useCoordinatorBridge";

/**
 * Values that hold bytes, crossing the coordinator bridge.
 *
 * The bridge carries JSON as text. Bytes sent that way reach the next runtime
 * as an object of numbered keys, so they travel as a binary frame — the same
 * frame the coordinator and the runtime servers use.
 */

// A frame as hkp-node's encoder writes it: a processRuntime for "ui" carrying
// { meta: { name: "a.bin" }, binary: [0, 1, 254, 255] }. The same bytes are
// read by hkp-node's and hkp-python's tests.
const NODE_FRAME =
  "000000777b2274797065223a2270726f6365737352756e74696d65222c2272756e74696d654964223a227569222c22726571756573744964223a22722d31222c2262696e617279223a7b226b696e64223a226d69786564222c226a736f6e223a7b226d657461223a7b226e616d65223a22612e62696e227d7d7d7d0001feff";

function hex(value: string): ArrayBuffer {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return out.buffer;
}

function asBuffer(frame: Uint8Array): ArrayBuffer {
  return frame.buffer.slice(
    frame.byteOffset,
    frame.byteOffset + frame.byteLength,
  ) as ArrayBuffer;
}

describe("the frame a value holding bytes travels in", () => {
  it("reads what the coordinator's encoder wrote", () => {
    const decoded = decodeBinaryFrame(hex(NODE_FRAME));

    expect(decoded?.header).toEqual({
      type: "processRuntime",
      runtimeId: "ui",
      requestId: "r-1",
    });
    expect(fromBinaryValue(decoded!.value)).toEqual({
      meta: { name: "a.bin" },
      binary: new Uint8Array([0, 1, 254, 255]),
    });
  });

  it("gives back what it was given", () => {
    const frame = encodeBinaryFrame(
      { type: "result", requestId: "r-2" },
      { shape: { kind: "bytes" }, bytes: new Uint8Array([9, 8, 7]) },
    );

    const decoded = decodeBinaryFrame(asBuffer(frame));

    expect(decoded?.header).toEqual({ type: "result", requestId: "r-2" });
    expect(decoded?.value.shape).toEqual({ kind: "bytes" });
    expect([...decoded!.value.bytes]).toEqual([9, 8, 7]);
  });

  it("is not read when it is cut short or says nothing about its payload", () => {
    expect(decodeBinaryFrame(new Uint8Array([0, 0]).buffer)).toBeNull();
    expect(decodeBinaryFrame(new Uint8Array([0, 0, 0, 9, 123]).buffer)).toBeNull();
    const untyped = new TextEncoder().encode('{"type":"result"}');
    const frame = new Uint8Array(4 + untyped.length);
    new DataView(frame.buffer).setUint32(0, untyped.length);
    frame.set(untyped, 4);
    expect(decodeBinaryFrame(frame.buffer)).toBeNull();
  });
});

describe("what a browser runtime sends as bytes", () => {
  it("sends bytes, and an object holding bytes, and leaves JSON as text", () => {
    expect(toBinaryValue(new Uint8Array([1]))?.shape).toEqual({ kind: "bytes" });
    expect(toBinaryValue(new Uint8Array([1]).buffer)?.shape).toEqual({
      kind: "bytes",
    });
    expect(
      toBinaryValue({ meta: { n: 1 }, binary: new Uint8Array([2]) })?.shape,
    ).toEqual({ kind: "mixed", json: { meta: { n: 1 } } });
    expect(toBinaryValue({ a: 1 })).toBeNull();
    expect(toBinaryValue("text")).toBeNull();
    expect(toBinaryValue(null)).toBeNull();
  });

  it("keeps a ring buffer a ring buffer", () => {
    const buffer = {
      type: FloatRingBufferSymbol,
      array: new Uint8Array(new Float32Array([0.5, -1]).buffer),
      id: 3,
      ts: 99,
    };

    const value = toBinaryValue(buffer)!;

    expect(value.shape).toEqual({ kind: "floatRingBuffer", id: 3, ts: 99 });
    expect(fromBinaryValue(value)).toEqual(buffer);
  });
});

const sockets: FakeSocket[] = [];

class FakeSocket {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  readyState = 1;
  binaryType = "blob";
  sent: Array<string | Uint8Array> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    sockets.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string | Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

describe("a browser runtime on a deployed board", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal("WebSocket", FakeSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function attach(answer: (params: unknown) => unknown) {
    const processRuntime = vi.fn(
      (
        _scope: unknown,
        params: unknown,
        _svc: unknown,
        options: { onResolve: (result: unknown) => void },
      ) => options.onResolve(answer(params)),
    );
    const context = {
      runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
      scopes: { ui: {} },
      runtimeApis: { browser: { processRuntime } },
    } as unknown as BoardContextState;
    renderHook(() =>
      useCoordinatorBridge("ws://c.test/bridge", "user-1", "board-1", context),
    );
    return processRuntime;
  }

  it("is handed the bytes, not a description of them", async () => {
    const processRuntime = attach(() => null);
    await waitFor(() => expect(sockets.length).toBe(1));
    expect(sockets[0].binaryType).toBe("arraybuffer");

    sockets[0].onmessage?.({ data: hex(NODE_FRAME) });

    expect(processRuntime).toHaveBeenCalledTimes(1);
    expect(processRuntime.mock.calls[0][1]).toEqual({
      meta: { name: "a.bin" },
      binary: new Uint8Array([0, 1, 254, 255]),
    });
  });

  it("answers with bytes as a binary frame, under the request it was asked", async () => {
    attach(() => new Uint8Array([4, 5, 6]));
    await waitFor(() => expect(sockets.length).toBe(1));

    sockets[0].onmessage?.({ data: hex(NODE_FRAME) });

    const answer = sockets[0].sent.find(
      (frame): frame is Uint8Array => frame instanceof Uint8Array,
    )!;
    const decoded = decodeBinaryFrame(asBuffer(answer));
    expect(decoded?.header).toEqual({ type: "result", requestId: "r-1" });
    expect([...decoded!.value.bytes]).toEqual([4, 5, 6]);
  });

  it("runs it as the run the coordinator says it is, begun by whoever it says began it", async () => {
    const processRuntime = attach(() => null);
    await waitFor(() => expect(sockets.length).toBe(1));

    sockets[0].onmessage?.({
      data: JSON.stringify({
        type: "processRuntime",
        runtimeId: "ui",
        requestId: "r-2",
        params: {},
        context: {
          runId: "run-7",
          parentRunId: "run-6",
          actor: {
            kind: "person",
            sub: "auth0|anna",
            email: "anna@example.com",
            name: "Anna",
            expiresAt: Date.now() + 60_000,
          },
          // Nothing a coordinator says of a run is where its answer goes.
          requestId: "somebody-else",
        },
      }),
    });

    expect(processRuntime.mock.calls[0][3]).toMatchObject({
      requestId: "r-2",
      runId: "run-7",
      parentRunId: "run-6",
      actor: {
        kind: "person",
        sub: "auth0|anna",
        email: "anna@example.com",
        name: "Anna",
        expiresAt: expect.any(Number),
      },
    });
  });

  it("runs it as nobody's when the coordinator names nobody, never as a run of this browser's own", async () => {
    const processRuntime = attach(() => null);
    await waitFor(() => expect(sockets.length).toBe(1));
    const hand = (message: object) =>
      sockets[0].onmessage?.({
        data: JSON.stringify({
          type: "processRuntime",
          runtimeId: "ui",
          requestId: "r-3",
          params: {},
          ...message,
        }),
      });

    hand({ context: { runId: "run-8" } });
    hand({});
    hand({
      context: {
        runId: "run-9",
        actor: { kind: "person", email: "no-sub@example.com" },
      },
    });

    const runs = processRuntime.mock.calls.map(
      (call) =>
        call[3] as unknown as {
          runId?: string;
          actor?: { kind?: string; sub?: string };
        },
    );
    // Invalid or missing actor data never acquires the browser's signed-in
    // person. A malformed person actor is expired immediately.
    expect(runs.map((run) => run.actor)).toEqual([
      { kind: "board" },
      { kind: "board" },
      { kind: "person", sub: "", expiresAt: 0 },
    ]);
    expect(runs[0].runId).toBe("run-8");
    // A run was handed over even where none was named.
    expect(runs[1].runId).toBeTruthy();
  });

  it("keeps the run of a frame that carries bytes", async () => {
    const processRuntime = attach(() => null);
    await waitFor(() => expect(sockets.length).toBe(1));

    sockets[0].onmessage?.({ data: hex(NODE_FRAME) });

    // The frame names no run; it is still one that arrived.
    expect(processRuntime.mock.calls[0][3]).toMatchObject({
      requestId: "r-1",
      actor: { kind: "board" },
    });
  });

  it("still answers JSON as text", async () => {
    attach(() => ({ n: 1 }));
    await waitFor(() => expect(sockets.length).toBe(1));

    sockets[0].onmessage?.({
      data: JSON.stringify({
        type: "processRuntime",
        runtimeId: "ui",
        requestId: "r-9",
        params: { n: 0 },
      }),
    });

    expect(sockets[0].sent).toContain(
      JSON.stringify({ type: "result", requestId: "r-9", data: { n: 1 } }),
    );
  });
});
