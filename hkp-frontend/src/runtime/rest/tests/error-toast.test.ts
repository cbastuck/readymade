import { describe, expect, it, vi } from "vitest";

import RuntimeRestScope from "../RuntimeRestScope";
import { RuntimeDescriptor, ServiceDescriptor } from "hkp-frontend/src/types";

/**
 * A remote service's `error` is raised as a toast as well as shown on its
 * panel: a panel may have no room for it, be collapsed or be off screen.
 *
 * Once per failure — a service behind a timer that fails the same way on every
 * tick says so once — and again after it has worked in between.
 */

const runtime: RuntimeDescriptor = {
  id: "egress",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

const services = [
  { uuid: "fetch", serviceId: "http-client", serviceName: "Fetch" },
  { uuid: "feed", serviceId: "rss", serviceName: "Feed" },
] as Array<ServiceDescriptor>;

const REFUSED = "This server does not reach private addresses (192.168.178.64)";

function makeScope() {
  // No output URL: the scope opens no WebSocket; notifications are fed in.
  const scope = new RuntimeRestScope(runtime, "", null);
  scope.services = services;
  const onAction = vi.fn(() => true);
  scope.onAction = onAction;
  return { scope, toasts: () => onAction.mock.calls.map(([a]: any[]) => a.payload) };
}

describe("a remote service's error", () => {
  it("is raised as an error toast naming the service", () => {
    const { scope, toasts } = makeScope();
    scope.app.notify({ uuid: "fetch" }, { requesting: false, status: 0, error: REFUSED });
    expect(toasts()).toEqual([{ type: "error", message: `Fetch: ${REFUSED}` }]);
  });

  it("is raised once while it repeats", () => {
    const { scope, toasts } = makeScope();
    for (let i = 0; i < 3; i++) {
      scope.app.notify({ uuid: "fetch" }, { status: 0, error: REFUSED });
    }
    expect(toasts()).toHaveLength(1);
  });

  it("is raised again after the service worked in between", () => {
    const { scope, toasts } = makeScope();
    scope.app.notify({ uuid: "fetch" }, { status: 0, error: REFUSED });
    scope.app.notify({ uuid: "fetch" }, { status: 200, error: "" });
    scope.app.notify({ uuid: "fetch" }, { status: 0, error: REFUSED });
    expect(toasts()).toHaveLength(2);
  });

  it("is cleared by null as well as by an empty string", () => {
    const { scope, toasts } = makeScope();
    scope.app.notify({ uuid: "fetch" }, { error: REFUSED });
    scope.app.notify({ uuid: "fetch" }, { error: null });
    scope.app.notify({ uuid: "fetch" }, { error: REFUSED });
    expect(toasts()).toHaveLength(2);
  });

  it("is kept per service", () => {
    const { scope, toasts } = makeScope();
    scope.app.notify({ uuid: "fetch" }, { error: REFUSED });
    scope.app.notify({ uuid: "feed" }, { error: REFUSED });
    expect(toasts().map((t: any) => t.message)).toEqual([
      `Fetch: ${REFUSED}`,
      `Feed: ${REFUSED}`,
    ]);
  });

  it("raises nothing for a notification that says nothing about errors", () => {
    const { scope, toasts } = makeScope();
    scope.app.notify({ uuid: "fetch" }, { requesting: true, url: "http://x/" });
    scope.app.notify({ uuid: "fetch" }, { __internal: { state: "call-process" } });
    scope.app.notify({ uuid: "fetch" }, "plain text");
    expect(toasts()).toEqual([]);
  });
});
