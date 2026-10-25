import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RuntimeRestScope from "../RuntimeRestScope";
import { setCapturing } from "../../captureMode";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * A remote runtime sends its call reports with values only while the board is
 * captured, so it has to be told: from the moment there is a runtime to tell
 * until its scope goes away.
 */

const runtime = {
  id: "process",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

/** A socket that opens when the test says so. */
class FakeSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static last: FakeSocket | undefined;
  readyState = FakeSocket.OPEN;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(message: string) {
    this.sent.push(message);
  }
  close() {
    this.readyState = 3;
  }
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  setCapturing(false);
  vi.unstubAllGlobals();
});

/** Every Capture mode this runtime was told, in order. */
const told = () =>
  fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith("/runtimes/process/state") && init?.method === "PATCH")
    .map(([, init]) => JSON.parse(init.body).capture);

describe("a remote runtime's Capture mode", () => {
  it("is told once there is a runtime, and on every change after", async () => {
    const scope = new RuntimeRestScope(runtime, "ws://127.0.0.1:8080/process", null);
    expect(told()).toEqual([]);

    FakeSocket.last!.onopen!({});
    // Off included: a runtime attached to again may still be capturing.
    expect(told()).toEqual([false]);

    setCapturing(true);
    setCapturing(false);
    expect(told()).toEqual([false, true, false]);

    await scope.close();
    setCapturing(true);
    expect(told()).toEqual([false, true, false]);
  });

  it("is what the board has when the runtime turns up", () => {
    setCapturing(true);
    new RuntimeRestScope(runtime, "ws://127.0.0.1:8080/process", null);
    FakeSocket.last!.onopen!({});
    expect(told()).toEqual([true]);
  });
});

describe("a runtime that does not take Capture mode", () => {
  it("is said, when it was being turned on", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404 }));
    const scope = new RuntimeRestScope(runtime, "ws://127.0.0.1:8080/process", null);
    const onAction = vi.fn(() => true);
    scope.onAction = onAction;
    FakeSocket.last!.onopen!({});

    setCapturing(true);
    await vi.waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(onAction.mock.calls[0][0]).toMatchObject({
      action: "notification",
      payload: { type: "error" },
    });

    // Off not taken is the private default already: nothing to say.
    setCapturing(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
