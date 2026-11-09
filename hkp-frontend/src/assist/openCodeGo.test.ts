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
  listOpenCodeGoModels,
  newOpenCodeGoSession,
  runOpenCodeGoTurn,
} from "./openCodeGo";
afterEach(() => vi.unstubAllGlobals());

const relay = "https://example.com/opencode.php/go/v1";
const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [] },
};
const turn = (model: {
  id: string;
  display_name: string;
  context_tokens?: number;
  max_tokens?: number;
}) => ({
  baseURL: relay,
  token: "go-key",
  session: "readymade-abc",
  relayKey: "",
  model,
  conversation: [],
  prompt: "Create a timer board",
  context: { board },
  scope: { kind: "board" as const },
  base: board,
  signal: new AbortController().signal,
  onText: vi.fn(),
  onStatus: vi.fn(),
});
const answer = () =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: { content: JSON.stringify({ explanation: "Done", board: null }) },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

it("lists only the models Go serves through chat completions, with their context", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "deepseek-v4.1-flash",
              name: "DeepSeek V4.1 Flash",
              api: { "chat-completions": {} },
              limit: { context: 1000000, output: 65536 },
            },
            { id: "claude-sonnet", name: "Claude", api: { messages: {} } },
            { id: "gpt-5", name: "GPT-5", api: { responses: {} } },
            { id: "plain", name: "Plain" },
          ],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await listOpenCodeGoModels(relay, "go-key", "")).toEqual([
    {
      id: "deepseek-v4.1-flash",
      display_name: "DeepSeek V4.1 Flash",
      context_tokens: 1000000,
      max_tokens: 65536,
    },
    { id: "plain", display_name: "Plain" },
  ]);
  expect(fetch.mock.calls[0]).toEqual([
    `${relay}/models`,
    expect.objectContaining({ headers: { Authorization: "Bearer go-key" } }),
  ]);
});

it("names the conversation to Go and sizes the turn by the model's context", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  await runOpenCodeGoTurn(
    turn({ id: "deepseek-v4.1-flash", display_name: "DeepSeek", context_tokens: 1000000 }),
  );
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${relay}/chat/completions`);
  expect(init.headers).toEqual({
    "Content-Type": "application/json",
    Authorization: "Bearer go-key",
    "X-Opencode-Session": "readymade-abc",
  });
  const body = JSON.parse(init.body as string);
  expect(body.model).toBe("deepseek-v4.1-flash");
  // llama.cpp's template switch is not Go's to read.
  expect(body).not.toHaveProperty("chat_template_kwargs");
  // Unstated, a Go model gets room to reason before it writes the board.
  expect(body.max_tokens).toBe(32768);
});

it("sends a relay its key, on both the model list and the turn", async () => {
  const fetch = vi.fn(async (url: string) =>
    url.endsWith("/models")
      ? new Response(JSON.stringify({ data: [] }), { status: 200 })
      : answer(),
  );
  vi.stubGlobal("fetch", fetch);
  await listOpenCodeGoModels(relay, "go-key", " relay-secret ");
  await runOpenCodeGoTurn({
    ...turn({ id: "m", display_name: "M" }),
    relayKey: "relay-secret",
  });
  const headers = fetch.mock.calls.map(
    (call) => (call as unknown as [string, RequestInit])[1].headers,
  );
  expect(headers[0]).toEqual({
    Authorization: "Bearer go-key",
    "X-Relay-Key": "relay-secret",
  });
  expect(headers[1]).toMatchObject({
    "X-Opencode-Session": "readymade-abc",
    "X-Relay-Key": "relay-secret",
  });
});

it("lets a model write as much as it states it can", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  await runOpenCodeGoTurn(
    turn({ id: "m", display_name: "M", context_tokens: 1000000, max_tokens: 65536 }),
  );
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(init.body as string).max_tokens).toBe(65536);
});

it("says when the model thought through its whole output limit", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "" }, finish_reason: "length" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ),
  );
  await expect(
    runOpenCodeGoTurn(turn({ id: "m", display_name: "M", context_tokens: 1000000 })),
  ).rejects.toThrow(/whole output limit \(32768 tokens\) thinking/);
});

it("refuses a board too large for a model's stated context, before sending", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  const large = {
    ...board,
    services: { ui: [{ uuid: "x", serviceId: "s", state: { text: "x".repeat(20000) } }] },
  };
  await expect(
    runOpenCodeGoTurn({
      ...turn({ id: "small", display_name: "Small", context_tokens: 4096 }),
      context: { board: large },
    }),
  ).rejects.toThrow(/too large/);
  expect(fetch).not.toHaveBeenCalled();
});

it("says a relay is needed when Go cannot be reached from the page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  await expect(
    runOpenCodeGoTurn(turn({ id: "deepseek-v4.1-flash", display_name: "DeepSeek" })),
  ).rejects.toThrow(/needs a relay/);
});

it("draws a new session id for each conversation, in the characters relays accept", () => {
  const first = newOpenCodeGoSession();
  expect(first).toMatch(/^readymade-[0-9a-f]{32}$/);
  expect(newOpenCodeGoSession()).not.toBe(first);
});
