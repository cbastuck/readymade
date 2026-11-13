import type { AssistModel } from "./anthropic";
import {
  requestOpenAIModelList,
  runOpenAICompatibleTurn,
} from "./openAICompatible";
import { MISTRAL_URL } from "./settings";

/**
 * Mistral: the models of a Mistral account, through the chat-completions API
 * it serves at a fixed address. Its API answers the browser's CORS check, so
 * Board Assist calls it directly, as it does Anthropic.
 *
 * It differs from the OpenAI-compatible transport in two ways handled here:
 * its model list says what each model can do and how much it reads, and it
 * reports a streamed answer's usage without being asked.
 */

/** Used when a model does not state its context window. */
const DEFAULT_CONTEXT_TOKENS = 32768;
/**
 * What a turn may write unless the person sets an output limit. Mistral's
 * model list states no output limit, and the 4096 a local server gets would
 * end larger boards half-written; a model's reasoning counts against it too.
 * Never more than a quarter of the context.
 */
const OUTPUT_TOKENS = 16384;

const unreachable =
  "Could not reach Mistral. Check this device's connection, and that nothing between it and api.mistral.ai blocks the request.";

type MistralModel = {
  id: string;
  name?: string | null;
  capabilities?: { completion_chat?: unknown };
  max_context_length?: unknown;
};

/**
 * The models Board Assist can use: those that chat. Embedding, moderation and
 * OCR models are on the same list. A model that states no capabilities is
 * kept, as a plain OpenAI-compatible list would have it; an id listed twice
 * is shown once.
 */
export async function listMistralModels(
  token: string,
  signal?: AbortSignal,
): Promise<AssistModel[]> {
  const list = (await requestOpenAIModelList(MISTRAL_URL, token, signal, {
    unreachable,
  })) as MistralModel[];
  const seen = new Set<string>();
  return list
    .filter((model) => model.capabilities?.completion_chat !== false)
    .filter((model) => !seen.has(model.id) && seen.add(model.id))
    .map((model) => ({
      id: model.id,
      // Mistral names a model by its id; a list in id order keeps a family's
      // versions together.
      display_name: model.id,
      ...(typeof model.max_context_length === "number"
        ? { context_tokens: model.max_context_length }
        : {}),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function runMistralTurn(
  options: Omit<
    Parameters<typeof runOpenAICompatibleTurn>[0],
    | "baseURL"
    | "contextTokens"
    | "outputTokens"
    | "thinking"
    | "streamUsage"
    | "headers"
    | "unreachable"
  >,
) {
  return runOpenAICompatibleTurn({
    ...options,
    baseURL: MISTRAL_URL,
    contextTokens: options.model.context_tokens ?? DEFAULT_CONTEXT_TOKENS,
    outputTokens: OUTPUT_TOKENS,
    // Mistral sends usage on the last chunk unasked; the field that asks for
    // it is OpenAI's, and is left out.
    streamUsage: false,
    unreachable,
  });
}
