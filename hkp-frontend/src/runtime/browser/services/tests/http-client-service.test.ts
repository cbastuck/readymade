import { beforeEach, describe, expect, it, vi } from "vitest";

import HttpClientDescriptor from "../HttpClient";

/**
 * The browser HTTP Client.
 *
 * What is worth pinning down here is the part a board depends on and cannot see:
 * the address the service composes out of url, path and query, and the fact that
 * a response arrives *after* the push it belongs to has returned — so `process`
 * answers null and the pipeline behind the service is called later, with a
 * result shaped the way every runtime's client shapes one.
 */

function createMockApp() {
  return {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
  };
}

function createService() {
  const app = createMockApp();
  const svc = HttpClientDescriptor.create(
    app as any,
    "test-board",
    {} as any,
    "svc-1",
  );
  return { svc: svc as any, app };
}

/** The last notification carrying `key`, which is where an outcome is reported. */
function lastNotificationWith(app: ReturnType<typeof createMockApp>, key: string) {
  const calls = app.notify.mock.calls.filter(
    (call: any[]) => call[1] && key in call[1],
  );
  return calls.length ? calls[calls.length - 1][1] : undefined;
}

function textResponse(
  body: string,
  { status = 200, statusText = "OK", contentType = "text/plain" } = {},
) {
  return new Response(new TextEncoder().encode(body), {
    status,
    statusText,
    headers: { "content-type": contentType },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("the descriptor", () => {
  it("is the http-client concept, under the id every runtime uses", () => {
    expect(HttpClientDescriptor.serviceId).toBe("http-client");
    expect(HttpClientDescriptor.serviceName).toBe("HTTP Client");
  });

  it("creates something the runtime can call", () => {
    const { svc } = createService();
    expect(typeof svc.configure).toBe("function");
    expect(typeof svc.process).toBe("function");
  });
});

describe("default state", () => {
  it("is a client with nothing to call yet", async () => {
    const { svc } = createService();
    expect(await svc.getConfiguration()).toEqual({
      url: "",
      __hkpMount: "",
      path: "",
      query: {},
      method: "get",
      headers: {},
      userAgent: "",
      body: "",
      timeoutMs: 10000,
      bypass: false,
    });
  });
});

describe("configure", () => {
  it("takes the method in any spelling and keeps it lower case", async () => {
    const { svc, app } = createService();
    svc.configure({ method: "POST" });
    expect((await svc.getConfiguration()).method).toBe("post");
    expect(app.notify).toHaveBeenCalledWith(svc, { method: "post" });
  });

  it("ignores a method no client implements", async () => {
    const { svc } = createService();
    svc.configure({ method: "trace" });
    expect((await svc.getConfiguration()).method).toBe("get");
  });

  it("sends parameters and headers as the text they read as", async () => {
    const { svc } = createService();
    svc.configure({ query: { page: 2, verbose: true }, headers: { "x-n": 7 } });
    const state = await svc.getConfiguration();
    expect(state.query).toEqual({ page: "2", verbose: "true" });
    expect(state.headers).toEqual({ "x-n": "7" });
  });

  it("takes a mount address without touching the url that was written", async () => {
    const { svc } = createService();
    svc.configure({ url: "hkp-mount://node/echo" });
    svc.configure({ __hkpMount: "http://127.0.0.1:8080/hosted/abc" });
    const state = await svc.getConfiguration();
    expect(state.url).toBe("hkp-mount://node/echo");
    expect(state.__hkpMount).toBe("http://127.0.0.1:8080/hosted/abc");
  });
});

describe("the address it calls", () => {
  it("appends the parameters to the url", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({
      url: "https://api.example.com/zen",
      query: { q: "a b" },
    });

    svc.process(undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/zen?q=a+b");
  });

  it("ignores path when the target is a typed url", async () => {
    // `path` is the sub-path of a mount. A url is a whole url and carries its
    // own path, so appending a second one would call somewhere the board did
    // not write.
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({ url: "https://api.example.com/zen", path: "/ignored" });

    svc.process(undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/zen");
  });

  it("keeps parameters the target already carries", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({ url: "https://api.example.com/s?a=1", query: { b: "2" } });

    svc.process(undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/s?a=1&b=2");
  });

  it("prefers a resolved mount over the url that named it", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({
      url: "hkp-mount://node/echo",
      __hkpMount: "http://127.0.0.1:8080/hosted/abc",
      path: "/hello",
    });

    svc.process(undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/hosted/abc/hello",
    );
  });

  it("waits rather than dialling an unresolved reference", () => {
    const { svc, app } = createService();
    svc.configure({ url: "hkp-mount://node/echo" });

    expect(svc.process(undefined)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastNotificationWith(app, "error").error).toContain(
      "hkp-mount://node/echo",
    );
  });

  it("says so when there is nothing configured at all", () => {
    const { svc, app } = createService();

    expect(svc.process(undefined)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastNotificationWith(app, "error").error).toBe("No target configured");
  });
});

describe("a request that says where it is going", () => {
  // The envelope hkp-node's client reads, so a board calling a different
  // address per item moves between the runtimes unchanged.

  it("calls the url the input names, with the configured parameters", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("one"));
    svc.configure({ url: "https://api.example.com/default", query: { a: "1" } });

    svc.process({ meta: { url: "https://api.example.com/items/42" } });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/items/42?a=1");
  });

  it("calls the configured url when the input names none", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("one"));
    svc.configure({ url: "https://api.example.com/default" });

    svc.process({ meta: { contentType: "text/plain" }, body: "x" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/default");
  });

  it("takes the url from the input even when none is configured", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(textResponse("one"));

    svc.process({ meta: { url: "https://api.example.com/items/7" } });

    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/items/7");
    expect(app.next.mock.calls[0][1].meta.url).toBe("https://api.example.com/items/7");
  });

  it("still prefers a resolved mount, and joins the path the input names", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("ok"));
    svc.configure({ __hkpMount: "http://127.0.0.1:8080/hosted/abc", path: "/configured" });

    svc.process({ meta: { url: "https://elsewhere.example.com/", path: "/episodes/one" } });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:8080/hosted/abc/episodes/one",
    );
  });

  it("uses the method the input names, and sends a body for it", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(textResponse("ok"));
    svc.configure({ url: "https://api.example.com/things" });

    svc.process({ meta: { method: "PUT", contentType: "text/plain" }, body: "hello" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(init.body).toBe("hello");
    await vi.waitFor(() =>
      expect(lastNotificationWith(app, "method").method).toBe("put"),
    );
    expect((await svc.getConfiguration()).method).toBe("get");
  });

  it("ignores a method no client implements", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("ok"));
    svc.configure({ url: "https://api.example.com/things" });

    svc.process({ meta: { method: "brew" } });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("waits rather than dialling an unresolved reference the input names", () => {
    const { svc, app } = createService();

    expect(svc.process({ meta: { url: "hkp-mount://node/echo" } })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastNotificationWith(app, "error").error).toContain(
      "hkp-mount://node/echo",
    );
  });
});

