import { afterEach, expect, it, vi } from "vitest";
vi.mock("./documentation", () => ({
  bundledKnowledgeProvider: {
    id: "bundled",
    availableOffline: true,
    searchKnowledge: vi.fn(async () => []),
    readDocuments: vi.fn(async () => []),
  },
}));
import {
  listOpenCodeModels,
  openCodeBaseURL,
  runOpenCodeTurn,
} from "./openCode";

afterEach(() => vi.unstubAllGlobals());

const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [] },
};

it("lists enabled OpenCode models with HTTP basic authentication", async () => {
  const fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        data: [
          {
            id: "deepseek-v4-flash",
            providerID: "opencode-go",
            name: "DeepSeek V4 Flash",
            enabled: true,
            limit: { output: 8192 },
          },
          { id: "disabled", providerID: "example", enabled: false },
        ],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(openCodeBaseURL("http://127.0.0.1:4096/")).toBe(
    "http://127.0.0.1:4096",
  );
  await expect(
    listOpenCodeModels("http://127.0.0.1:4096", "opencode", "secret"),
  ).resolves.toEqual([
    {
      id: "opencode-go/deepseek-v4-flash",
      display_name: "DeepSeek V4 Flash (opencode-go/deepseek-v4-flash)",
      max_tokens: 8192,
    },
  ]);
  expect(fetch).toHaveBeenCalledWith(
    "http://127.0.0.1:4096/api/model",
    expect.objectContaining({
      headers: { Authorization: "Basic b3BlbmNvZGU6c2VjcmV0" },
      credentials: "omit",
    }),
  );
});

it("uses OpenCode's stateless text endpoint and resolves a board proposal", async () => {
  const fetch = vi.fn(async () =>
    new Response(
      JSON.stringify({
        data: {
          text: JSON.stringify({ explanation: "Ready for review", board }),
        },
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await runOpenCodeTurn({
    baseURL: "http://127.0.0.1:4096",
    username: "opencode",
    password: "",
    model: { id: "opencode-go/deepseek-v4-flash", display_name: "DeepSeek" },
    contextTokens: 8192,
    conversation: [],
    prompt: "Create a timer board",
    context: { board },
    scope: { kind: "board" },
    base: board,
    signal: new AbortController().signal,
    onText: vi.fn(),
    onStatus: vi.fn(),
  });
  expect(result).toMatchObject({ text: "Ready for review", board });
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(init.body as string)).toMatchObject({
    model: { providerID: "opencode-go", id: "deepseek-v4-flash" },
    prompt: expect.stringContaining("Create a timer board"),
  });
});

it("falls back to the legacy stateless generation route", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { text: JSON.stringify({ explanation: "Ready", board }) },
        }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    runOpenCodeTurn({
      baseURL: "http://127.0.0.1:4096",
      username: "opencode",
      password: "",
      model: { id: "opencode/big-pickle", display_name: "Big Pickle" },
      contextTokens: 8192,
      conversation: [],
      prompt: "Create a timer board",
      context: { board },
      scope: { kind: "board" },
      base: board,
      signal: new AbortController().signal,
      onText: vi.fn(),
      onStatus: vi.fn(),
    }),
  ).resolves.toMatchObject({ text: "Ready", board });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "http://127.0.0.1:4096/api/experimental/generate/text",
    "http://127.0.0.1:4096/api/experimental/generate",
  ]);
});
