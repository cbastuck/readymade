import { afterEach, describe, expect, it, vi } from "vitest";

import { SecretStore, setSecretStore } from "hkp-frontend/src/core/secrets";

import httpClient from "../HttpClient";
import openAIPrompt from "../OpenAIPrompt";
import workflowBoardBuilder from "../WorkflowBoardBuilder";

/**
 * A secret's value, used and then looked for everywhere it must not be.
 *
 * These browser services send a credential the board names by reference. The
 * value must reach the request and nothing else: not what the service reports
 * (what a saved board carries), not what it tells its panel, not what it hands
 * on, and not what it writes to the console when the request fails. The
 * remote runtimes are swept the same way (hkp-node tests/secret-canary.test.ts,
 * hkp-python tests/test_secret_canary.py, hkp-rt tests/secret_canary.test.cpp);
 * Encrypt, Decrypt, Sign and the GitHub service in their own tests.
 */

const CANARY = "canary-6f1d0e2a-secret-value";

function store(): SecretStore {
  return {
    get: (alias) => (alias === "api" ? CANARY : null),
    audience: () => null,
    list: () => ["api"],
  };
}

/** Enough of an AppInstance, recording everything a service says. */
function recordingApp() {
  const said: unknown[] = [];
  return {
    said,
    app: {
      notify: (_svc: unknown, value: unknown) => said.push(value),
      next: (_svc: unknown, value: unknown) => said.push(value),
      sendAction: (action: unknown) => said.push(action),
      getRuntimeVariable: () => ({}),
      listAvailableServices: () => [],
    } as any,
  };
}

function capture() {
  const lines: string[] = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (a instanceof Error ? `${a.message}` : JSON.stringify(a) ?? String(a))).join(" "));
    });
  }
  return lines;
}

function failingFetch() {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      sent.push(JSON.stringify({ url: String(url), headers: init?.headers ?? {}, body: init?.body ?? "" }));
      return new Response("upstream failed", { status: 500 });
    }),
  );
  return sent;
}

afterEach(() => {
  setSecretStore(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a secret's value in a browser service", () => {
  it.each([
    [
      "HTTP Client",
      httpClient,
      {
        url: "https://api.example.com/hook",
        method: "POST",
        headers: { Authorization: "Bearer {{secret.api}}" },
      },
      { go: true },
    ],
    ["OpenAI Prompt", openAIPrompt, { apiKey: "{{secret.api}}", prompt: "Be brief" }, "hello"],
    [
      "Workflow Board Builder",
      workflowBoardBuilder,
      { provider: "openai", apiKey: "{{secret.api}}" },
      "a board that says hello",
    ],
  ] as const)("%s sends it, and reports, says and logs it nowhere", async (_name, descriptor, config, input) => {
    setSecretStore(store());
    const sent = failingFetch();
    const logged = capture();
    const { app, said } = recordingApp();
    const service = (descriptor as any).create(app, "Board", {} as any, "svc-1");
    await service.configure(config);

    let answer: unknown;
    try {
      answer = await service.process(input);
    } catch (error) {
      answer = error instanceof Error ? error.message : error;
    }

    // Used: the request carried it.
    expect(sent.join()).toContain(CANARY);

    const surfaces: Record<string, string> = {
      "what it reports": JSON.stringify(await service.getConfiguration()),
      "what it answered": JSON.stringify(answer) ?? "",
      "what it said": JSON.stringify(said),
      "the console": logged.join("\n"),
    };
    for (const [where, text] of Object.entries(surfaces)) {
      expect(text, where).not.toContain(CANARY);
    }
  });
});
