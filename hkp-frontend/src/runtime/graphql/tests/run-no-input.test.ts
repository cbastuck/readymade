import { afterEach, describe, expect, it, vi } from "vitest";

import { processRuntime } from "hkp-frontend/src/runtime/graphql/graphqlActions";
import { RuntimeDescriptor } from "hkp-frontend/src/types";

/**
 * The GraphQL runtime's half of the no-input contract.
 *
 * This one is a query built as text, so "no input" has to survive being
 * written into it. `params` is a nullable String in the schema
 * (`hkp-go/graph/schema.graphqls`), and the receiving side reads an absent one
 * as a run with nothing on the input (`hkp-go/graph/params_test.go`).
 *
 * The trap is that `JSON.stringify(undefined)` is the JS value undefined
 * rather than a string, so an unguarded encode puts the bare word `undefined`
 * into the query — where a String belongs, so the query is rejected and the
 * run never happens. Nothing about that failure looks like a payload problem.
 */

const runtime: RuntimeDescriptor = {
  id: "go-1",
  name: "Go",
  type: "graphql",
  url: "http://127.0.0.1:4000",
} as RuntimeDescriptor;

function captureQuery() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: { runtimeById: { process: { id: "go-1" } } } }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return () => JSON.parse(fetchMock.mock.calls[0][1].body).query as string;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("graphql runtime, run with no input", () => {
  it("writes params as null, not as the word undefined", async () => {
    const query = captureQuery();

    await processRuntime(runtime, undefined, null);

    expect(query()).toContain("params: null");
    expect(query()).not.toContain("undefined");
  });

  it("says the same for an explicit null", async () => {
    const query = captureQuery();

    await processRuntime(runtime, null, null);

    expect(query()).toContain("params: null");
  });

  it("still sends a payload that was given", async () => {
    const query = captureQuery();

    await processRuntime(runtime, { count: 3 }, null);

    // Encoded as a JSON string, which is what the String field carries.
    expect(query()).toContain('params: "{\\"count\\":3}"');
  });

  it("keeps an empty object a payload", async () => {
    const query = captureQuery();

    await processRuntime(runtime, {}, null);

    expect(query()).toContain('params: "{}"');
    expect(query()).not.toContain("params: null");
  });
});
