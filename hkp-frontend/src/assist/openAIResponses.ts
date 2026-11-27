import { assistSystem } from "./assistTools";
import {
  readEventStream,
  ReportedStreamError,
  requestResponse,
} from "./openAICompatible";
import {
  answerToolCalls,
  prepareToolTurn,
  ToolTurnOptions,
  ToolTurnResult,
} from "./openAITools";
import { TOOL_STEPS } from "./outputLimit";
import {
  addUsage,
  fromOpenAIResponsesUsage,
  inputTotal,
  noUsage,
  tokenTotal,
} from "./usage";

/**
 * A Board Assist turn over OpenAI's Responses API (`/v1/responses`), with the
 * same tools, budget and rules as a chat-completions tool turn
 * (`openAITools.ts`). OpenAI's newer reasoning models take function tools
 * together with a reasoning effort only here: chat completions refuses the
 * pair, and asks for `reasoning_effort: "none"` instead.
 *
 * Nothing is stored at OpenAI (`store: false`), so each request carries the
 * whole turn so far. A reasoning model's reasoning goes back with it, as the
 * encrypted content OpenAI hands out for that purpose, so that the model
 * carries on from its own thinking after a tool call rather than starting
 * over.
 */

/** An item of a response's output, or of the input that carries it back. */
type Item = Record<string, unknown> & { type?: string };

type ResponseObject = {
  status?: string;
  output?: Item[];
  usage?: unknown;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string } | null;
};

