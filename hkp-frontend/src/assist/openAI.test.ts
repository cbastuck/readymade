import { afterEach, expect, it, vi } from "vitest";
vi.mock("./documentation", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  bundledKnowledgeProvider: {
    id: "bundled",
    availableOffline: true,
    searchKnowledge: vi.fn(async () => []),
    readDocuments: vi.fn(async () => []),
  },
}));
import type { AssistModel } from "./anthropic";
import { modelEfforts } from "./anthropic";
import { listOpenAIPlatformModels, runOpenAIPlatformTurn } from "./openAI";
import {
  carriesOn,
  LookupLimitError,
  OutputLimitError,
  TOOL_STEPS,
} from "./outputLimit";
afterEach(() => vi.unstubAllGlobals());

const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [] },
};
const turn = (model: AssistModel, effort: "default" | "low" | "high") => ({
  token: "sk-test",
  model,
  effort,
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
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Done" }],
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
const stream = (...events: object[]) =>
  new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
const sent = (fetch: ReturnType<typeof vi.fn>, at = 0) => {
  const [url, init] = fetch.mock.calls[at] as unknown as [string, RequestInit];
  return { url, init, body: init.body ? JSON.parse(init.body as string) : undefined };
};

it("lists only the chat models, newest first, with their family's limits", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "gpt-4o", created: 2 },
            { id: "text-embedding-3-large", created: 9 },
            { id: "gpt-5", created: 5 },
            { id: "tts-1", created: 8 },
            { id: "gpt-image-1", created: 7 },
            { id: "gpt-5-codex", created: 6 },
            { id: "gpt-5-pro", created: 7 },
            { id: "o3-pro", created: 6 },
            { id: "gpt-4o-realtime-preview", created: 6 },
            { id: "o4-mini", created: 4 },
            { id: "dall-e-3", created: 3 },
          ],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const models = await listOpenAIPlatformModels("sk-test");
  expect(models.map((model) => model.id)).toEqual([
    "gpt-5-pro",
    "gpt-5-codex",
    "o3-pro",
    "gpt-5",
    "o4-mini",
    "gpt-4o",
  ]);
  // Codex reasons like the rest of GPT-5; GPT-5 pro only at high effort.
  expect(models[1].efforts).toEqual(["low", "medium", "high"]);
  expect(models[0].efforts).toEqual(["high"]);
  expect(modelEfforts(models[0])).toEqual(["default", "high"]);
  expect(models[3]).toMatchObject({
    context_tokens: 400_000,
    max_tokens: 128_000,
    efforts: ["low", "medium", "high"],
  });
  expect(models[5].efforts).toBeUndefined();
  expect(modelEfforts(models[3])).toEqual(["default", "low", "medium", "high"]);
  expect(modelEfforts(models[5])).toEqual(["default"]);
  const { url, init } = sent(fetch);
  expect(url).toBe("https://api.openai.com/v1/models");
  expect((init.headers as Record<string, string>).Authorization).toBe(
    "Bearer sk-test",
  );
});

it("asks the Responses API with tools and the chosen reasoning effort", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  const model: AssistModel = {
    id: "gpt-5.6-luna",
    display_name: "gpt-5.6-luna",
    context_tokens: 400_000,
    max_tokens: 128_000,
    efforts: ["low", "medium", "high"],
  };
  const result = await runOpenAIPlatformTurn(turn(model, "high"));
  expect(result.text).toBe("Done");
  const { url, body } = sent(fetch);
  // Chat completions refuses function tools beside an effort for this model.
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(body).toMatchObject({
    model: "gpt-5.6-luna",
    max_output_tokens: 100_000,
    reasoning: { effort: "high" },
    include: ["reasoning.encrypted_content"],
    store: false,
    stream: true,
  });
  expect(body.instructions).toEqual(expect.any(String));
  expect(body.input.at(-1)).toMatchObject({ role: "user" });
  // The documentation and board tools, as Mistral and Anthropic get them,
  // in the Responses API's flat shape.
  expect(body.tools.length).toBeGreaterThan(0);
  expect(body.tools[0]).toMatchObject({
    type: "function",
    name: expect.any(String),
    parameters: expect.any(Object),
  });
  expect(body.reasoning_effort).toBeUndefined();
  expect(body.max_completion_tokens).toBeUndefined();
  expect(body.messages).toBeUndefined();
});

