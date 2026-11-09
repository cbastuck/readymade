import type { AssistModel } from "./anthropic";
import {
  requestOpenAIModelList,
  runOpenAICompatibleTurn,
} from "./openAICompatible";
import { OPENCODE_GO_URL } from "./settings";

/**
 * OpenCode Go: the models of an OpenCode subscription, through the
 * OpenAI-compatible API it serves. Board Assist is the client here — no
 * OpenCode server is involved, unlike the "opencode" provider.
 *
 * Go asks two things of a client beyond that API: a stable session id per
 * conversation in `x-opencode-session`, which it refuses a request without,
 * and a user agent of its own, which a browser cannot set (a relay can).
 *
 * A relay in front of Go may ask for a key of its own, sent as `X-Relay-Key`
 * when one is set. Go itself is never sent one: its CORS check for listing
 * models does not allow the header.
 */

/** Used when a model does not state its context window. */
const DEFAULT_CONTEXT_TOKENS = 32768;
/**
 * Used when a model does not state how much it can write. Go's models mostly
 * reason before answering, and the reasoning counts against this, so the
 * 4096 a local server gets would end most turns before the board.
 */
const DEFAULT_OUTPUT_TOKENS = 32768;

const unreachable =
  "Could not reach OpenCode Go. Go does not yet answer the browser's CORS check for generating, so from this page it needs a relay: set the API base URL in Settings → Board Assist to a relay that forwards to " +
  OPENCODE_GO_URL +
  ". If you use one already, check that it is running.";

type GoModel = {
  id: string;
  name?: string;
  api?: Record<string, unknown>;
  limit?: { context?: unknown; output?: unknown };
};

/**
 * The models Board Assist can use: those Go serves through chat completions.
 * The others speak the Anthropic, Responses or Gemini APIs. A model that
 * states no API is kept, as a plain OpenAI-compatible list would have it.
 */
export async function listOpenCodeGoModels(
  base: string,
  token: string,
  relayKey: string,
  signal?: AbortSignal,
): Promise<AssistModel[]> {
  const list = (await requestOpenAIModelList(base, token, signal, {
    headers: relayHeaders(relayKey),
    unreachable,
  })) as GoModel[];
  return list
    .filter((model) => !model.api || "chat-completions" in model.api)
    .map((model) => ({
      id: model.id,
      display_name: model.name || model.id,
      ...(typeof model.limit?.context === "number"
        ? { context_tokens: model.limit.context }
        : {}),
      ...(typeof model.limit?.output === "number"
        ? { max_tokens: model.limit.output }
        : {}),
    }));
}

function relayHeaders(relayKey: string): Record<string, string> {
  return relayKey.trim() ? { "X-Relay-Key": relayKey.trim() } : {};
}

/** A fresh conversation's id; any client-chosen string Go keeps stable. */
export function newOpenCodeGoSession() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `readymade-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function runOpenCodeGoTurn(
  options: Omit<
    Parameters<typeof runOpenAICompatibleTurn>[0],
    "contextTokens" | "outputTokens" | "thinking" | "headers" | "unreachable"
  > & { session: string; relayKey: string },
) {
  const { session, relayKey, ...turn } = options;
  return runOpenAICompatibleTurn({
    ...turn,
    contextTokens: options.model.context_tokens ?? DEFAULT_CONTEXT_TOKENS,
    outputTokens: options.model.max_tokens ?? DEFAULT_OUTPUT_TOKENS,
    headers: { "X-Opencode-Session": session, ...relayHeaders(relayKey) },
    unreachable,
  });
}
