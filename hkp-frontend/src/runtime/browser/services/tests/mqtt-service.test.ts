import { beforeEach, describe, expect, it, vi } from "vitest";

import MqttDescriptor from "../Mqtt";
import { decodePayload, outgoing, webSocketAddress } from "../mqtt-message";

/**
 * The browser MQTT client, against a stand-in for the client library.
 *
 * What a board depends on and cannot see: which address the service ends up
 * dialling (typed, or a mount's once it is known), that a page is not asked to
 * open what it cannot, and that messages go in and out in the shape hkp-node's
 * `mqtt` gives them.
 */

type Handler = (...args: any[]) => void;

/** One fake connection: what it was opened with, and its events to fire. */
class FakeClient {
  connected = false;
  ended = false;
  handlers: Record<string, Handler[]> = {};
  subscribed: Array<{ topics: string[]; qos: number }> = [];
  published: Array<{ topic: string; payload: unknown; options: any }> = [];

  constructor(
    readonly url: string,
    readonly options: Record<string, any>,
  ) {}

  on(event: string, handler: Handler) {
    (this.handlers[event] ??= []).push(handler);
    return this;
  }
  emit(event: string, ...args: any[]) {
    if (event === "connect") {
      this.connected = true;
    }
    if (event === "close") {
      this.connected = false;
    }
    (this.handlers[event] ?? []).forEach((handler) => handler(...args));
  }
  subscribe(topics: string[], options: { qos: number }, done: Handler) {
    this.subscribed.push({ topics, qos: options.qos });
    done(null, topics.map((topic) => ({ topic, qos: options.qos })));
  }
  async publishAsync(topic: string, payload: unknown, options: any) {
    this.published.push({ topic, payload, options });
  }
  end() {
    this.ended = true;
    this.connected = false;
  }
}

const clients: FakeClient[] = [];

vi.mock("mqtt", () => ({
  connect: (url: string, options: Record<string, any>) => {
    const client = new FakeClient(url, options);
    clients.push(client);
    return client;
  },
}));

function createService(coordinator?: { resolveMountUrl: (ref: string) => string | null }) {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    coordinator,
  };
  const svc = MqttDescriptor.create(app as any, "test-board", {} as any, "svc-1") as any;
  return { svc, app };
}

/** The connection the service opened, once the client library has loaded. */
async function opened(count = 1): Promise<FakeClient> {
  await vi.waitFor(() => expect(clients).toHaveLength(count));
  return clients[count - 1];
}

const text = (value: string) => new TextEncoder().encode(value);

beforeEach(() => {
  clients.length = 0;
  vi.useRealTimers();
});

describe("what a page can dial", () => {
  it("takes WebSocket addresses, and a mount's address as one", () => {
    expect(webSocketAddress("wss://broker.example:8081/mqtt").url).toBe(
      "wss://broker.example:8081/mqtt",
    );
    expect(webSocketAddress("http://127.0.0.1:8080/hosted/abc").url).toBe(
      "ws://127.0.0.1:8080/hosted/abc",
    );
    expect(webSocketAddress("https://host.example/hosted/abc").url).toBe(
      "wss://host.example/hosted/abc",
    );
  });

  it("says a plain socket is a Node runtime's to open", () => {
    expect(webSocketAddress("mqtt://broker.example:1883").problem).toMatch(
      /only over WebSockets/,
    );
    expect(webSocketAddress("broker.example").problem).toMatch(/not a broker address/);
  });
});

