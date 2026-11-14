import type { AssistModel } from "./anthropic";
import { requestOpenAIModelList } from "./openAICompatible";
import { runOpenAIToolTurn } from "./openAITools";
import { Effort, OPENAI_URL } from "./settings";

/**
 * OpenAI's own API, with a key from platform.openai.com. It speaks the same
 * chat completions as the compatible servers, and differs from them where a
 * local server would not follow:
 *
 * - its model list is every model the key may use — embeddings, speech,
 *   images — and only some of those answer chat completions;
 * - the list states neither a model's context window nor what it can write,
 *   so both come from the model's family;
 * - its reasoning models refuse `max_tokens` and take `max_completion_tokens`,
 *   which every model accepts;
 * - how hard a reasoning model thinks is `reasoning_effort`, offered as the
 *   panel's Effort, not llama.cpp's template switch.
 *
 * Like Mistral it calls the documentation and board tools itself, rather than
 * being handed pre-retrieved pages (`openAITools.ts`).
 */

type Family = {
  match: RegExp;
  context: number;
  output: number;
  reasons: boolean;
};

/**
 * What each family can take and write, most specific first. A model newer
 * than all of these gets the last entry: it is most likely a reasoning model
 * with a large window, and Model default never sends an effort it might
 * refuse.
 */
const families: Family[] = [
  { match: /^gpt-5.*-chat/, context: 128_000, output: 16_384, reasons: false },
  { match: /^gpt-5/, context: 400_000, output: 128_000, reasons: true },
  { match: /^gpt-4\.1/, context: 1_047_576, output: 32_768, reasons: false },
  { match: /^gpt-4o|^chatgpt-4o/, context: 128_000, output: 16_384, reasons: false },
  { match: /^gpt-4-turbo|^gpt-4-\d{4}-preview/, context: 128_000, output: 4_096, reasons: false },
  { match: /^gpt-4/, context: 8_192, output: 4_096, reasons: false },
  { match: /^gpt-3\.5/, context: 16_385, output: 4_096, reasons: false },
  { match: /^o\d/, context: 200_000, output: 100_000, reasons: true },
  { match: /./, context: 128_000, output: 32_768, reasons: true },
];

/** Models that are not for conversation, or answer only the Responses API. */
const notChat =
  /embedding|tts|whisper|transcribe|audio|realtime|image|dall-e|moderation|search|instruct|codex|-pro\b|deep-research|computer-use|sora/;

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
        ...(family.reasons ? { efforts: ["low", "medium", "high"] } : {}),
      };
    });
}

export function runOpenAIPlatformTurn(
  options: Omit<
    Parameters<typeof runOpenAIToolTurn>[0],
    | "baseURL"
    | "contextTokens"
    | "outputTokens"
    | "headers"
    | "unreachable"
    | "outputLimitField"
    | "reasoningEffort"
  > & { effort: Effort },
) {
  const { effort, ...turn } = options;
  const family = familyOf(options.model.id);
  return runOpenAIToolTurn({
    ...turn,
    baseURL: OPENAI_URL,
    contextTokens: options.model.context_tokens ?? family.context,
    outputTokens: options.model.max_tokens ?? family.output,
    outputLimitField: "max_completion_tokens",
    // Only a level the model was listed with; Model default sends none.
    ...(effort !== "default" && options.model.efforts?.includes(effort)
      ? { reasoningEffort: effort }
      : {}),
    unreachable,
  });
}
