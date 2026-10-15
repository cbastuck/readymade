import { afterEach, expect, it, vi } from "vitest";
vi.mock("./documentation", () => ({
  bundledKnowledgeProvider: {
    id: "bundled",
    availableOffline: true,
    searchKnowledge: vi.fn(async () => [
      { path: "docs/services/timer.md" },
    ]),
    readDocuments: vi.fn(async () => [
      {
        path: "docs/services/timer.md",
        content:
          "Timer service id: hookup.to/service/timer. periodicValue is a number.",
      },
    ]),
  },
}));
import {
  listOpenAIModels,
  openAIBaseURL,
  runOpenAICompatibleTurn,
} from "./openAICompatible";
afterEach(() => vi.unstubAllGlobals());
const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [] },
};
const options = () => ({
  baseURL: "http://127.0.0.1:8081/v1",
  token: "",
  model: { id: "Bonsai-27B-Q1_0.gguf", display_name: "Bonsai" },
  contextTokens: 8192,
  conversation: [],
  prompt: "Create a timer board",
  context: { board },
  signal: new AbortController().signal,
  onText: vi.fn(),
  onStatus: vi.fn(),
});
it("queries local models without requiring a token and normalizes server URLs", async () => {
  const fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ data: [{ id: "Bonsai-27B-Q1_0.gguf" }] }), {
        status: 200,
      }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(openAIBaseURL("http://127.0.0.1:8081/")).toBe(
    "http://127.0.0.1:8081/v1",
  );
  expect(await listOpenAIModels("http://127.0.0.1:8081", "")).toEqual([
    { id: "Bonsai-27B-Q1_0.gguf", display_name: "Bonsai-27B-Q1_0.gguf" },
  ]);
  expect(fetch.mock.calls[0]).toEqual([
    "http://127.0.0.1:8081/v1/models",
    expect.objectContaining({ headers: {}, credentials: "omit" }),
  ]);
});
it("generates validated board JSON with bounded documentation and the queried model", async () => {
  const searchKnowledge = vi.fn(async () => [
    {
      path: "docs/services/timer.md",
      score: 10,
      excerpt: "Timer",
    },
  ]);
  const readDocuments = vi.fn(async () => [
    {
      path: "docs/services/timer.md",
      content: "Injected timer contract",
    },
  ]);
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  explanation: "Ready for review",
                  board,
                }),
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200 },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await runOpenAICompatibleTurn({
    ...options(),
    knowledgeProvider: {
      id: "test",
      availableOffline: false,
      searchKnowledge,
      readDocuments,
    },
  });
  expect(result.board).toEqual(board);
  expect(result.text).toBe("Ready for review");
  const body = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(body).toMatchObject({
    model: "Bonsai-27B-Q1_0.gguf",
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });
  expect(body.reasoning_effort).toBeUndefined();
  expect(body.messages[0].content).toContain("Injected timer contract");
  expect(searchKnowledge).toHaveBeenCalledWith(
    expect.objectContaining({ query: expect.stringContaining("timer") }),
  );
  expect(readDocuments).toHaveBeenCalledWith(["docs/services/timer.md"]);
});
it("blocks oversized boards before sending instead of truncating configuration", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    runOpenAICompatibleTurn({
      ...options(),
      context: { board: { ...board, description: "a".repeat(30000) } },
    }),
  ).rejects.toThrow("too large");
  expect(fetch).not.toHaveBeenCalled();
});
it("reports server and invalid-model-output errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Unauthorized" } }), {
          status: 401,
        }),
    ),
  );
  await expect(listOpenAIModels(options().baseURL, "key")).rejects.toThrow(
    "Unauthorized",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    explanation: "Invalid board",
                    board: {},
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
    ),
  );
  await expect(runOpenAICompatibleTurn(options())).rejects.toThrow("runtimes");
});
function streamResponse(parts: string[], complete = true) {
  const events = parts
    .map(
      (content) =>
        `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\r\n\r\n`,
    )
    .join("");
  const ending = complete
    ? `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\r\n\r\ndata: [DONE]\r\n\r\n`
    : "";
  const bytes = new TextEncoder().encode(events + ending);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 7)
          controller.enqueue(bytes.slice(offset, offset + 7));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
it("streams split SSE events and explicitly disables thinking only when requested", async () => {
  const explanation = 'Ready "for review".';
  const content = JSON.stringify({ explanation, board });
  const fetch = vi.fn(async () =>
    streamResponse([content.slice(0, 30), content.slice(30)]),
  );
  vi.stubGlobal("fetch", fetch);
  const config = { ...options(), thinking: "off" as const };
  const result = await runOpenAICompatibleTurn(config);
  expect(result.board).toEqual(board);
  expect(result.text).toBe(explanation);
  expect(config.onText).toHaveBeenCalledWith(explanation);
  expect(
    config.onStatus.mock.calls.some(([status]) =>
      status.startsWith("Receiving board output"),
    ),
  ).toBe(true);
  const body = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(body).toMatchObject({
    stream: true,
    chat_template_kwargs: { enable_thinking: false },
  });
});
it("rejects an incomplete stream instead of accepting a partial board", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      streamResponse([JSON.stringify({ explanation: "Ready", board })], false),
    ),
  );
  await expect(runOpenAICompatibleTurn(options())).rejects.toThrow(
    "before generation completed",
  );
});
it("retains raw malformed output for inspection when JSON parsing fails", async () => {
  const output = "Here is your board: {broken JSON}";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => streamResponse([output])),
  );
  const onRawResponse = vi.fn();
  await expect(
    runOpenAICompatibleTurn({ ...options(), onRawResponse }),
  ).rejects.toThrow("valid JSON");
  expect(onRawResponse).toHaveBeenCalledWith(output);
});
it("lets a successful SSE response finish instead of cancelling at DONE", async () => {
  const cancel = vi.fn();
  const content = JSON.stringify({ explanation: "Ready", board });
  const bytes = new TextEncoder().encode(
    `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
              setTimeout(() => controller.close(), 10);
            },
            cancel,
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    ),
  );
  expect((await runOpenAICompatibleTurn(options())).board).toEqual(board);
  expect(cancel).not.toHaveBeenCalled();
});
it("retains JSON when runtime and service keys fail board validation", async () => {
  const content = JSON.stringify({
    explanation: "Ready",
    board: { ...board, services: { wrong: [] } },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => streamResponse([content])),
  );
  const onRawResponse = vi.fn();
  await expect(
    runOpenAICompatibleTurn({ ...options(), onRawResponse }),
  ).rejects.toThrow("Missing service list for ui");
  expect(onRawResponse).toHaveBeenCalledWith(content);
});
it("keeps server-default thinking unspecified and respects Stop", async () => {
  const controller = new AbortController();
  const fetch = vi.fn(async () =>
    streamResponse([JSON.stringify({ explanation: "Ready", board })]),
  );
  vi.stubGlobal("fetch", fetch);
  await runOpenAICompatibleTurn(options());
  const body = JSON.parse(
    (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
  );
  expect(body.chat_template_kwargs).toBeUndefined();
  controller.abort();
  await expect(
    runOpenAICompatibleTurn({ ...options(), signal: controller.signal }),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
