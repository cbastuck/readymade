import type { AssistModel, Conversation } from "./anthropic";
import type { ReadymadeKnowledgeProvider } from "./knowledge";
import {
  openAICompatibleSystem,
  parseTextProposal,
  prepareTextTurn,
} from "./openAICompatible";
import { BoardDescriptor } from "../types";
import { AssistScope } from "./scope";

/** A base URL for OpenCode's own HTTP API, which has no /v1 suffix. */
export function openCodeBaseURL(base: string) {
  const url = new URL(base.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use an HTTP or HTTPS OpenCode server URL without credentials or query parameters.",
    );
  return url.toString().replace(/\/+$/, "");
}

function basicAuthorization(username: string, password: string) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return `Basic ${btoa(value)}`;
}

class OpenCodeHTTPError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(
  base: string,
  path: string,
  username: string,
  password: string,
  signal?: AbortSignal,
  body?: unknown,
) {
  let response: Response;
  try {
    response = await fetch(`${openCodeBaseURL(base)}${path}`, {
      method: body === undefined ? "GET" : "POST",
      signal,
      credentials: "omit",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(password.trim()
          ? { Authorization: basicAuthorization(username.trim() || "opencode", password.trim()) }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "Could not reach the OpenCode server. Check that it is running and allows this app's browser origin (CORS).",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new OpenCodeHTTPError(
      response.status,
      data?.message || data?.error?.message || `OpenCode returned HTTP ${response.status}.`,
    );
  }
  return response;
}

type OpenCodeModel = {
  id?: unknown;
  providerID?: unknown;
  name?: unknown;
  enabled?: unknown;
  limit?: { output?: unknown };
};

/** OpenCode model refs are provider/model; model IDs may themselves contain /. */
function modelRef(id: string) {
  const slash = id.indexOf("/");
  if (slash <= 0 || slash === id.length - 1)
    throw new Error("The selected OpenCode model has an invalid provider/model id.");
  return { providerID: id.slice(0, slash), id: id.slice(slash + 1) };
}

export async function listOpenCodeModels(
  base: string,
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<AssistModel[]> {
  const result = await (
    await request(base, "/api/model", username, password, signal)
  ).json();
  if (!Array.isArray(result?.data))
    throw new Error("The OpenCode server did not return a model list.");
  return (result.data as OpenCodeModel[])
    .filter(
      (model) =>
        model.enabled !== false &&
        typeof model.providerID === "string" &&
        typeof model.id === "string",
    )
    .map((model) => ({
      id: `${model.providerID}/${model.id}`,
      display_name:
        typeof model.name === "string"
          ? `${model.name} (${model.providerID}/${model.id})`
          : `${model.providerID}/${model.id}`,
      ...(typeof model.limit?.output === "number"
        ? { max_tokens: model.limit.output }
        : {}),
    }));
}

export async function runOpenCodeTurn(options: {
  baseURL: string;
  username: string;
  password: string;
  model: AssistModel;
  contextTokens: number;
  conversation: Conversation;
  prompt: string;
  context: unknown;
  scope: AssistScope;
  base: BoardDescriptor;
  signal: AbortSignal;
  onText: (text: string) => void;
  onStatus: (status: string) => void;
  onRawResponse?: (text: string) => void;
  knowledgeProvider?: ReadymadeKnowledgeProvider;
}) {
  options.signal.throwIfAborted();
  const { user, documentation, recent } = await prepareTextTurn({
    ...options,
    tooLarge:
      "This board is too large for the configured OpenCode model context size. Increase its context limit in OpenCode and Board Assist, or edit a smaller board.",
  });
  // OpenCode's stateless API takes one prompt, so the conversation is
  // written into it rather than sent as messages.
  const previous = recent
    .map(
      (message) =>
        `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`,
    )
    .join("\n\n");
  const prompt = [
    openAICompatibleSystem,
    documentation,
    previous && `Previous conversation:\n${previous}`,
    user,
  ]
    .filter(Boolean)
    .join("\n\n");
  options.onStatus("Generating with OpenCode…");
  const body = { prompt, model: modelRef(options.model.id) };
  let response: Response;
  try {
    response = await request(
      options.baseURL,
      "/api/experimental/generate/text",
      options.username,
      options.password,
      options.signal,
      body,
    );
  } catch (error) {
    // Some OpenCode releases expose the stateless API only at this shorter
    // path; newer servers retain it as a deprecated alias.
    if (!(error instanceof OpenCodeHTTPError) || error.status !== 404)
      throw error;
    response = await request(
      options.baseURL,
      "/api/experimental/generate",
      options.username,
      options.password,
      options.signal,
      body,
    );
  }
  const result = await response.json();
  options.signal.throwIfAborted();
  const content = result?.data?.text;
  if (typeof content !== "string")
    throw new Error("The OpenCode server returned no assistant message.");
  let parsed: ReturnType<typeof parseTextProposal>;
  try {
    parsed = parseTextProposal(
      content,
      options.scope,
      options.base,
      "The OpenCode model did not return valid JSON. Try a model that follows structured prompts, or make a smaller request.",
    );
  } catch (error) {
    options.onRawResponse?.(content);
    throw error;
  }
  const { explanation, board } = parsed;
  options.onText(explanation);
  return {
    conversation: [
      ...options.conversation,
      { role: "user", content: options.prompt },
      { role: "assistant", content },
    ] as Conversation,
    text: explanation,
    board,
  };
}
