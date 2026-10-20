import { beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => ({
  list: vi.fn(),
  stream: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    constructor(options: unknown) {
      sdk.construct(options);
    }
    models = { list: sdk.list };
    messages = { stream: sdk.stream };
  },
}));
vi.mock("./documentation", () => ({
  foundation: "board format",
  documentationIndex: "docs/services/camera.md",
  bundledKnowledgeProvider: {
    id: "bundled",
    availableOffline: true,
    readDocuments: vi.fn(async () => [{ content: "camera config" }]),
    searchKnowledge: vi.fn(async () => []),
  },
}));
import {
  AssistModel,
  listAssistModels,
  modelEfforts,
  runAssistTurn,
} from "./anthropic";
const model = {
  id: "queried-model",
  max_tokens: 20000,
  capabilities: {
    effort: {
      supported: true,
      low: { supported: true },
      medium: { supported: true },
      high: { supported: true },
      max: { supported: false },
    },
  },
} as AssistModel;
const board = {
  runtimes: [{ id: "ui", name: "Browser", type: "browser" }],
  services: { ui: [] },
};
function response(
  content: unknown[],
  stop_reason = "tool_use",
  usage?: Record<string, number>,
) {
  sdk.stream.mockReturnValueOnce({
    on: vi.fn(),
    finalMessage: async () => ({ content, stop_reason, usage }),
  });
}
function run(extra = {}) {
  return runAssistTurn({
    token: "token",
    model,
    effort: "medium",
    conversation: [],
    prompt: "Build a board",
    context: { board },
    scope: { kind: "board" as const },
    base: board,
    signal: new AbortController().signal,
    onText: vi.fn(),
    onStatus: vi.fn(),
    ...extra,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
});
describe("Anthropic assistant", () => {
  it("counts every request of a turn, the documentation lookups too", async () => {
    response(
      [
        {
          type: "tool_use",
          id: "read",
          name: "read_documentation",
          input: { paths: ["docs/services/camera.md"] },
        },
      ],
      "tool_use",
      { input_tokens: 9000, output_tokens: 40, cache_read_input_tokens: 1000 },
    );
    response(
      [
        {
          type: "tool_use",
          id: "propose",
          name: "propose_board",
          input: { board, explanation: "Built a board." },
        },
      ],
      "tool_use",
      { input_tokens: 12000, output_tokens: 900, cache_creation_input_tokens: 500 },
    );
    const onUsage = vi.fn();
    const result = await run({ onUsage });
    expect(result.usage).toEqual({
      requests: 2,
      inputTokens: 21000,
      outputTokens: 940,
      cacheWriteTokens: 500,
      cacheReadTokens: 1000,
    });
    // Reported after each request, so a turn that fails later still shows
    // what it spent.
    expect(onUsage).toHaveBeenCalledTimes(2);
    expect(onUsage.mock.calls[0][0]).toMatchObject({ requests: 1, outputTokens: 40 });
  });
  it("queries all models and uses the official browser SDK option", async () => {
    sdk.list.mockReturnValue(
      (async function* () {
        yield { id: "one" };
        yield { id: "retired", lifecycle: "retired" };
        yield { id: "two" };
      })(),
    );
    expect((await listAssistModels(" token ")).map((item) => item.id)).toEqual([
      "one",
      "two",
    ]);
    expect(sdk.construct).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "token",
        dangerouslyAllowBrowser: true,
      }),
    );
  });
  it("only offers supported effort levels", () => {
    expect(modelEfforts(model)).toEqual(["default", "low", "medium", "high"]);
    expect(modelEfforts()).toEqual(["default"]);
  });
  it("reads documentation then produces a validated proposal with fresh context", async () => {
    const readDocuments = vi.fn(async () => [
      { path: "docs/services/camera.md", content: "camera config" },
    ]);
    response([
      {
        type: "tool_use",
        id: "read",
        name: "read_documentation",
        input: { paths: ["docs/services/camera.md"] },
      },
    ]);
    response([
      {
        type: "tool_use",
        id: "propose",
        name: "propose_board",
        input: { board, explanation: "Built a board." },
      },
    ]);
    const result = await run({
      knowledgeProvider: {
        id: "test",
        availableOffline: false,
        searchKnowledge: vi.fn(async () => []),
        readDocuments,
      },
    });
    expect(result.board).toEqual(board);
    expect(result.text).toBe("Built a board.");
    expect(readDocuments).toHaveBeenCalledWith(["docs/services/camera.md"]);
    expect(sdk.stream.mock.calls[0][0]).toMatchObject({
      model: "queried-model",
      output_config: { effort: "medium" },
    });
    expect(result.conversation[0].content).toContain("Current board");
    expect(result.conversation.at(-1)?.content).toEqual([
      expect.objectContaining({
        type: "tool_result",
        tool_use_id: "propose",
        content: expect.stringContaining("NOT been applied"),
      }),
    ]);
  });
  it("advertises and executes richer operations from an agentic provider", async () => {
    const callAgentTool = vi.fn(async () => ({
      contract: { serviceId: "timer", runtime: "node" },
    }));
    response([
      {
        type: "tool_use",
        id: "contract",
        name: "get_service_contract",
        input: { serviceId: "timer", runtime: "node" },
      },
    ]);
    response([
      {
        type: "tool_use",
        id: "propose",
        name: "propose_board",
        input: { board, explanation: "Used the contract." },
      },
    ]);
    const result = await run({
      knowledgeProvider: {
        id: "agentic-test",
        availableOffline: true,
        searchKnowledge: vi.fn(async () => []),
        readDocuments: vi.fn(async () => []),
        listAgentTools: vi.fn(async () => [
          {
            name: "get_service_contract",
            description: "Get a runtime-specific service contract.",
            inputSchema: {
              type: "object",
              properties: {
                serviceId: { type: "string" },
                runtime: { type: "string" },
              },
            },
          },
        ]),
        callAgentTool,
      },
    });
    expect(result.board).toEqual(board);
    expect(callAgentTool).toHaveBeenCalledWith("get_service_contract", {
      serviceId: "timer",
      runtime: "node",
    });
    expect(sdk.stream.mock.calls[0][0].tools).toContainEqual(
      expect.objectContaining({ name: "get_service_contract" }),
    );
  });
  it("returns validation errors to the model so it can repair its output", async () => {
    response([
      {
        type: "tool_use",
        id: "bad",
        name: "propose_board",
        input: { board: {}, explanation: "Bad" },
      },
    ]);
    response([
      {
        type: "tool_use",
        id: "good",
        name: "propose_board",
        input: { board, explanation: "Fixed" },
      },
    ]);
    const result = await run({ effort: "max" });
    expect(result.board).toEqual(board);
    expect(sdk.stream.mock.calls[0][0].output_config).toBeUndefined();
    expect(result.conversation[2].content).toEqual([
      expect.objectContaining({ is_error: true }),
    ]);
  });
  it("offers only a runtime proposal in runtime scope and merges it", async () => {
    const base = {
      runtimes: [
        { id: "ui", name: "Browser", type: "browser" },
        { id: "node", name: "Node", type: "rest", remote: "node" },
      ],
      services: { ui: [], node: [{ uuid: "keep", serviceId: "monitor" }] },
    };
    const scope = {
      kind: "runtime" as const,
      runtimeId: "ui",
      runtimeName: "Browser",
    };
    const services = [{ uuid: "t", serviceId: "timer" }];
    response([
      {
        type: "tool_use",
        id: "wrong",
        name: "propose_runtime",
        input: {
          runtime: { id: "node", name: "Node", type: "rest", remote: "node" },
          services: [],
          explanation: "Changed the other runtime",
        },
      },
    ]);
    response([
      {
        type: "tool_use",
        id: "right",
        name: "propose_runtime",
        input: {
          runtime: JSON.stringify(base.runtimes[0]),
          services,
          explanation: "Added a timer",
        },
      },
    ]);
    const result = await run({ scope, base });
    const names = sdk.stream.mock.calls[0][0].tools.map(
      (tool: { name: string }) => tool.name,
    );
    expect(names).toContain("propose_runtime");
    expect(names).not.toContain("propose_board");
    expect(sdk.stream.mock.calls[0][0].messages[0].content).toContain(
      "only runtime 'ui'",
    );
    expect(result.conversation[2].content).toEqual([
      expect.objectContaining({
        is_error: true,
        content: expect.stringContaining("keep its id"),
      }),
    ]);
    expect(result.board).toEqual({
      ...base,
      services: { ...base.services, ui: services },
    });
  });
  it("decodes serialized board tool arguments before validating", async () => {
    response([
      {
        type: "tool_use",
        id: "propose",
        name: "propose_board",
        input: { board: JSON.stringify(board), explanation: "Built a board." },
      },
    ]);
    expect((await run()).board).toEqual(board);
  });
  it("retains rejected proposal arguments when the model falls back to text", async () => {
    const input = {
      board: { runtimes: [], services: [] },
      explanation: "Invalid",
    };
    response([
      { type: "tool_use", id: "propose", name: "propose_board", input },
    ]);
    response([{ type: "text", text: "Could not propose it." }], "end_turn");
    const onRawResponse = vi.fn();
    const result = await run({ onRawResponse });
    expect(result.board).toBeUndefined();
    expect(onRawResponse).toHaveBeenCalledWith(JSON.stringify(input, null, 2));
    expect(result.conversation[2].content).toEqual([
      expect.objectContaining({ is_error: true }),
    ]);
  });
  it("rejects truncated output and cancels before issuing a request", async () => {
    response([], "max_tokens");
    await expect(run()).rejects.toThrow("output limit");
    const controller = new AbortController();
    controller.abort();
    await expect(run({ signal: controller.signal })).rejects.toThrow();
    expect(sdk.stream).toHaveBeenCalledTimes(1);
  });
});
