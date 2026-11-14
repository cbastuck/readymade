import { afterEach, expect, it, vi } from "vitest";
vi.mock("./documentation", () => ({
  foundation: "board format",
  documentationIndex: "docs/services/timer.md",
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
/** One answer as Mistral sends it unstreamed: text, tool calls, or both. */
const answer = (
  message: { content?: unknown; tool_calls?: unknown[] },
  finish_reason = message.tool_calls ? "tool_calls" : "stop",
) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: "", ...message }, finish_reason }],
      usage: { prompt_tokens: 900, completion_tokens: 40, total_tokens: 940 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
const call = (id: string, name: string, args: unknown) => ({
  id,
  type: "function",
  function: { name, arguments: JSON.stringify(args) },
});
const sent = (fetch: { mock: { calls: unknown[][] } }, at: number) =>
  JSON.parse((fetch.mock.calls[at][1] as RequestInit).body as string);
const knowledge = (extra = {}) => ({
  id: "test",
  availableOffline: false,
  searchKnowledge: vi.fn(async () => [
    { path: "docs/services/timer.md", score: 3, excerpt: "timer" },
  ]),
  readDocuments: vi.fn(async (paths: string[]) =>
    paths.map((path) => ({ path, content: "timer config" })),
  ),
  ...extra,
});

it("sends a turn to Mistral with its tools and only what its API knows", async () => {
  const fetch = vi.fn(async () => answer({ content: "A timer counts down." }));
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
  const body = sent(fetch, 0);
  expect(Object.keys(body).sort()).toEqual([
    "max_tokens",
    "messages",
    "model",
    "stream",
    "tools",
  ]);
  expect(body.model).toBe("mistral-large-latest");
  expect(body.max_tokens).toBe(16384);
  expect(
    body.tools.map((tool: { function: { name: string } }) => tool.function.name),
  ).toEqual(["search_documentation", "read_documentation", "propose_board"]);
  expect(body.tools[0]).toMatchObject({
    type: "function",
    function: { parameters: { required: ["query"] } },
  });
  expect(body.messages[0].role).toBe("system");
  expect(body.messages[0].content).toMatch(/docs\/services\/timer\.md/);
  expect(body.messages[1].content).toMatch(/^Create a timer board/);
  expect(result.text).toBe("A timer counts down.");
  expect(result.board).toBeUndefined();
  expect(result.usage).toMatchObject({ inputTokens: 900, outputTokens: 40 });
});

it("reads the documentation it asks for, then proposes with a tool call", async () => {
  const stream = `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "readDocs1",
              function: { name: "read_documentation", arguments: '{"paths":' },
            },
          ],
        },
      },
    ],
  })}\n\ndata: ${JSON.stringify({
    choices: [
      {
        delta: {
          tool_calls: [
            { index: 0, function: { arguments: '["docs/services/timer.md"]}' } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
  })}\n\ndata: [DONE]\n\n`;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(stream, { headers: { "Content-Type": "text/event-stream" } }),
    )
    .mockResolvedValueOnce(
      answer({
        tool_calls: [
          call("propose01", "propose_board", { board, explanation: "Added a timer." }),
        ],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const provider = knowledge();
  const onText = vi.fn();
  const result = await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    knowledgeProvider: provider,
    onText,
  });
  expect(provider.readDocuments).toHaveBeenCalledWith(["docs/services/timer.md"]);
  const [assistant, tool] = sent(fetch, 1).messages.slice(-2);
  expect(assistant).toEqual({
    role: "assistant",
    content: "",
    tool_calls: [
      call("readDocs1", "read_documentation", { paths: ["docs/services/timer.md"] }),
    ],
  });
  expect(tool).toEqual({
    role: "tool",
    tool_call_id: "readDocs1",
    name: "read_documentation",
    content: JSON.stringify([
      { path: "docs/services/timer.md", content: "timer config" },
    ]),
  });
  expect(result.board).toEqual(board);
  expect(result.text).toBe("Added a timer.");
  expect(onText).toHaveBeenLastCalledWith("Added a timer.");
  expect(result.usage).toMatchObject({ inputTokens: 1000, outputTokens: 50 });
  // What carries into the next turn is what was said and proposed, not the
  // tool transcript.
  expect(result.conversation).toEqual([
    { role: "user", content: "Create a timer board" },
    {
      role: "assistant",
      content: `Added a timer.\n\nProposed (for review; it may not have been applied):\n${JSON.stringify(board)}`,
    },
  ]);
});

it("shows the next turn what it proposed, when the person says it failed", async () => {
  const fetch = vi.fn(async () => answer({ content: "Columns are names." }));
  vi.stubGlobal("fetch", fetch);
  const proposed = { ...board, boardName: "Todo" };
  await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    conversation: [
      { role: "user", content: "Make a todo app" },
      {
        role: "assistant",
        content: `Built it.\n\nProposed (for review; it may not have been applied):\n${JSON.stringify(proposed)}`,
      },
    ],
    prompt: "It did not render: column.lastIndexOf is not a function",
  });
  const [, before, said, now] = sent(fetch, 0).messages;
  expect(before).toEqual({ role: "user", content: "Make a todo app" });
  expect(said.content).toContain('"boardName":"Todo"');
  expect(now.content).toMatch(/^It did not render/);
});

