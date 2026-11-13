import { afterEach, expect, it, vi } from "vitest";
vi.mock("./documentation", () => ({
  bundledKnowledgeProvider: {
    id: "bundled",
    availableOffline: true,
    searchKnowledge: vi.fn(async () => []),
    readDocuments: vi.fn(async () => []),
  },
}));
import { listMistralModels, runMistralTurn } from "./mistral";
import { OutputLimitError } from "./outputLimit";
afterEach(() => vi.unstubAllGlobals());

const api = "https://api.mistral.ai/v1";
const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [] },
};
const turn = (model: {
  id: string;
  display_name: string;
  context_tokens?: number;
}) => ({
  token: "mistral-key",
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
      usage: { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

it("lists the models that chat, once each, with their context", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [
            {
              id: "mistral-small-latest",
              name: "mistral-small-2506",
              capabilities: { completion_chat: true },
              max_context_length: 131072,
            },
            {
              id: "mistral-embed",
              capabilities: { completion_chat: false },
              max_context_length: 8192,
            },
            {
              id: "mistral-large-latest",
              capabilities: { completion_chat: true },
              max_context_length: 131072,
            },
            {
              id: "mistral-large-latest",
              capabilities: { completion_chat: true },
              max_context_length: 131072,
            },
            { id: "fine-tuned" },
          ],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  expect(await listMistralModels(" mistral-key ")).toEqual([
    { id: "fine-tuned", display_name: "fine-tuned" },
    {
      id: "mistral-large-latest",
      display_name: "mistral-large-latest",
      context_tokens: 131072,
    },
    {
      id: "mistral-small-latest",
      display_name: "mistral-small-latest",
      context_tokens: 131072,
    },
  ]);
  expect(fetch.mock.calls[0]).toEqual([
    `${api}/models`,
    expect.objectContaining({
      headers: { Authorization: "Bearer mistral-key" },
      credentials: "omit",
    }),
  ]);
});

it("sends a turn to Mistral with only what its API knows", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  const result = await runMistralTurn(
    turn({
      id: "mistral-large-latest",
      display_name: "mistral-large-latest",
      context_tokens: 131072,
    }),
  );
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${api}/chat/completions`);
  expect(init.headers).toEqual({
    "Content-Type": "application/json",
    Authorization: "Bearer mistral-key",
  });
  const body = JSON.parse(init.body as string);
  expect(Object.keys(body).sort()).toEqual([
    "max_tokens",
    "messages",
    "model",
    "response_format",
    "stream",
  ]);
  expect(body.model).toBe("mistral-large-latest");
  expect(body.response_format).toEqual({ type: "json_object" });
  expect(body.max_tokens).toBe(16384);
  expect(result.text).toBe("Done");
  expect(result.usage).toMatchObject({ inputTokens: 900, outputTokens: 40 });
});

it("sizes a turn by the model's context, and refuses a board that cannot fit", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  await runMistralTurn(turn({ id: "small", display_name: "small", context_tokens: 32768 }));
  const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(init.body as string).max_tokens).toBe(8192);
  const large = {
    ...board,
    services: { ui: [{ uuid: "x", serviceId: "s", state: { text: "x".repeat(20000) } }] },
  };
  await expect(
    runMistralTurn({
      ...turn({ id: "tiny", display_name: "tiny", context_tokens: 4096 }),
      context: { board: large },
    }),
  ).rejects.toThrow(/too large/);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("says what Mistral said about a key it does not accept", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ detail: "Invalid API Key" }), { status: 401 }),
    ),
  );
  await expect(listMistralModels("wrong")).rejects.toThrow("Invalid API Key");
});

it("names Mistral when it cannot be reached", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  await expect(listMistralModels("mistral-key")).rejects.toThrow(
    /Could not reach Mistral/,
  );
});

it("keeps a cut-off turn's thinking, and goes on from it with the limit set since", async () => {
  const cutOff = `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          content: [
            { type: "thinking", thinking: [{ type: "text", text: "Weighing a timer " }] },
          ],
        },
      },
    ],
  })}\n\ndata: ${JSON.stringify({
    choices: [
      {
        delta: {
          content: [
            { type: "thinking", thinking: [{ type: "text", text: "against a clock." }] },
          ],
        },
        finish_reason: "length",
      },
    ],
  })}\n\ndata: [DONE]\n\n`;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(cutOff, { headers: { "Content-Type": "text/event-stream" } }),
    )
    .mockResolvedValueOnce(answer());
  vi.stubGlobal("fetch", fetch);
  const model = {
    id: "mistral-medium-latest",
    display_name: "mistral-medium-latest",
    context_tokens: 131072,
  };
  const onReasoning = vi.fn();
  const failure = await runMistralTurn({ ...turn(model), onReasoning }).catch(
    (error) => error,
  );
  expect(failure).toBeInstanceOf(OutputLimitError);
  expect(failure.message).toMatch(/whole output limit \(16,384 tokens\) thinking/);
  expect(failure.cutOff).toEqual({
    limit: 16384,
    reasoning: "Weighing a timer against a clock.",
  });
  expect(onReasoning).toHaveBeenCalledWith("Weighing a timer against a clock.");

  await runMistralTurn({
    ...turn(model),
    outputLimit: 40000,
    continuation: failure.cutOff,
  });
  const body = JSON.parse(
    (fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(body.max_tokens).toBe(40000);
  const [request, written, carryOn] = body.messages.slice(-3);
  expect(request.content).toMatch(/^Request: Create a timer board/);
  expect(written).toEqual({
    role: "assistant",
    content: "Reasoning so far:\nWeighing a timer against a clock.",
  });
  expect(carryOn.role).toBe("user");
  expect(carryOn.content).toMatch(/Go on from it rather than starting over/);
});
