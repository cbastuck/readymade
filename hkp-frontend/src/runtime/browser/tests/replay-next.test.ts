import { describe, expect, it, vi } from "vitest";

import api from "../BrowserRuntimeApi";
import BrowserRuntimeScope from "../BrowserRuntimeScope";
import { ServiceInstance } from "hkp-frontend/src/types";

/**
 * What `app.next` reports about the service it is called on.
 *
 * A service emitting on its own — a Timer tick, an arriving message — was never
 * called by the pipeline's loop, so nothing else reports the output it just
 * produced and `next` reports it on the service's behalf. A replay is the case
 * with nothing to report: the flow inspector is pushing a captured value back
 * through the board, so the service produced nothing, and counting it would add
 * a history entry to the inspector for every click of its own Inject button —
 * which is not what the remote runtimes do.
 */

async function twoServices() {
  const { scope: scope_ } = await api.addRuntime(
    { name: "Browser", type: "browser" } as any,
    null,
    "test-board",
  );
  const scope = scope_ as BrowserRuntimeScope;
  scope.onResult = async () => {};

  const first = await api.addService(scope, {
    serviceId: "hookup.to/service/monitor",
    serviceName: "First",
  } as any);
  const second = await api.addService(scope, {
    serviceId: "hookup.to/service/monitor",
    serviceName: "Second",
  } as any);

  return {
    scope,
    first: scope.findServiceInstance(first!.uuid)[0] as ServiceInstance,
    second: scope.findServiceInstance(second!.uuid)[0] as ServiceInstance,
  };
}

/** The pair of notifications a produced output is reported with. */
const outputReports = (calls: any[][]) =>
  calls.filter(
    ([notification]) =>
      notification?.__internal?.state === "call-process-finished",
  );

