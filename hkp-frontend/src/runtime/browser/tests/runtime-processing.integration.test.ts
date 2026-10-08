import { describe, it, expect, vi } from "vitest";

import BrowserRuntimeScope from "hkp-frontend/src/runtime/browser/BrowserRuntimeScope";
import {
  processRuntime,
  processService,
} from "hkp-frontend/src/runtime/browser/BrowserRuntimeApi";
import { continuedRun } from "hkp-frontend/src/runtime/processContext";
import { LogEntry, RuntimeDescriptor } from "hkp-frontend/src/types";

function createScope(runtimeId = "rt-proc-1") {
  const runtime: RuntimeDescriptor = {
    id: runtimeId,
    name: "Browser Runtime",
    type: "browser",
  };

  const scope = new BrowserRuntimeScope(runtime, {} as any);
  return scope;
}

function createService(
  uuid: string,
  impl: { process?: (x: any) => any; bypass?: boolean } = {},
) {
  return {
    uuid,
    board: "test-board",
    app: null,
    serviceId: `test/${uuid}`,
    serviceName: uuid,
    configure: vi.fn(),
    process: vi.fn(impl.process || ((x) => x)),
    destroy: vi.fn(),
    bypass: !!impl.bypass,
  } as any;
}

describe("runtime processing integration", () => {
  it("processRuntime keeps identity when runtime has no services", async () => {
    const scope = createScope();

    const input = { a: 1, nested: { ok: true } };
    const result = await processRuntime(scope as any, input, null, null);

    expect(result).toEqual(input);
  });

  it("processRuntime applies single service transform", async () => {
    const scope = createScope();

    const svcA = createService("svc-a", {
      process: (x) => ({ ...x, x2: x.value * 2 }),
    });
    scope.serviceInstances = [svcA];

    const result = await processRuntime(scope as any, { value: 3 }, null, null);

    expect(result).toEqual({ value: 3, x2: 6 });
    expect(svcA.process).toHaveBeenCalledTimes(1);
  });

  it("processRuntime applies multiple services in order", async () => {
    const scope = createScope();

    const svcA = createService("svc-a", {
      process: (x) => ({ ...x, seq: ["a"] }),
    });
    const svcB = createService("svc-b", {
      process: (x) => ({ ...x, seq: [...x.seq, "b"], out: x.num + 1 }),
    });
    const svcC = createService("svc-c", {
      process: (x) => ({ ...x, seq: [...x.seq, "c"], out: x.out * 10 }),
    });

    scope.serviceInstances = [svcA, svcB, svcC];

    const result = await processRuntime(scope as any, { num: 2 }, null, null);

    expect(result).toEqual({ num: 2, seq: ["a", "b", "c"], out: 30 });
    expect(svcA.process).toHaveBeenCalledTimes(1);
    expect(svcB.process).toHaveBeenCalledTimes(1);
    expect(svcC.process).toHaveBeenCalledTimes(1);
  });

  it("bypass service is skipped while others still process", async () => {
    const scope = createScope();

    const svcA = createService("svc-a", {
      process: (x) => ({ ...x, a: true }),
    });
    const svcBypass = createService("svc-bypass", {
      process: () => ({ shouldNot: "happen" }),
      bypass: true,
    });
    const svcC = createService("svc-c", {
      process: (x) => ({ ...x, c: true }),
    });

    scope.serviceInstances = [svcA, svcBypass, svcC];

    const result = await processRuntime(scope as any, { n: 1 }, null, null);

    expect(result).toEqual({ n: 1, a: true, c: true });
    expect(svcA.process).toHaveBeenCalledTimes(1);
    expect(svcBypass.process).not.toHaveBeenCalled();
    expect(svcC.process).toHaveBeenCalledTimes(1);
  });

  it("null result from a service stops downstream processing", async () => {
    const scope = createScope();

    const svcA = createService("svc-a", {
      process: () => null,
    });
    const svcB = createService("svc-b", {
      process: () => ({ shouldNot: "run" }),
    });

    scope.serviceInstances = [svcA, svcB];

    const result = await processRuntime(
      scope as any,
      { payload: 1 },
      null,
      null,
    );

    expect(result).toBeNull();
    expect(svcA.process).toHaveBeenCalledTimes(1);
    expect(svcB.process).not.toHaveBeenCalled();
  });

  it("processService starts at selected service and applies the rest", async () => {
    const scope = createScope();

    const svcA = createService("svc-a", {
      process: (x) => ({ ...x, a: true }),
    });
    const svcB = createService("svc-b", {
      process: (x) => ({ ...x, b: true }),
    });
    const svcC = createService("svc-c", {
      process: (x) => ({ ...x, c: true }),
    });

    scope.serviceInstances = [svcA, svcB, svcC];

    const result = await processService(
      scope as any,
      { uuid: svcB.uuid },
      { base: true },
      null,
    );

    expect(result).toEqual({ base: true, b: true, c: true });
    expect(svcA.process).not.toHaveBeenCalled();
    expect(svcB.process).toHaveBeenCalledTimes(1);
    expect(svcC.process).toHaveBeenCalledTimes(1);
  });

  it("processRuntime passes process context to onResult", async () => {
    const scope = createScope();

    const svcA = createService("svc-a", {
      process: (x) => ({ ...x, done: true }),
    });
    scope.serviceInstances = [svcA];

    const onResultSpy = vi.fn();
    scope.onResult = onResultSpy;

    const context = {
      requestId: "req-1",
      actor: { kind: "local" as const },
    };
    const result = await processRuntime(scope as any, { x: 1 }, null, context);

    expect(result).toEqual({ x: 1, done: true });
    expect(onResultSpy).toHaveBeenCalledWith(
      svcA.uuid,
      { x: 1, done: true },
      context,
    );
  });

  describe("the run a service is called in", () => {
    const ANNA = { sub: "auth0|anna", email: "anna@example.com", name: "Anna" };

    /** A service that says what run it finds itself in, and records an entry. */
    function witness(scope: BrowserRuntimeScope, uuid: string) {
      const seen: unknown[] = [];
      const svc = createService(uuid, {
        process: (x) => {
          seen.push(scope.app.currentContext?.(svc));
          scope.app.log(svc, "info", "seen");
          return x;
        },
      });
      return { svc, seen };
    }

    it("is the coordinator's, with its caller, for every service the pass reaches", async () => {
      const scope = createScope();
      scope.authenticatedUser = { userId: "auth0|owner" } as any;
      const first = witness(scope, "svc-a");
      const second = witness(scope, "svc-b");
      scope.serviceInstances = [first.svc, second.svc];
      const entries: LogEntry[] = [];
      scope.registerLogTarget((entry) => entries.push(entry));

      await processRuntime(
        scope as any,
        {},
        null,
        continuedRun(
          {
            runId: "run-1",
            actor: {
              kind: "person",
              ...ANNA,
              expiresAt: Date.now() + 60_000,
            },
          },
          { requestId: "r-1" },
        ),
      );

      expect(first.seen).toEqual([
        {
          requestId: "r-1",
          runId: "run-1",
          actor: {
            kind: "person",
            ...ANNA,
            expiresAt: expect.any(Number),
          },
        },
      ]);
      expect(second.seen).toEqual(first.seen);
      // What the browser records of the run belongs to it, and to her.
      expect(entries.map((entry) => [entry.runId, entry.caller])).toEqual([
        ["run-1", ANNA.sub],
        ["run-1", ANNA.sub],
      ]);
      // And is nobody's once the call is over.
      expect(scope.app.currentContext?.(first.svc)).toBeUndefined();
    });

    it("uses a local actor when auth is off", async () => {
      const scope = createScope();
      const only = witness(scope, "svc-a");
      scope.serviceInstances = [only.svc];

      await processRuntime(scope as any, {}, null, null);

      expect(only.seen[0]).toMatchObject({
        runId: expect.any(String),
        actor: { kind: "local" },
      });
    });

    it("captures the signed-in person when a local run begins", async () => {
      const scope = createScope();
      scope.authenticatedUser = {
        userId: "auth0|owner",
        username: "Owner",
        email: "OWNER@example.com",
      } as any;
      const only = witness(scope, "svc-a");
      scope.serviceInstances = [only.svc];

      await processRuntime(scope as any, {}, null, null);

      expect(only.seen[0]).toMatchObject({
        runId: expect.any(String),
        actor: {
          kind: "person",
          sub: "auth0|owner",
          email: "owner@example.com",
          name: "Owner",
          expiresAt: expect.any(Number),
        },
      });
    });

    it("captures the signed-in person when processing starts at a service", async () => {
      const scope = createScope();
      scope.authenticatedUser = {
        userId: "auth0|owner",
        username: "Owner",
        email: "owner@example.com",
      } as any;
      const only = witness(scope, "svc-a");
      scope.serviceInstances = [only.svc];

      await processService(scope as any, only.svc, {}, null);

      expect(only.seen[0]).toMatchObject({
        runId: expect.any(String),
        actor: {
          kind: "person",
          sub: "auth0|owner",
          email: "owner@example.com",
          name: "Owner",
          expiresAt: expect.any(Number),
        },
      });
    });
  });
});