it("hands a proposal that does not validate back to the model to repair", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      answer({
        tool_calls: [call("badBoard1", "propose_board", { board: {}, explanation: "Bad" })],
      }),
    )
    .mockResolvedValueOnce(
      answer({
        tool_calls: [call("goodBoard", "propose_board", { board, explanation: "Fixed" })],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const onRawResponse = vi.fn();
  const result = await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    onRawResponse,
  });
  expect(result.board).toEqual(board);
  const tool = sent(fetch, 1).messages.at(-1);
  expect(tool.tool_call_id).toBe("badBoard1");
  expect(tool.content).toMatch(/^Error: /);
  expect(onRawResponse).toHaveBeenCalledWith(
    JSON.stringify({ board: {}, explanation: "Bad" }),
  );
});

it("tells the model what is wrong with its facade, so it fixes it within the turn", async () => {
  const todo = (columns: unknown[]) => ({
    ...board,
    facade: {
      layout: "single",
      panels: [
        { id: "list", layout: { type: "data-table", source: { serviceUuid: "todos" }, columns } },
      ],
    },
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      answer({
        tool_calls: [
          call("todoBoard", "propose_board", {
            board: todo([{ key: "title", label: "Task" }]),
            explanation: "A todo list.",
          }),
        ],
      }),
    )
    .mockResolvedValueOnce(
      answer({
        tool_calls: [
          call("todoFixed", "propose_board", { board: todo(["title"]), explanation: "Fixed." }),
        ],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await runMistralTurn(
    turn({ id: "m", display_name: "m", context_tokens: 131072 }),
  );
  expect(sent(fetch, 1).messages.at(-1).content).toContain(
    "facade.panels[0].layout (data-table).columns[0]: must be string, not object.",
  );
  expect(result.board?.facade).toEqual(todo(["title"]).facade);
});

it("offers and runs the knowledge server's own tools", async () => {
  const callAgentTool = vi.fn(async () => ({ contract: { serviceId: "timer" } }));
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      answer({
        tool_calls: [call("contract1", "get_service_contract", { serviceId: "timer" })],
      }),
    )
    .mockResolvedValueOnce(answer({ content: "Timer takes an interval." }));
  vi.stubGlobal("fetch", fetch);
  const result = await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    knowledgeProvider: knowledge({
      listAgentTools: vi.fn(async () => [
        {
          name: "get_service_contract",
          description: "A service's contract.",
          inputSchema: { type: "object", properties: { serviceId: { type: "string" } } },
        },
      ]),
      callAgentTool,
    }),
  });
  expect(sent(fetch, 0).tools.at(-1).function.name).toBe("get_service_contract");
  expect(callAgentTool).toHaveBeenCalledWith("get_service_contract", {
    serviceId: "timer",
  });
  expect(sent(fetch, 1).messages.at(-1).content).toBe(
    JSON.stringify({ contract: { serviceId: "timer" } }),
  );
  expect(result.text).toBe("Timer takes an interval.");
});

it("hands the knowledge server an object a model sent as its JSON text", async () => {
  const callAgentTool = vi.fn(async () => ({ valid: true, diagnostics: [] }));
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      answer({
        tool_calls: [
          call("validate1", "validate_board", {
            board: JSON.stringify(board),
            note: "{not json",
            label: '{"kept":"as text"}',
          }),
        ],
      }),
    )
    .mockResolvedValueOnce(answer({ content: "It validates." }));
  vi.stubGlobal("fetch", fetch);
  await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    knowledgeProvider: knowledge({
      listAgentTools: vi.fn(async () => [
        {
          name: "validate_board",
          description: "Validate a board.",
          // What the server says of `board`: nothing, so a model may send text.
          inputSchema: {
            type: "object",
            properties: { board: {}, note: {}, label: { type: "string" } },
            required: ["board"],
          },
        },
      ]),
      callAgentTool,
    }),
  });
  expect(callAgentTool).toHaveBeenCalledWith("validate_board", {
    board,
    note: "{not json",
    label: '{"kept":"as text"}',
  });
});