describe("app.next", () => {
  it("reports the output of a service that emitted on its own", async () => {
    const { scope, first } = await twoServices();
    const onNotification = vi.fn();
    scope.app.registerNotificationTarget!(first, onNotification);

    await scope.app.next(first, { tick: 1 });

    expect(outputReports(onNotification.mock.calls)).toEqual([
      [{ __internal: { state: "call-process-finished", data: { tick: 1 } } }],
    ]);
  });

  it("reports nothing for the service a value is replayed from", async () => {
    const { scope, first } = await twoServices();
    const onNotification = vi.fn();
    scope.app.registerNotificationTarget!(first, onNotification);

    await scope.app.next(first, { tick: 1 }, { replay: true });
    await scope.app.next(first, { tick: 1 }, { replay: true });

    expect(outputReports(onNotification.mock.calls)).toEqual([]);
  });

  it("still runs the services after it on a replay", async () => {
    const { scope, first, second } = await twoServices();
    const onNotification = vi.fn();
    scope.app.registerNotificationTarget!(second, onNotification);

    await scope.app.next(first, { tick: 1 }, { replay: true });

    expect(onNotification).toHaveBeenCalledWith({ tick: 1 });
  });

  it("keeps the caller while the emitting service is still in that run", async () => {
    const { scope, first, second } = await twoServices();
    const run = {
      requestId: "req-1",
      runId: "run-1",
      actor: {
        kind: "person" as const,
        sub: "auth0|member",
        email: "member@example.com",
        expiresAt: Date.now() + 60_000,
      },
    };
    const seen: unknown[] = [];

    second.process = vi.fn((value) => {
      seen.push(scope.app.currentContext?.(second));
      return value;
    });
    first.process = vi.fn(async () => {
      await scope.app.next(first, { tick: 1 });
      return null;
    });

    await scope.next(first, {}, run, false, false);

    expect(seen).toEqual([run]);
  });

  it("continues one late answer in the run captured before returning", async () => {
    const { scope, first, second } = await twoServices();
    const run = {
      requestId: "req-1",
      runId: "run-1",
      actor: {
        kind: "person" as const,
        sub: "auth0|member",
        email: "member@example.com",
        expiresAt: Date.now() + 60_000,
      },
    };
    let resolve!: (result: any) => void;
    const reported = vi.fn();
    scope.onResult = reported;
    first.process = vi.fn(() => {
      resolve = scope.app.defer(first);
      return null;
    });
    second.process = vi.fn((value) => {
      expect(scope.app.currentContext?.(second)).toBe(run);
      return value;
    });

    await scope.next(null, {}, run, false);
    expect(reported).not.toHaveBeenCalled();
    resolve({ answer: 42 });
    await vi.waitFor(() => expect(reported).toHaveBeenCalledOnce());
    expect(second.process).toHaveBeenCalledWith({ answer: 42 });
  });

  it("does not let one pending answer hide another answer in the same run", async () => {
    const { scope, first, second } = await twoServices();
    const run = {
      requestId: "req-1",
      runId: "run-1",
      actor: {
        kind: "person" as const,
        sub: "auth0|member",
        expiresAt: Date.now() + 60_000,
      },
    };
    const resolves: Array<(result: any) => void> = [];
    const reported = vi.fn();
    scope.onResult = reported;
    first.process = vi.fn(() => {
      resolves.push(scope.app.defer(first), scope.app.defer(first));
      return null;
    });
    second.process = vi.fn((value) => value);

    await scope.next(null, {}, run, false);
    resolves[0]({ answer: 1 });
    await vi.waitFor(() => expect(reported).toHaveBeenCalledTimes(1));
    resolves[1]({ answer: 2 });
    await vi.waitFor(() => expect(reported).toHaveBeenCalledTimes(2));
  });

  it("fails caller attribution closed while the same service has overlapping runs", async () => {
    const { scope, first, second } = await twoServices();
    const runs = {
      a: {
        requestId: "a",
        runId: "run-a",
        actor: {
          kind: "person" as const,
          sub: "auth0|a",
          expiresAt: Date.now() + 60_000,
        },
      },
      b: {
        requestId: "b",
        runId: "run-b",
        actor: {
          kind: "person" as const,
          sub: "auth0|b",
          expiresAt: Date.now() + 60_000,
        },
      },
    };
    const release: Record<string, () => void> = {};
    const seen: Array<{ label: string; context: unknown }> = [];

    first.process = vi.fn(async (label: "a" | "b") => {
      await new Promise<void>((resolve) => {
        release[label] = resolve;
      });
      await scope.app.next(first, { label });
      return null;
    });
    second.process = vi.fn((value) => {
      seen.push({
        label: value.label,
        context: scope.app.currentContext?.(second),
      });
      return value;
    });

    const a = scope.next(first, "a", runs.a, false, false);
    const b = scope.next(first, "b", runs.b, false, false);
    await vi.waitFor(() => expect(release.a).toBeTypeOf("function"));
    await vi.waitFor(() => expect(release.b).toBeTypeOf("function"));

    release.a();
    await a;
    release.b();
    await b;

    expect(seen).toEqual([
      {
        label: "a",
        context: {
          requestId: "",
          runId: expect.any(String),
          actor: { kind: "board" },
        },
      },
      { label: "b", context: runs.b },
    ]);
  });

  it("starts a board run when a service emits after its call ended", async () => {
    const { scope, first, second } = await twoServices();
    scope.authenticatedUser = {
      userId: "auth0|owner",
      username: "Owner",
      email: "owner@example.com",
    } as any;
    const seen: unknown[] = [];
    second.process = vi.fn((value) => {
      seen.push(scope.app.currentContext?.(second));
      return value;
    });

    await scope.app.next(first, { tick: 1 });

    expect(seen).toEqual([
      {
        requestId: "",
        runId: expect.any(String),
        actor: { kind: "board" },
      },
    ]);
  });

  it("attributes an explicit local user gesture to the signed-in person", async () => {
    const { scope, first, second } = await twoServices();
    scope.authenticatedUser = {
      userId: "auth0|owner",
      username: "Owner",
      email: "OWNER@example.com",
    } as any;
    const seen: unknown[] = [];
    second.process = vi.fn((value) => {
      seen.push(scope.app.currentContext?.(second));
      return value;
    });

    const interactive = scope.app.serviceForUserInterface!(first);
    await interactive.app.next(interactive, { tick: 1 });

    expect(seen).toEqual([
      {
        requestId: "",
        runId: expect.any(String),
        actor: {
          kind: "person",
          sub: "auth0|owner",
          email: "owner@example.com",
          name: "Owner",
          expiresAt: expect.any(Number),
        },
      },
    ]);
  });

  it("routes a service-panel method through the person run", async () => {
    const { scope, first, second } = await twoServices();
    scope.authenticatedUser = {
      userId: "auth0|member",
      email: "member@example.com",
    } as any;
    const seen: unknown[] = [];
    (first as any).send = async function (value: unknown) {
      await Promise.resolve();
      return this.app.next(this, value);
    };
    second.process = vi.fn((value) => {
      seen.push(scope.app.currentContext?.(second));
      return value;
    });

    const panelService = scope.app.serviceForUserInterface!(first) as any;
    expect(scope.app.serviceForUserInterface!(first)).toBe(panelService);
    await panelService.send({ answer: 42 });

    expect(seen).toEqual([
      {
        requestId: "",
        runId: expect.any(String),
        actor: {
          kind: "person",
          sub: "auth0|member",
          email: "member@example.com",
          expiresAt: expect.any(Number),
        },
      },
    ]);
  });

  it("routes panel configuration through the person run only", async () => {
    const { scope, first } = await twoServices();
    scope.authenticatedUser = { userId: "auth0|member" } as any;
    const seen: unknown[] = [];
    first.configure = vi.fn(() => {
      seen.push(scope.app.currentContext?.(first));
      return {};
    });

    const panelService = scope.app.serviceForUserInterface!(first);
    await panelService.configure({ enabled: true });
    await first.configure({ enabled: false });

    expect(seen).toEqual([
      {
        requestId: "",
        runId: expect.any(String),
        actor: {
          kind: "person",
          sub: "auth0|member",
          expiresAt: expect.any(Number),
        },
      },
      undefined,
    ]);
  });

  it("does not attach the panel's person to a standing callback", async () => {
    const { scope, first, second } = await twoServices();
    scope.authenticatedUser = { userId: "auth0|member" } as any;
    let tick!: () => void;
    const seen: unknown[] = [];
    (first as any).start = function () {
      tick = () => this.app.next(this, { tick: 1 });
    };
    second.process = vi.fn((value) => {
      seen.push(scope.app.currentContext?.(second));
      return value;
    });

    const panelService = scope.app.serviceForUserInterface!(first) as any;
    panelService.start();
    tick();
    await vi.waitFor(() => expect(second.process).toHaveBeenCalledOnce());

    expect(seen).toEqual([
      {
        requestId: "",
        runId: expect.any(String),
        actor: { kind: "board" },
      },
    ]);
  });
});
