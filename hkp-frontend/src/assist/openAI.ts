import type { AssistModel } from "./anthropic";
import { requestOpenAIModelList } from "./openAICompatible";
import { runOpenAIResponsesTurn } from "./openAIResponses";
import { Effort, OPENAI_URL } from "./settings";

/**
 * OpenAI's own API, with a key from platform.openai.com. Its model list is
 * read like a compatible server's, but a turn goes over the Responses API
 * (`openAIResponses.ts`), not chat completions:
 *
 * - its newer reasoning models refuse function tools beside a
 *   `reasoning_effort` on chat completions, and take both only there;
 * - its model list is every model the key may use — embeddings, speech,
 *   images — and only some of those are for conversation;
 * - the list states neither a model's context window nor what it can write,
 *   so both come from the model's family;
 * - how hard a reasoning model thinks is `reasoning.effort`, offered as the
 *   panel's Effort, not llama.cpp's template switch.
 *
 * Like Mistral it calls the documentation and board tools itself, rather than
 * being handed pre-retrieved pages.
 */

type Family = {
  match: RegExp;
  context: number;
  output: number;
  reasons: boolean;
  /** The efforts it takes, when not all three. */
  efforts?: Exclude<Effort, "default">[];
};

/**
 * What each family can take and write, most specific first. A model newer
 * than all of these gets the last entry: it is most likely a reasoning model
 * with a large window, and Model default never sends an effort it might
 * refuse.
 */
const families: Family[] = [
  { match: /^gpt-5.*-chat/, context: 128_000, output: 16_384, reasons: false },
  // GPT-5 pro thinks at high effort only, and refuses any other.
  { match: /^gpt-5.*-pro\b/, context: 400_000, output: 128_000, reasons: true, efforts: ["high"] },
  { match: /^gpt-5/, context: 400_000, output: 128_000, reasons: true },
  { match: /^gpt-4\.1/, context: 1_047_576, output: 32_768, reasons: false },
  { match: /^gpt-4o|^chatgpt-4o/, context: 128_000, output: 16_384, reasons: false },
  { match: /^gpt-4-turbo|^gpt-4-\d{4}-preview/, context: 128_000, output: 4_096, reasons: false },
  { match: /^gpt-4/, context: 8_192, output: 4_096, reasons: false },
  { match: /^gpt-3\.5/, context: 16_385, output: 4_096, reasons: false },
  { match: /^o\d/, context: 200_000, output: 100_000, reasons: true },
  { match: /./, context: 128_000, output: 32_768, reasons: true },
];

/**
 * Models that are not for conversation, or need tools of their own that a
 * Board Assist turn does not give (deep research, computer use).
 */
const notChat =
  /embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct|deep-research|computer-use|sora/;

const unreachable =
  "Could not reach OpenAI. Check this device's network connection and try again.";

function familyOf(id: string) {
  return families.find((family) => family.match.test(id))!;
}

/** The chat models the key may use, newest first. */
export async function listOpenAIPlatformModels(
  token: string,
  signal?: AbortSignal,
): Promise<AssistModel[]> {
  const list = await requestOpenAIModelList(OPENAI_URL, token, signal, {
    unreachable,
  });
  return list
    .filter(
      (model) => /^(gpt-|chatgpt-|o\d)/.test(model.id) && !notChat.test(model.id),
    )
    .sort(
      (a, b) =>
        (typeof b.created === "number" ? b.created : 0) -
        (typeof a.created === "number" ? a.created : 0),
    )
    .map((model): AssistModel => {
      const family = familyOf(model.id);
      return {
        id: model.id,
        display_name: model.id,
        context_tokens: family.context,
        max_tokens: family.output,
        ...(family.reasons
          ? { efforts: family.efforts ?? ["low", "medium", "high"] }
          : {}),
      };
    });
}

export function runOpenAIPlatformTurn(
  options: Omit<
    Parameters<typeof runOpenAIResponsesTurn>[0],
    | "baseURL"
    | "contextTokens"
    | "outputTokens"
    | "headers"
    | "unreachable"
    | "reasoningEffort"
    | "reasons"
  > & { effort: Effort },
) {
  const { effort, ...turn } = options;
  const family = familyOf(options.model.id);
  return runOpenAIResponsesTurn({
    ...turn,
    baseURL: OPENAI_URL,
    contextTokens: options.model.context_tokens ?? family.context,
    outputTokens: options.model.max_tokens ?? family.output,
    reasons: family.reasons,
    // Only a level the model was listed with; Model default sends none.
    ...(effort !== "default" && options.model.efforts?.includes(effort)
      ? { reasoningEffort: effort }
      : {}),
    unreachable,
  });
}