describe("the browser mqtt service", () => {
  it("has the id and the state hkp-node's has", () => {
    expect(MqttDescriptor.serviceId).toBe("mqtt");
    const { svc } = createService();
    expect(svc.state).toMatchObject({
      url: "",
      mode: "subscribe",
      topics: [],
      qos: 0,
      format: "auto",
      enabled: false,
      status: "disconnected",
    });
  });

  it("subscribes once connected and pushes each message on", async () => {
    const { svc, app } = createService();
    svc.configure({ url: "wss://broker.example/mqtt", topics: "home/#, garden/+", connect: true });
    const client = await opened();
    expect(client.url).toBe("wss://broker.example/mqtt");
    expect(client.options.reconnectPeriod).toBe(0);
    expect(svc.state.status).toBe("connecting");

    client.emit("connect");
    expect(svc.state).toMatchObject({ running: true, status: "connected", error: "" });
    expect(client.subscribed).toEqual([{ topics: ["home/#", "garden/+"], qos: 0 }]);

    client.emit("message", "home/kitchen", text('{"temperature":21.5}'), { qos: 0, retain: false });
    client.emit("message", "home/lamp", text("ON"), { qos: 1, retain: true });
    expect(app.next.mock.calls.map((call) => call[1])).toEqual([
      { topic: "home/kitchen", payload: { temperature: 21.5 }, qos: 0, retain: false },
      { topic: "home/lamp", payload: "ON", qos: 1, retain: true },
    ]);
    // An input from the service before it is not this service's to change.
    expect(svc.process({ anything: true })).toEqual({ anything: true });
  });

  it("publishes its input under the configured topic, or the one it names", async () => {
    const { svc } = createService();
    svc.configure({
      url: "ws://localhost:9001",
      mode: "publish",
      topic: "lamp/set",
      qos: 1,
      connect: true,
    });
    const client = await opened();
    client.emit("connect");
    expect(client.subscribed).toEqual([]);

    expect(await svc.process({ on: true })).toEqual({ on: true });
    await svc.process({ topic: "fan/set", payload: "OFF", retain: true });
    expect(client.published).toEqual([
      { topic: "lamp/set", payload: '{"on":true}', options: { qos: 1, retain: false } },
      { topic: "fan/set", payload: "OFF", options: { qos: 1, retain: true } },
    ]);
    expect(svc.state.published).toBe(2);
  });

  it("passes nothing on from a publish it could not make, and says why", async () => {
    const { svc, app } = createService();
    svc.configure({ url: "ws://localhost:9001", mode: "publish", connect: true });
    const client = await opened();

    // Not connected yet.
    expect(await svc.process({ topic: "a", payload: 1 })).toBeNull();
    client.emit("connect");
    // Nothing names a topic; and a filter is not one.
    expect(await svc.process("ON")).toBeNull();
    expect(await svc.process({ topic: "lamp/#", payload: 1 })).toBeNull();

    expect(client.published).toEqual([]);
    const said = app.sendAction.mock.calls.map((call) => call[0].payload.message);
    expect(said).toEqual([
      expect.stringMatching(/Not connected/),
      expect.stringMatching(/where to publish/),
      expect.stringMatching(/filter, not a topic/),
    ]);
  });

  it("does not ask the page to open what it cannot", async () => {
    const { svc } = createService();
    svc.configure({ url: "mqtt://broker.example:1883", topics: "a", connect: true });
    expect(svc.state).toMatchObject({
      enabled: false,
      status: "disconnected",
      error: expect.stringMatching(/only over WebSockets/),
    });

    svc.configure({ url: "wss://broker.example", topics: [], connect: true });
    expect(svc.state.error).toMatch(/Topics are required/);
    svc.configure({ topics: "a", password: "p", connect: true });
    expect(svc.state.error).toMatch(/needs a username/);
    await new Promise((r) => setTimeout(r, 0));
    expect(clients).toEqual([]);
  });

  it("waits for a broker named by reference, and dials the address it is given", async () => {
    const { svc } = createService({ resolveMountUrl: () => null });
    svc.configure({ url: "hkp-mount://node/hub", topics: "demo/#", connect: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(clients).toEqual([]);
    expect(svc.state).toMatchObject({ enabled: true, status: "connecting" });

    // What the board's coordinator does once the broker has published.
    svc.configure({ __hkpMount: "http://127.0.0.1:8080/hosted/abc" });
    const client = await opened();
    expect(client.url).toBe("ws://127.0.0.1:8080/hosted/abc");
    // What was written stays what was written.
    expect(svc.state.url).toBe("hkp-mount://node/hub");
  });

  it("keeps looking for a broker whose runtime has not published yet", async () => {
    vi.useFakeTimers();
    let published: string | null = null;
    const { svc } = createService({ resolveMountUrl: () => published });
    svc.configure({ url: "hkp-mount://node/hub", topics: "demo/#", connect: true });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(clients).toEqual([]);

    // Nothing announces it: the broker's runtime simply has an address now.
    published = "http://127.0.0.1:8080/hosted/abc";
    await vi.advanceTimersByTimeAsync(300);
    await vi.dynamicImportSettled();
    expect(clients.map((client) => client.url)).toEqual([
      "ws://127.0.0.1:8080/hosted/abc",
    ]);

    // One that never does is said, and not given up on.
    published = null;
    svc.configure({ url: "hkp-mount://node/other" });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(svc.state).toMatchObject({
      enabled: true,
      error: 'Waiting for "hkp-mount://node/other" to publish its address',
    });
    svc.destroy();
  });

  it("asks the coordinator for an address already published", async () => {
    const { svc } = createService({
      resolveMountUrl: (ref) =>
        ref === "hkp-mount://node/hub" ? "https://host.example/hosted/abc" : null,
    });
    svc.configure({ url: "hkp-mount://node/hub", topics: "demo/#", connect: true });
    expect((await opened()).url).toBe("wss://host.example/hosted/abc");
  });

  it("takes the connection up again after it drops, and stops when told", async () => {
    vi.useFakeTimers();
    const { svc } = createService();
    svc.configure({ url: "wss://broker.example", topics: "a", connect: true });
    await vi.dynamicImportSettled();
    const first = clients[0];
    first.emit("connect");
    first.emit("close");
    expect(first.ended).toBe(true);
    expect(svc.state).toMatchObject({
      enabled: true,
      running: false,
      status: "reconnecting",
      reconnectAttempts: 1,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.dynamicImportSettled();
    expect(clients).toHaveLength(2);
    // Never accepted: a page is not told why, so the service says what is likely.
    clients[1].emit("close");
    expect(svc.state.error).toMatch(/could not be reached/);
    expect(svc.state.reconnectAttempts).toBe(2);

    svc.configure({ connect: false });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(clients).toHaveLength(2);
    expect(svc.state).toMatchObject({ enabled: false, status: "disconnected" });
  });

  it("reconnects when what the connection is made of changes, and not otherwise", async () => {
    const { svc } = createService();
    svc.configure({ url: "wss://broker.example", topics: "a", connect: true });
    const first = await opened();
    first.emit("connect");

    // Shapes a message, not the connection.
    svc.configure({ format: "text", retain: true, topic: "x" });
    await new Promise((r) => setTimeout(r, 0));
    expect(clients).toHaveLength(1);

    svc.configure({ topics: "a, b" });
    const second = await opened(2);
    expect(first.ended).toBe(true);
    second.emit("connect");
    expect(second.subscribed[0].topics).toEqual(["a", "b"]);

    svc.destroy();
    expect(second.ended).toBe(true);
  });
});

describe("the shapes it shares with hkp-node", () => {
  it("reads payloads the same way", () => {
    expect(decodePayload(text('{"t":1}'), "auto")).toEqual({ t: 1 });
    expect(decodePayload(text("21.5"), "text")).toBe("21.5");
    expect(decodePayload(new Uint8Array([1, 2]), "binary")).toEqual(new Uint8Array([1, 2]));
  });

  it("treats an object that only happens to have a topic as a payload", () => {
    const defaults = { topic: "lamp/set", qos: 0 as const, retain: false };
    expect(outgoing({ topic: "news" }, defaults)?.topic).toBe("lamp/set");
    expect(outgoing("ON", { ...defaults, topic: "" })).toBeNull();
  });
});
