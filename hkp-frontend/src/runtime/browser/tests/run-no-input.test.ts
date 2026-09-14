import { describe, expect, it, vi } from "vitest";

import BrowserRuntimeScope from "hkp-frontend/src/runtime/browser/BrowserRuntimeScope";
import { processRuntime } from "hkp-frontend/src/runtime/browser/BrowserRuntimeApi";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * The browser runtime's half of the no-input contract.
 *
 * "Run" starts the pipeline with nothing on its input, which is not the same
 * as starting it with an empty object: a service that answers an empty input
 * with its own configuration behaves differently for the two, and `{}` is a
 * payload someone can also mean.
 *
 * Every runtime pins the same contract in its own suite:
 * `src/runtime/rest/tests/run-no-input.test.ts` (what the wire carries),
 * `hkp-node/tests/server.test.ts`, `hkp-python/tests/test_server.py`,
 * `hkp-rt/tests/runtime_no_input.test.cpp`, `hkp-go/graph/params_test.go`.
 * Here there is no wire at all — the service is called in this process — so
 * undefined stays undefined.
 */

function createScope() {
  const runtime: RuntimeDescriptor = {
    id: "rt-no-input",
    name: "Browser Runtime",
    type: "browser",
  };
  return new BrowserRuntimeScope(runtime, {} as any);
}

function recordingService(uuid: string) {
  const seen: unknown[] = [];
  const service = {
    uuid,
    board: "test-board",
    app: null,
    serviceId: `test/${uuid}`,
    serviceName: uuid,
    configure: vi.fn(),
    process: vi.fn((input: unknown) => {
      seen.push(input);
      return input;
    }),
    destroy: vi.fn(),
    bypass: false,
  } as any;
  return { service, seen };
}

describe("browser runtime, run with no input", () => {
  it("hands the first service undefined", async () => {
    const scope = createScope();
    const { service, seen } = recordingService("svc-a");
    scope.serviceInstances = [service];

    await processRuntime(scope as any, undefined, null, null);

    expect(seen).toEqual([undefined]);
  });

  it("hands it an empty object when that is what was asked for", async () => {
    const scope = createScope();
    const { service, seen } = recordingService("svc-a");
    scope.serviceInstances = [service];

    await processRuntime(scope as any, {}, null, null);

    // The distinction the whole contract rests on: `{}` is a payload.
    expect(seen).toEqual([{}]);
  });
});