it("sends no effort on Model default, nor to a model that does not reason", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  await runOpenAIPlatformTurn(
    turn(
      { id: "gpt-5", display_name: "gpt-5", efforts: ["low", "medium", "high"] },
      "default",
    ),
  );
  await runOpenAIPlatformTurn(
    turn({ id: "gpt-4o", display_name: "gpt-4o" }, "low"),
  );
  const [reasoner, plain] = (
    fetch.mock.calls as unknown as [string, RequestInit][]
  ).map((call) => JSON.parse(call[1].body as string));
  expect(reasoner.reasoning).toBeUndefined();
  expect(reasoner.include).toEqual(["reasoning.encrypted_content"]);
  // A model that does not reason refuses to be asked for its reasoning.
  expect(plain.reasoning).toBeUndefined();
  expect(plain.include).toBeUndefined();
});

it("streams a tool call, answers it beside its reasoning, and takes the proposal", async () => {
  const reasoning = {
    type: "reasoning",
    id: "rs_1",
    summary: [],
    encrypted_content: "sealed",
  };
  const call = {
    type: "function_call",
    id: "fc_1",
    call_id: "call_1",
    name: "search_documentation",
    arguments: '{"query":"timer"}',
  };
  const propose = {
    type: "function_call",
    id: "fc_2",
    call_id: "call_2",
    name: "propose_board",
    arguments: JSON.stringify({ board, explanation: "Added a timer." }),
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      stream(
        { type: "response.output_item.added", output_index: 0, item: { type: "reasoning" } },
        { type: "response.output_item.done", output_index: 0, item: reasoning },
        { type: "response.function_call_arguments.delta", output_index: 1, delta: '{"query":' },
        { type: "response.output_item.done", output_index: 1, item: call },
        {
          type: "response.completed",
          response: {
            status: "completed",
            output: [reasoning, call],
            usage: {
              input_tokens: 100,
              input_tokens_details: { cached_tokens: 40 },
              output_tokens: 10,
            },
          },
        },
      ),
    )
    .mockResolvedValueOnce(
      stream(
        { type: "response.output_text.delta", output_index: 0, delta: "Here " },
        { type: "response.output_text.delta", output_index: 0, delta: "it is." },
        // A final event without the output still has what finished.
        {
          type: "response.output_item.done",
          output_index: 0,
          item: {
            type: "message",
            content: [{ type: "output_text", text: "Here it is." }],
          },
        },
        { type: "response.output_item.done", output_index: 1, item: propose },
        {
          type: "response.completed",
          response: { status: "completed", usage: { input_tokens: 200, output_tokens: 20 } },
        },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const model: AssistModel = {
    id: "gpt-5.6-luna",
    display_name: "gpt-5.6-luna",
    efforts: ["low", "medium", "high"],
  };
  const onText = vi.fn();
  const onUsage = vi.fn();
  const result = await runOpenAIPlatformTurn({
    ...turn(model, "low"),
    onText,
    onUsage,
  });
  const second = sent(fetch, 1).body;
  // The whole turn goes back, since nothing is stored at OpenAI: the
  // reasoning, the call, and the call's answer.
  expect(second.input.slice(-3)).toEqual([
    reasoning,
    call,
    { type: "function_call_output", call_id: "call_1", output: expect.any(String) },
  ]);
  expect(result.board).toEqual(board);
  expect(result.text).toBe("Here it is.\n\nAdded a timer.");
  expect(onText).toHaveBeenCalledWith("Here it is.");
  expect(result.usage).toMatchObject({
    requests: 2,
    inputTokens: 260,
    cacheReadTokens: 40,
    outputTokens: 30,
  });
});

it("says the output limit was reached when the response is incomplete for it", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      stream({
        type: "response.incomplete",
        response: {
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [],
        },
      }),
    ),
  );
  const failure = await runOpenAIPlatformTurn(
    turn({ id: "gpt-5", display_name: "gpt-5", max_tokens: 128_000 }, "default"),
  ).catch((error) => error);
  expect(failure).toBeInstanceOf(OutputLimitError);
  expect(failure.cutOff).toEqual({ limit: 100_000 });
});