it("refuses a read the model's context cannot hold, and says so to the model", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      answer({
        tool_calls: [call("readHuge1", "read_documentation", { paths: ["docs/huge.md"] })],
      }),
    )
    .mockResolvedValueOnce(answer({ content: "Asked for less." }));
  vi.stubGlobal("fetch", fetch);
  await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 32768 }),
    knowledgeProvider: knowledge({
      readDocuments: vi.fn(async () => [{ path: "docs/huge.md", content: "x".repeat(60000) }]),
    }),
  });
  expect(sent(fetch, 1).messages.at(-1).content).toMatch(
    /^Error: that result is \d+ characters, more than the \d+ left/,
  );
});

it("sizes a turn by the model's context, and refuses a board that cannot fit", async () => {
  const fetch = vi.fn(async () => answer({ content: "Done" }));
  vi.stubGlobal("fetch", fetch);
  await runMistralTurn(turn({ id: "small", display_name: "small", context_tokens: 32768 }));
  expect(sent(fetch, 0).max_tokens).toBe(8192);
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

it("keeps a cut-off turn's thinking to show, and asks again rather than going on", async () => {
  const cutOff = `data: ${JSON.stringify({
    choices: [
      {
        delta: {
          content: [
            { type: "thinking", thinking: [{ type: "text", text: "Weighing a timer." }] },
          ],
        },
        finish_reason: "length",
      },
    ],
  })}\n\ndata: [DONE]\n\n`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(cutOff, { headers: { "Content-Type": "text/event-stream" } })),
  );
  const onReasoning = vi.fn();
  const failure = await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    onReasoning,
  }).catch((error) => error);
  expect(failure).toBeInstanceOf(OutputLimitError);
  expect(failure.message).toMatch(/output limit \(16,384 tokens\)/);
  // Nothing to go on from: the panel offers Retry, as for Anthropic.
  expect(failure.cutOff).toEqual({ limit: 16384 });
  expect(onReasoning).toHaveBeenCalledWith("Weighing a timer.");
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

it("tells the model which service does not exist, so it picks a real one within the turn", async () => {
  const withService = (serviceId: string) => ({
    ...board,
    services: { ui: [{ uuid: "store", serviceId, serviceName: "Store" }] },
  });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      answer({
        tool_calls: [
          call("madeUp001", "propose_board", {
            board: withService("hookup.to/service/storage"),
            explanation: "Stores the todos.",
          }),
        ],
      }),
    )
    .mockResolvedValueOnce(
      answer({
        tool_calls: [
          call("realOne01", "propose_board", {
            board: withService("hookup.to/service/local-storage"),
            explanation: "Stores the todos.",
          }),
        ],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const result = await runMistralTurn({
    ...turn({ id: "m", display_name: "m", context_tokens: 131072 }),
    services: { runtimes: board.runtimes, registry: {} },
  });
  const tool = sent(fetch, 1).messages.at(-1);
  expect(tool.tool_call_id).toBe("madeUp001");
  expect(tool.content).toMatch(
    /^Error: .*"hookup\.to\/service\/storage" \(store in runtime ui\)/,
  );
  expect(result.board?.services.ui[0].serviceId).toBe(
    "hookup.to/service/local-storage",
  );
});
