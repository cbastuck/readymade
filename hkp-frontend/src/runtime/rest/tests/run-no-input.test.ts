import { afterEach, describe, expect, it, vi } from "vitest";

import * as api from "../RuntimeRestApi";
import RuntimeRestScope from "../RuntimeRestScope";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * Running a runtime with nothing on its input.
 *
 * "Run" means the pipeline starts with nothing, and that is not the same as
 * starting it with an empty object: a service that answers an empty input with
 * its own configuration — `http-client` sends its configured body — is handed
 * `{}` as the payload instead, and sends that.
 *
 * JSON has no undefined, so `null` is how the wire says it. Sending nothing at
 * all would be a body a runtime reads as a malformed call rather than as a
 * payload, which is why this is not simply left to `JSON.stringify`.
 */

const runtime: RuntimeDescriptor = {
  id: "node",
  name: "Node",
  type: "rest",
  url: "http://127.0.0.1:8080",
} as RuntimeDescriptor;

/** No output URL, so the scope opens no WebSocket and every call goes REST. */
function makeScope() {
  const scope = new RuntimeRestScope(runtime, "", null);
  scope.onResult = vi.fn();
  return scope;
}

const ok = { ok: true, status: 200, statusText: "OK", text: async () => "null" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("processRuntime with no input", () => {
  it("sends null rather than an empty body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    await api.processRuntime(makeScope(), undefined, null);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8080/runtimes/node");
    expect(init.body).toBe("null");
  });

  it("leaves a payload that was given alone", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok);
    vi.stubGlobal("fetch", fetchMock);

    await api.processRuntime(makeScope(), { count: 3 }, null);

    expect(fetchMock.mock.calls[0][1].body).toBe('{"count":3}');
  });

  it("says null on the socket too, where an absent key is dropped", async () => {
    const scope = makeScope();
    const sent: string[] = [];
    // What an open output socket looks like to the scope.
    (scope as any).runtimeOutput = {
      readyState: 1,
      send: (frame: string) => sent.push(frame),
    };

    await api.processRuntime(scope, undefined, null);

    expect(JSON.parse(sent[0])).toMatchObject({
      type: "processRuntime",
      params: null,
    });
    // The receiving runtime tells "no input" from "no payload" by the key being
    // there, so it has to survive JSON.stringify, which drops undefined.
    expect(sent[0]).toContain('"params":null');
  });
});