it("says what OpenAI reported when a streamed response fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      stream({
        type: "response.failed",
        response: { status: "failed", error: { message: "The model is overloaded." } },
      }),
    ),
  );
  await expect(
    runOpenAIPlatformTurn(turn({ id: "gpt-5", display_name: "gpt-5" }, "default")),
  ).rejects.toThrow("The model is overloaded.");
});

it("keeps where a turn got to at the lookup limit, and goes on from it", async () => {
  const search = (n: number) => ({
    type: "function_call",
    id: `fc_${n}`,
    call_id: `call_${n}`,
    name: "search_documentation",
    arguments: '{"query":"timer"}',
  });
  let n = 0;
  const looking = vi.fn(async () =>
    stream({
      type: "response.completed",
      response: {
        status: "completed",
        output: [
          { type: "reasoning", id: `rs_${n}`, summary: [], encrypted_content: `sealed ${n}` },
          search(n++),
        ],
      },
    }),
  );
  vi.stubGlobal("fetch", looking);
  const model: AssistModel = { id: "gpt-5.6-luna", display_name: "gpt-5.6-luna" };
  const failure = await runOpenAIPlatformTurn(turn(model, "default")).catch(
    (error) => error,
  );
  expect(failure).toBeInstanceOf(LookupLimitError);
  expect(looking).toHaveBeenCalledTimes(TOOL_STEPS);
  const { transcript } = failure.cutOff;
  expect(failure.cutOff.lookups).toBe(true);
  expect(transcript).toMatchObject({ via: "responses", model: "gpt-5.6-luna" });
  // Every request's reasoning, call and answer, up to the last.
  expect(transcript.messages.at(-1)).toMatchObject({
    type: "function_call_output",
    call_id: `call_${TOOL_STEPS - 1}`,
  });

  const resumed = vi.fn(async () => answer());
  vi.stubGlobal("fetch", resumed);
  const result = await runOpenAIPlatformTurn({
    ...turn(model, "default"),
    continuation: failure.cutOff,
  });
  expect(result.text).toBe("Done");
  const { input } = sent(resumed).body;
  expect(input).toEqual(transcript.messages);
  expect(input[1]).toMatchObject({ encrypted_content: "sealed 0" });
  // Another model cannot read that reasoning, and starts afresh.
  await runOpenAIPlatformTurn({
    ...turn({ id: "gpt-5", display_name: "gpt-5" }, "default"),
    continuation: failure.cutOff,
  });
  expect(sent(resumed, 1).body.input).toHaveLength(1);
});

it("goes on from the requests before one cut off at its output limit", async () => {
  const call = {
    type: "function_call",
    id: "fc_1",
    call_id: "call_1",
    name: "search_documentation",
    arguments: '{"query":"timer"}',
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        stream({
          type: "response.completed",
          response: { status: "completed", output: [call] },
        }),
      )
      .mockResolvedValueOnce(
        stream({
          type: "response.incomplete",
          response: {
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output: [],
          },
        }),
      ),
  );
  const failure = await runOpenAIPlatformTurn(
    turn({ id: "gpt-5", display_name: "gpt-5" }, "default"),
  ).catch((error) => error);
  expect(failure).toBeInstanceOf(OutputLimitError);
  expect(failure.message).toMatch(/then continue\.$/);
  expect(failure.cutOff.transcript.messages.slice(-2)).toEqual([
    call,
    { type: "function_call_output", call_id: "call_1", output: expect.any(String) },
  ]);
  expect(carriesOn(failure.cutOff)).toBe(true);
});