/** What an output's message items say, as one text. */
function outputText(output: Item[]) {
  return output
    .filter((item) => item.type === "message")
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((part: { type?: unknown; text?: unknown }) =>
      part?.type === "output_text" && typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("");
}

/** What a reasoning item's summary says, when one was sent. */
function summaryText(output: Item[]) {
  return output
    .filter((item) => item.type === "reasoning")
    .flatMap((item) => (Array.isArray(item.summary) ? item.summary : []))
    .map((part: { text?: unknown }) =>
      typeof part?.text === "string" ? part.text : "",
    )
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Why a response that came back is no answer, in the server's words where it
 * gave any: one that failed, or one that stopped early for a reason other
 * than its output limit — which a turn goes on from instead.
 */
function unfinished(data: ResponseObject): string | undefined {
  if (data.status === "failed" || (data.error && data.status !== "completed"))
    return (
      data.error?.message ||
      "The server reported that the response failed. Your board has not been changed."
    );
  if (data.status !== "incomplete") return undefined;
  const reason = data.incomplete_details?.reason;
  if (reason === "max_output_tokens") return undefined;
  return reason === "content_filter"
    ? "The response was stopped by the provider's content filter before it was complete. Your board has not been changed. Rephrase the request, or narrow it."
    : `The response stopped before it was complete${reason ? ` (${reason})` : ""}. Your board has not been changed.`;
}

/**
 * A response's output as the next request carries it back. With nothing
 * stored at OpenAI, a reasoning item goes back only with its encrypted
 * content; one sent without it — a model that reasons although its family is
 * not known to, and so was not asked for it — names an item nobody kept, and
 * the next request would be refused. It is left out, and the ids of the rest
 * with it, which would otherwise name it: a message goes back as what it
 * said, a call as itself.
 */
export function carriedBack(output: Item[]): Item[] {
  const unreadable = output.some(
    (item) => item.type === "reasoning" && !item.encrypted_content,
  );
  if (!unreadable) return output;
  return output.flatMap((item): Item[] => {
    if (item.type === "reasoning") return [];
    if (item.type === "message") {
      const said = outputText([item]);
      return said ? [{ role: "assistant", content: said }] : [];
    }
    const { id: _id, ...rest } = item;
    return [rest];
  });
}

/**
 * Asks for one response, streamed, and reads it to its end. `onText` is given
 * the answer as it streams in. A server that answers with JSON instead of a
 * stream is read the same.
 */
export async function requestResponsesTurn(
  base: string,
  token: string,
  signal: AbortSignal,
  body: unknown,
  onStatus: (text: string) => void,
  onText: (text: string) => void,
  extra?: { headers?: Record<string, string>; unreachable?: string },
): Promise<ResponseObject> {
  const response = await requestResponse(
    base,
    "/responses",
    token,
    signal,
    body,
    extra,
  );
  // A server that answers with JSON is read the same, failures included.
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return (await response.json()) as ResponseObject;
  if (!response.body)
    throw new Error("The server returned an empty response stream.");
  let text = "";
  let argumentCharacters = 0;
  let final: ResponseObject | undefined;
  // Each output item as it finished, by its place in the output: what the
  // response is made of when the final event does not repeat it.
  const items: Item[] = [];
  await readEventStream(response.body, signal, (payload) => {
    signal.throwIfAborted();
    if (!payload.trim() || payload.trim() === "[DONE]") return;
    const chunk = JSON.parse(payload);
    switch (chunk.type) {
      case "error":
        throw new ReportedStreamError(
          chunk.message || chunk.error?.message || "The server reported a generation error.",
        );
      case "response.failed":
        throw new ReportedStreamError(
          chunk.response?.error?.message || "The server reported a generation error.",
        );
      case "response.output_item.added":
        if (chunk.item?.type === "reasoning") onStatus("Model is thinking…");
        break;
      case "response.output_text.delta":
        if (typeof chunk.delta === "string") {
          text += chunk.delta;
          onStatus(`Receiving the answer… ${text.length} characters received`);
          onText(text);
        }
        break;
      case "response.function_call_arguments.delta":
        if (typeof chunk.delta === "string") {
          argumentCharacters += chunk.delta.length;
          onStatus(`Receiving a tool call… ${argumentCharacters} characters received`);
        }
        break;
      case "response.output_item.done":
        if (chunk.item && typeof chunk.output_index === "number")
          items[chunk.output_index] = chunk.item;
        break;
      case "response.completed":
      case "response.incomplete":
        final = chunk.response ?? {};
        break;
    }
  });
  if (!final)
    throw new Error(
      "The server connection ended before generation completed. Your board has not been changed.",
    );
  const done: ResponseObject = final;
  return {
    ...done,
    output: done.output?.length ? done.output : items.filter(Boolean),
  };
}

export async function runOpenAIResponsesTurn(
  options: ToolTurnOptions & {
    /** OpenAI's `reasoning.effort`; unset leaves it to the model. */
    reasoningEffort?: string;
    /** Whether the model reasons, and so has reasoning to carry back. */
    reasons: boolean;
  },
): Promise<ToolTurnResult> {
  const turn = await prepareToolTurn(options, "responses");
  const { maxTokens } = turn;
  let room = turn.room;
  // A resumed turn carries the reasoning it had, still encrypted: the model
  // goes on thinking from it.
  const input: Item[] = turn.resumed
    ? [...(turn.resumed.messages as Item[])]
    : [
        ...turn.earlier.map((message) => ({ ...message })),
        { role: "user", content: turn.user },
      ];
  const tools = turn.tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    strict: false,
  }));
  let usage = noUsage;
  let text = turn.resumed?.text ?? "";
  let reasoning = "";
  // What the last request read and wrote: about what the next one sends.
  let sent = 0;
  for (let step = 0; step < TOOL_STEPS; step++) {
    options.signal.throwIfAborted();
    options.onStatus(
      step ? "Preparing a response…" : "Generating with the selected model…",
    );
    const data = await requestResponsesTurn(
      options.baseURL,
      options.token,
      options.signal,
      {
        model: options.model.id,
        instructions: assistSystem,
        input,
        tools,
        max_output_tokens: maxTokens,
        ...(options.reasoningEffort
          ? { reasoning: { effort: options.reasoningEffort } }
          : {}),
        // Only a reasoning model has any; any other refuses to be asked.
        ...(options.reasons ? { include: ["reasoning.encrypted_content"] } : {}),
        store: false,
        stream: true,
      },
      options.onStatus,
      (written) => options.onText([text, written].filter(Boolean).join("\n\n")),
      { headers: options.headers, unreachable: options.unreachable },
    );
    options.signal.throwIfAborted();
    const request = fromOpenAIResponsesUsage(data.usage);
    usage = addUsage(usage, request);
    options.onUsage?.(usage);
    const failure = unfinished(data);
    if (failure) throw new Error(failure);
    const output = data.output ?? [];
    const summary = summaryText(output);
    if (summary) {
      reasoning = [reasoning, summary].filter(Boolean).join("\n\n");
      options.onReasoning?.(reasoning);
    }
    if (
      data.status === "incomplete" &&
      data.incomplete_details?.reason === "max_output_tokens"
    )
      throw turn.outputLimitReached(step, input, text, room, inputTotal(request));
    const content = outputText(output);
    if (content.trim()) text = [text, content.trim()].join("\n\n").trim();
    const calls = output
      .filter((item) => item.type === "function_call")
      .map((item) => ({
        id: String(item.call_id ?? ""),
        name: typeof item.name === "string" ? item.name : "",
        arguments:
          typeof item.arguments === "string"
            ? item.arguments
            : JSON.stringify(item.arguments ?? {}),
      }));
    if (!calls.length) {
      if (!output.length)
        throw new Error("The server returned no assistant message.");
      return turn.finished(usage, text || "No changes proposed.");
    }
    // The response goes back as it came — reasoning, message and calls — so
    // each call is answered beside the thinking that made it. The reasoning
    // is not counted against `room`: its encrypted size says little about the
    // tokens it takes, and the model's long thinking can still fill the
    // context over many lookups, which the provider then refuses.
    input.push(...carriedBack(output));
    room -= content.length;
    const answered = await answerToolCalls(calls, options, turn, room);
    room = answered.room;
    for (const result of answered.results)
      input.push({
        type: "function_call_output",
        call_id: result.id,
        output: result.content,
      });
    if (answered.proposal) {
      const said = [text, answered.explanation].filter(Boolean).join("\n\n");
      options.onText(said);
      return turn.finished(usage, said, answered.proposal);
    }
    sent = tokenTotal(request);
  }
  throw turn.lookupLimitReached(input, text, room, sent);
}
