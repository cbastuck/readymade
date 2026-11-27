import { afterEach, describe, expect, it, vi } from "vitest";

import { ResourceBinding } from "hkp-frontend/src/runtime/board/resources";
import { OllamaPrompt, ollamaApiEndpoint } from "../OllamaPrompt";

function makeApp(bindings: ResourceBinding[] = []) {
  const notifications: any[] = [];
  const actions: any[] = [];
  const app: any = {
    notify: (_svc: any, payload: any) => notifications.push(payload),
    sendAction: (action: any) => actions.push(action),
    next: vi.fn(),
    resources: () => bindings,
  };
  return { app, notifications, actions };
}

function streamResponse(lines: string[]): Response {
  const encoded = new TextEncoder().encode(lines.join("\n"));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });
  return new Response(stream);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OllamaPrompt resource resolution", () => {
  it("normalizes an ollama resource url to its /api endpoint", () => {
    expect(ollamaApiEndpoint("http://127.0.0.1:11434")).toBe(
      "http://127.0.0.1:11434/api",
    );
    expect(ollamaApiEndpoint("http://127.0.0.1:11434/")).toBe(
      "http://127.0.0.1:11434/api",
    );
    expect(ollamaApiEndpoint("http://127.0.0.1:11434/api")).toBe(
      "http://127.0.0.1:11434/api",
    );
    expect(ollamaApiEndpoint("http://127.0.0.1:11434/api/")).toBe(
      "http://127.0.0.1:11434/api",
    );
  });

  it("resolves hkp-resource://<id> at point of use while keeping the reference in state", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/tags")) {
          return new Response(
            JSON.stringify({ models: [{ model: "llama3.2" }] }),
          );
        }
        return streamResponse([
          JSON.stringify({ message: { content: "Hello " } }),
          JSON.stringify({ message: { content: "world" } }),
        ]);
      });

    const bindings: ResourceBinding[] = [
      { id: "llm", kind: "ollama", url: "http://127.0.0.1:11434" },
    ];
    const { app } = makeApp(bindings);
    const service = new OllamaPrompt(
      app,
      "board",
      { serviceId: "hookup.to/service/ollama-prompt", serviceName: "Ollama Prompt" },
      "svc-1",
    );

    await service.configure({
      endpoint: "hkp-resource://llm",
      model: "llama3.2",
      prompt: "You are concise.",
    });

    expect(service.state.endpoint).toBe("hkp-resource://llm");
    expect((await service.getConfiguration()).endpoint).toBe("hkp-resource://llm");

    const answer = await service.process("Hi");
    expect(answer).toBe("Hello world");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:11434/api/tags");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reports when a referenced resource is unbound without calling fetch", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { app, actions, notifications } = makeApp([]);
    const service = new OllamaPrompt(
      app,
      "board",
      { serviceId: "hookup.to/service/ollama-prompt", serviceName: "Ollama Prompt" },
      "svc-1",
    );

    await service.configure({
      endpoint: "hkp-resource://llm",
      model: "llama3.2",
    });

    const result = await service.process("Hi");
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(actions).toEqual([
      expect.objectContaining({
        action: "notification",
        payload: { type: "error", message: 'resource "llm" is not bound' },
      }),
    ]);
    expect(notifications).toContainEqual({
      error: 'resource "llm" is not bound',
    });
  });
});
