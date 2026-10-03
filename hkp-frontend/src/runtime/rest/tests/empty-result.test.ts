import { afterEach, describe, expect, it, vi } from "vitest";

import RuntimeRestScope from "../RuntimeRestScope";
import { MessagePurpose, serializeYasMessage } from "../Message";
import { makeNull } from "../Data";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * Results arriving on a runtime's output socket.
 *
 * A runtime reports every run that finished, and a run a service stopped is
 * reported as one that passes nothing on. Those reports are not handed to the
 * scope's listener unless a caller is waiting for the answer: a pipeline driven
 * by a stream produces one per buffer, and none of them carries anything.
 */

const runtime: RuntimeDescriptor = {
  id: "home",
  name: "Home",
  type: "rest",
  url: "http://127.0.0.1:8887",
} as RuntimeDescriptor;

class FakeSocket {
  static last: FakeSocket;
  onmessage: ((event: { data: unknown }) => Promise<void>) | null = null;
  constructor() {
    FakeSocket.last = this;
  }
  send() {}
  close() {}
}

function makeScope() {
  vi.stubGlobal("WebSocket", FakeSocket);
  const scope = new RuntimeRestScope(runtime, "ws://127.0.0.1:8887/out", null);
  scope.onResult = vi.fn();
  return { scope, receive: (data: unknown) => FakeSocket.last.onmessage!({ data }) };
}

// jsdom's Blob has no arrayBuffer().
function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** A frame as the socket delivers it: something to read the bytes from. */
const binary = (purpose: MessagePurpose, sender: string) => {
  const blob = serializeYasMessage(makeNull(), sender, purpose);
  return { arrayBuffer: () => readBlob(blob) };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a result that passes nothing on", () => {
  it("is not handed to the listener when it arrives as a binary frame", async () => {
    const { scope, receive } = makeScope();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await receive(binary(MessagePurpose.RESULT, "RUNTIME"));

    expect(scope.onResult).not.toHaveBeenCalled();
    // Read and set aside, not dropped as a frame that could not be read.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("is not handed to the listener when it arrives as JSON", async () => {
    const { scope, receive } = makeScope();

    await receive(JSON.stringify({ type: "result", data: null }));

    expect(scope.onResult).not.toHaveBeenCalled();
  });

  it("still reaches the listener when a caller is waiting for it", async () => {
    const { scope, receive } = makeScope();

    await receive(binary(MessagePurpose.RESULT_WITH_REQUEST_ID, "request-1"));

    expect(scope.onResult).toHaveBeenCalledTimes(1);
    const [, , context] = (scope.onResult as any).mock.calls[0];
    expect(context.requestId).toBe("request-1");
  });
});

describe("a result that carries a value", () => {
  it("is handed to the listener", async () => {
    const { scope, receive } = makeScope();

    await receive(JSON.stringify({ type: "result", data: { count: 3 } }));

    expect(scope.onResult).toHaveBeenCalledWith(null, { count: 3 }, null);
  });
});
