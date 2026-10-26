import { beforeEach, describe, expect, it, vi } from "vitest";

import FetcherDescriptor from "../Fetcher";

/**
 * The Fetcher's request, as composed from the input it is fetched for: the
 * `{{params.…}}` references a URL may carry, and the header expressions that
 * read the input.
 */

function createService() {
  const app = {
    notify: vi.fn(),
    next: vi.fn(),
    sendAction: vi.fn(),
    getRuntimeVariable: vi.fn(() => ({})),
  };
  const svc = FetcherDescriptor.create(app as any, "test-board", {} as any, "svc-1");
  return svc as any;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async () =>
      new Response('{"ok":true}', { headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

describe("the address it fetches", () => {
  it("fills a reference from the input, encoded as a part of the address", async () => {
    const svc = createService();
    await svc.configure({ url: "https://api.example.com/users/{{params.user.id}}?q={{params.q}}" });

    expect(await svc.process({ user: { id: 42 }, q: "a&b c" })).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/users/42?q=a%26b%20c");
  });

  it("takes a reference that is the whole url as the whole address", async () => {
    const svc = createService();
    await svc.configure({ url: "{{params.link}}" });

    await svc.process({ link: "https://example.com/a?b=1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/a?b=1");
  });

  it("leaves nothing where the input has nothing", async () => {
    const svc = createService();
    await svc.configure({ url: "https://api.example.com/items/{{params.id}}" });

    await svc.process({});
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/items/");
  });

  it("leaves a url without references as it was written", async () => {
    const svc = createService();
    await svc.configure({ url: "https://api.example.com/zen?x={{other}}" });

    await svc.process({ other: "ignored" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.example.com/zen?x={{other}}");
  });
});

describe("the headers it sends", () => {
  it("evaluates a header expression against the input", async () => {
    const svc = createService();
    await svc.configure({
      url: "https://api.example.com/me",
      headers: { "Authorization=": "concat('Bearer ', params.token)", Accept: "application/json" },
    });

    await svc.process({ token: "t0k" });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer t0k",
      Accept: "application/json",
    });
  });
});