describe("the request body", () => {
  it("is nothing on a GET, whatever came down the pipeline", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({ url: "https://api.example.com" });

    svc.process({ hello: "board" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it("is the pipeline's input, as JSON", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("ok"));
    svc.configure({ url: "https://api.example.com", method: "post" });

    svc.process({ hello: "board" });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"hello":"board"}');
    expect(init.headers["content-type"]).toBe("application/json");
  });

  it("is the configured body when nothing came down the pipeline", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("ok"));
    svc.configure({
      url: "https://api.example.com",
      method: "post",
      body: "written in the panel",
    });

    svc.process(undefined);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][1].body).toBe("written in the panel");
  });

  it("forwards what an http-server-subservices produced, unchanged", async () => {
    const { svc } = createService();
    fetchMock.mockResolvedValue(textResponse("ok"));
    svc.configure({ url: "https://api.example.com", method: "post" });

    svc.process({
      meta: { contentType: "application/xml" },
      body: "<a/>",
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe("<a/>");
    expect(init.headers["content-type"]).toBe("application/xml");
  });
});

describe("the response", () => {
  it("stops the push and calls the rest of the pipeline when it arrives", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(
      textResponse('{"hello":"board"}', { contentType: "application/json" }),
    );
    svc.configure({ url: "https://api.example.com" });

    expect(svc.process(undefined)).toBeNull();
    expect(app.next).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
    const [, result] = app.next.mock.calls[0];
    expect(result.body).toEqual({ hello: "board" });
    expect(result.meta.status).toBe(200);
    expect(result.meta.statusText).toBe("OK");
    expect(result.meta.headers["content-type"]).toBe("application/json");
  });

  it("hands over the text when a JSON content type is not JSON", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(
      textResponse("not json at all", { contentType: "application/json" }),
    );
    svc.configure({ url: "https://api.example.com" });

    svc.process(undefined);

    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
    expect(app.next.mock.calls[0][1].body).toBe("not json at all");
  });

  it("keeps the bytes when the content type does not say what they mean", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    svc.configure({ url: "https://api.example.com" });

    svc.process(undefined);

    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
    const result = app.next.mock.calls[0][1];
    expect(result.body).toBeUndefined();
    expect(Array.from(result.binary)).toEqual([1, 2, 3]);
  });

  it("is metadata alone when there is no payload", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    svc.configure({ url: "https://api.example.com" });

    svc.process(undefined);

    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
    expect(app.next.mock.calls[0][1]).toEqual({
      meta: expect.objectContaining({ status: 204 }),
    });
  });

  it("reports the outcome, clearing an earlier failure", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({ url: "https://api.example.com" });

    svc.process(undefined);

    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
    const outcome = lastNotificationWith(app, "status");
    expect(outcome).toMatchObject({
      requesting: false,
      method: "get",
      url: "https://api.example.com",
      status: 200,
      error: "",
    });
  });

  it("says it is requesting while it is", async () => {
    const { svc, app } = createService();
    fetchMock.mockResolvedValue(textResponse("zen"));
    svc.configure({ url: "https://api.example.com" });

    svc.process(undefined);

    expect(app.notify).toHaveBeenCalledWith(
      svc,
      expect.objectContaining({ requesting: true, url: "https://api.example.com" }),
    );
    await vi.waitFor(() => expect(app.next).toHaveBeenCalled());
  });
});

describe("a request that fails", () => {
  it("passes nothing on, and says what went wrong", async () => {
    const { svc, app } = createService();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    svc.configure({ url: "https://api.example.com" });

    svc.process(undefined);

    await vi.waitFor(() =>
      expect(lastNotificationWith(app, "error")).toMatchObject({ status: 0 }),
    );
    expect(lastNotificationWith(app, "error").error).toBe("Failed to fetch");
    expect(app.next).not.toHaveBeenCalled();
  });

  it("names the timeout when nothing answered in time", async () => {
    const { svc, app } = createService();
    fetchMock.mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    svc.configure({ url: "https://api.example.com", timeoutMs: 50 });

    svc.process(undefined);

    await vi.waitFor(() =>
      expect(lastNotificationWith(app, "error")).toMatchObject({ status: 0 }),
    );
    expect(lastNotificationWith(app, "error").error).toBe(
      "No response within 50 ms",
    );
  });
});
