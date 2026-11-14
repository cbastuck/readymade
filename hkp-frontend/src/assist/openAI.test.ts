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
      choices: [
        {
          message: {
            content: "Done",
          },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
const sent = (fetch: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
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
  expect(models.map((model) => model.id)).toEqual(["gpt-5", "o4-mini", "gpt-4o"]);
  expect(models[0]).toMatchObject({
    context_tokens: 400_000,
    max_tokens: 128_000,
    efforts: ["low", "medium", "high"],
  });
  expect(models[2].efforts).toBeUndefined();
  expect(modelEfforts(models[0])).toEqual(["default", "low", "medium", "high"]);
  expect(modelEfforts(models[2])).toEqual(["default"]);
  const { url, init } = sent(fetch);
  expect(url).toBe("https://api.openai.com/v1/models");
  expect((init.headers as Record<string, string>).Authorization).toBe(
    "Bearer sk-test",
  );
});

it("asks with tools, max_completion_tokens and the chosen reasoning effort", async () => {
  const fetch = vi.fn(async () => answer());
  vi.stubGlobal("fetch", fetch);
  const model: AssistModel = {
    id: "gpt-5",
    display_name: "gpt-5",
    context_tokens: 400_000,
    max_tokens: 128_000,
    efforts: ["low", "medium", "high"],
  };
  const result = await runOpenAIPlatformTurn(turn(model, "high"));
  expect(result.text).toBe("Done");
  const { url, body } = sent(fetch);
  expect(url).toBe("https://api.openai.com/v1/chat/completions");
  expect(body).toMatchObject({
    model: "gpt-5",
    max_completion_tokens: 100_000,
    reasoning_effort: "high",
  });
  // The documentation and board tools, as Mistral and Anthropic get them.
  expect(body.tools.length).toBeGreaterThan(0);
  expect(body.max_tokens).toBeUndefined();
  expect(body.chat_template_kwargs).toBeUndefined();
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
  for (const call of fetch.mock.calls as unknown as [string, RequestInit][])
    expect(JSON.parse(call[1].body as string).reasoning_effort).toBeUndefined();
});
