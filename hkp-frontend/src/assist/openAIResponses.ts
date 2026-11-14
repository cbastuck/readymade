import { assistSystem } from "./assistTools";
import { requestResponse } from "./openAICompatible";
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
  noUsage,
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

/** A failure the server reported in the stream, said as it said it. */
class Reported extends Error {}

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
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return (await response.json()) as ResponseObject;
  if (!response.body)
    throw new Error("The server returned an empty response stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let argumentCharacters = 0;
  let streamEnded = false;
  let final: ResponseObject | undefined;
  // Each output item as it finished, by its place in the output: what the
  // response is made of when the final event does not repeat it.
  const items: Item[] = [];
  const event = (payload: string) => {
    signal.throwIfAborted();
    if (!payload.trim() || payload.trim() === "[DONE]") return;
    const chunk = JSON.parse(payload);
    switch (chunk.type) {
      case "error":
        throw new Reported(
          chunk.message || chunk.error?.message || "The server reported a generation error.",
        );
      case "response.failed":
        throw new Reported(
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
  };
  const consume = (block: string) =>
    event(
      block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n"),
    );
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
      if (done) {
        streamEnded = true;
        if (buffer.trim()) consume(buffer);
        break;
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof Reported) throw error;
    throw new Error(
      `The server response was interrupted during generation: ${error instanceof Error ? error.message : "connection lost"}. Your board has not been changed.`,
    );
  } finally {
    if (!streamEnded) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
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
    usage = addUsage(usage, fromOpenAIResponsesUsage(data.usage));
    options.onUsage?.(usage);
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
      throw turn.outputLimitReached(step, input, text, room);
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
    // each call is answered beside the thinking that made it.
    input.push(...output);
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
  }
  throw turn.lookupLimitReached(input, text, room);
}
