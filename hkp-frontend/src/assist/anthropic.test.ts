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
  readDocumentation: vi.fn(async () => [{ content: "camera config" }]),
  searchDocumentation: vi.fn(async () => []),
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
function response(content: unknown[], stop_reason = "tool_use") {
  sdk.stream.mockReturnValueOnce({
    on: vi.fn(),
    finalMessage: async () => ({ content, stop_reason }),
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
    const result = await run();
    expect(result.board).toEqual(board);
    expect(result.text).toBe("Built a board.");
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
