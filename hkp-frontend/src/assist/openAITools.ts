import type { AssistModel, Conversation } from "./anthropic";
import {
  assistSystem,
  assistTools,
  isProposalTool,
  runAssistTool,
} from "./assistTools";
import { bundledKnowledgeProvider } from "./documentation";
import type { ReadymadeKnowledgeProvider } from "./knowledge";
import {
  OpenAIRequestOptions,
  OpenAIToolCall,
  requestCompletion,
} from "./openAICompatible";
import {
  Continuation,
  LookupLimitError,
  OutputLimitError,
  resumedTranscript,
  TOOL_STEPS,
  ToolTranscript,
} from "./outputLimit";
import { AssistScope, scopeInstruction } from "./scope";
import {
  addUsage,
  AssistUsage,
  formatTokens,
  fromOpenAIUsage,
  noUsage,
} from "./usage";
import type { RunningCatalog } from "./serviceCatalog";
import { BoardDescriptor } from "../types";

/**
 * A Board Assist turn over chat completions with tools, for a provider whose
 * API is known to call them (Mistral): the model searches and reads the
 * documentation itself, as many times as it needs, and proposes with a tool
 * call — the same tools and the same rules as an Anthropic turn
 * (`assistTools.ts`). A server whose tool calling is not known keeps the
 * one-shot turn that retrieves for it (`runOpenAICompatibleTurn`).
 *
 * Like an Anthropic turn it is a series of requests, so a cut-off one is not
 * carried on from: the request is asked again with the new limit.
 *
 * What does not depend on the wire — the budget, the history, running the
 * tools — is shared with OpenAI's Responses turn (`openAIResponses.ts`).
 */

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: OpenAIToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

/** Earlier turns, as text: what of the conversation a chat API can take. */
const HISTORY_MESSAGES = 6;

/**
 * A call id the server did not give. Mistral's own are nine letters and
 * digits, and it accepts back only that shape.
 */
function callId() {
  const letters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(9)),
    (byte) => letters[byte % letters.length],
  ).join("");
}

/**
 * The plain-text exchanges of earlier turns that fit `room` characters,
 * newest kept first, starting with a person's message. A turn's tool calls
 * and results stay in that turn; the board context of the new request is
 * what counts.
 */
function history(conversation: Conversation, room: number) {
  const recent: { role: "system" | "user" | "assistant"; content: string }[] = [];
  for (const message of [...conversation].reverse()) {
    if (typeof message.content !== "string" || !message.content.trim()) continue;
    if (message.content.length > room) break;
    recent.unshift({ role: message.role, content: message.content });
    room -= message.content.length;
    if (recent.length >= HISTORY_MESSAGES) break;
  }
  while (recent[0]?.role === "assistant") recent.shift();
  return recent;
}

export type ToolTurnOptions = OpenAIRequestOptions & {
  baseURL: string;
  token: string;
  model: AssistModel;
  contextTokens: number;
  /** What the provider allows a turn to write when the person sets nothing. */
  outputTokens?: number;
  /** What the person set, never more than the model states it can write. */
  outputLimit?: number;
  conversation: Conversation;
  prompt: string;
  context: unknown;
  scope: AssistScope;
  base: BoardDescriptor;
  signal: AbortSignal;
  onText: (text: string) => void;
  onStatus: (status: string) => void;
  onRawResponse?: (text: string) => void;
  /** The model's reasoning so far, after every request that sent some. */
  onReasoning?: (text: string) => void;
  /** The turn's usage so far, after every request it makes. */
  onUsage?: (usage: AssistUsage) => void;
  knowledgeProvider?: ReadymadeKnowledgeProvider;
  /** What the board's runtimes have, to hold a proposal's services to. */
  services?: RunningCatalog;
  /** An earlier attempt at the same request that stopped at a limit. */
  continuation?: Continuation;
};

export type ToolTurnResult = {
  conversation: Conversation;
  text: string;
  board?: BoardDescriptor;
  usage: AssistUsage;
};

/**
 * What a tool turn starts from, whatever carries it: what it may write, the
 * characters left for documentation, the request, the earlier turns that
 * fit, and the tools — and, for a turn resumed after a limit, where the
 * earlier attempt had got to over `via`.
 */
export async function prepareToolTurn(
  options: ToolTurnOptions,
  via: ToolTranscript["via"],
) {
  options.signal.throwIfAborted();
  const limit = Math.max(4096, options.contextTokens || 8192);
  const stated = options.model.max_tokens;
  const maxTokens = options.outputLimit
    ? Math.min(options.outputLimit, stated || options.outputLimit)
    : Math.min(options.outputTokens || 4096, Math.floor(limit / 4));
  // Characters, counted at two a token so that dense JSON fits too.
  let room = (limit - maxTokens - 512) * 2;
  const user = `${options.prompt}\n\n${scopeInstruction(options.scope)}\n\nCurrent board and editing context:\n${JSON.stringify(options.context)}`;
  room -= assistSystem.length + user.length;
  if (room < 0)
    throw new Error(
      options.outputLimit
        ? `The output limit (${formatTokens(maxTokens)} tokens) leaves too little of the ${formatTokens(limit)}-token context for this board. Lower it in Model settings, or edit a smaller board.`
        : "This board is too large for the model's context. Choose a model with a larger context, or edit a smaller board.",
    );
  const knowledge = options.knowledgeProvider ?? bundledKnowledgeProvider;
  const { tools, agentTools } = await assistTools(options.scope, knowledge);
  options.signal.throwIfAborted();
  // Earlier turns take at most a quarter of what is left: this turn's
  // documentation is worth more than old answers.
  const earlier = history(options.conversation, Math.floor(room / 4));
  room -= earlier.reduce((total, m) => total + m.content.length, 0);
  // What a proposal was is kept with what was said about it: when the person
  // comes back with "it did not render", the board in the context is the one
  // restored, and only this says what the model had written.
  const finished = (
    usage: AssistUsage,
    text: string,
    board?: BoardDescriptor,
  ): ToolTurnResult => ({
    conversation: [
      ...options.conversation,
      { role: "user" as const, content: options.prompt },
      {
        role: "assistant" as const,
        content: board
          ? `${text}\n\nProposed (for review; it may not have been applied):\n${JSON.stringify(board)}`
          : text,
      },
    ],
    text,
    ...(board ? { board } : {}),
    usage,
  });
  const resumed = resumedTranscript(options.continuation, via, options.model.id);
  // Only what a later request can go on from: a turn cut off at its first
  // request has nothing, and is asked again.
  const transcript = (messages: unknown[], text: string, room: number) => ({
    transcript: { via, model: options.model.id, messages: [...messages], text, room },
  });
  return {
    maxTokens,
    room: resumed?.room ?? room,
    user,
    earlier,
    tools,
    agentTools,
    knowledge,
    finished,
    /** The requests so far and what was said, when this turn resumes one. */
    resumed,
    outputLimitReached: (
      step: number,
      messages: unknown[],
      text: string,
      room: number,
    ) =>
      new OutputLimitError(
        `The response reached its output limit (${formatTokens(maxTokens)} tokens). Raise the output limit in Model settings, then ${step || resumed ? "continue" : "retry"}.`,
        {
          limit: maxTokens,
          ...(step || resumed ? transcript(messages, text, room) : {}),
        },
      ),
    lookupLimitReached: (messages: unknown[], text: string, room: number) =>
      new LookupLimitError({
        limit: maxTokens,
        ...transcript(messages, text, room),
      }),
  };
}

/**
 * Runs one request's tool calls in order and says what each answered. A
 * second proposal in the same request is refused, and a result longer than
 * the context has left is replaced by a note saying so.
 */
export async function answerToolCalls(
  calls: { id: string; name: string; arguments: string }[],
  options: ToolTurnOptions,
  turn: Pick<
    Awaited<ReturnType<typeof prepareToolTurn>>,
    "knowledge" | "agentTools"
  >,
  room: number,
) {
  let proposal: BoardDescriptor | undefined;
  let explanation = "";
  const results: { id: string; name: string; content: string }[] = [];
  for (const call of calls) {
    options.signal.throwIfAborted();
    const { name } = call;
    room -= call.arguments.length;
    let result: string;
    try {
      if (proposal && isProposalTool(name))
        throw new Error("Propose only once per turn.");
      const outcome = await runAssistTool(name, call.arguments, {
        scope: options.scope,
        base: options.base,
        knowledge: turn.knowledge,
        agentTools: turn.agentTools,
        onStatus: options.onStatus,
        services: options.services,
      });
      result = JSON.stringify(outcome.result);
      if (outcome.proposal) {
        proposal = outcome.proposal.board;
        explanation = outcome.proposal.explanation;
      } else if (result.length > room)
        result = `Error: that result is ${result.length} characters, more than the ${Math.max(0, room)} left in this model's context. Read fewer or shorter documents, or answer with what you have.`;
    } catch (error) {
      if (isProposalTool(name)) options.onRawResponse?.(call.arguments);
      proposal = undefined;
      result = `Error: ${error instanceof Error ? error.message : "Invalid tool input"}`;
    }
    room -= result.length;
    results.push({ id: call.id, name, content: result });
  }
  return { results, room, proposal, explanation };
}

export async function runOpenAIToolTurn(
  options: ToolTurnOptions & {
    /** Whether to ask for usage on a streamed answer (`stream_options`). */
    streamUsage?: boolean;
    /**
     * What the output limit is called in the request. OpenAI's reasoning
     * models refuse `max_tokens` and take `max_completion_tokens`; other
     * servers know only the older name.
     */
    outputLimitField?: "max_tokens" | "max_completion_tokens";
  },
): Promise<ToolTurnResult> {
  const turn = await prepareToolTurn(options, "chat");
  const { maxTokens, tools } = turn;
  let room = turn.room;
  const messages: ChatMessage[] = turn.resumed
    ? [...(turn.resumed.messages as ChatMessage[])]
    : [
        { role: "system", content: assistSystem },
        ...turn.earlier,
        { role: "user", content: turn.user },
      ];
  let usage = noUsage;
  let text = turn.resumed?.text ?? "";
  let reasoning = "";
  for (let step = 0; step < TOOL_STEPS; step++) {
    options.signal.throwIfAborted();
    options.onStatus(
      step ? "Preparing a response…" : "Generating with the selected model…",
    );
    const data = await requestCompletion(
      options.baseURL,
      options.token,
      options.signal,
      {
        model: options.model.id,
        messages,
        tools: tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
        [options.outputLimitField ?? "max_tokens"]: maxTokens,
        stream: true,
        ...(options.streamUsage === false
          ? {}
          : { stream_options: { include_usage: true } }),
      },
      options.onStatus,
      (written) => options.onText([text, written].filter(Boolean).join("\n\n")),
      {
        headers: options.headers,
        unreachable: options.unreachable,
        plainText: true,
      },
    );
    options.signal.throwIfAborted();
    usage = addUsage(usage, fromOpenAIUsage(data.usage));
    options.onUsage?.(usage);
    const choice = data.choices?.[0];
    const message = choice?.message;
    if (message?.reasoning) {
      reasoning = [reasoning, message.reasoning].filter(Boolean).join("\n\n");
      options.onReasoning?.(reasoning);
    }
    if (choice?.finish_reason === "length")
      throw turn.outputLimitReached(step, messages, text, room);
    const content = typeof message?.content === "string" ? message.content : "";
    if (content.trim()) text = [text, content.trim()].join("\n\n").trim();
    const calls: OpenAIToolCall[] = (message?.tool_calls ?? []).map(
      (call: OpenAIToolCall) => ({
        id: call.id || callId(),
        type: "function",
        function: {
          name: call.function?.name ?? "",
          arguments:
            typeof call.function?.arguments === "string"
              ? call.function.arguments
              : JSON.stringify(call.function?.arguments ?? {}),
        },
      }),
    );
    if (!calls.length) {
      if (!message)
        throw new Error("The server returned no assistant message.");
      return turn.finished(usage, text || "No changes proposed.");
    }
    messages.push({ role: "assistant", content, tool_calls: calls });
    room -= content.length;
    const answered = await answerToolCalls(
      calls.map((call) => ({ id: call.id, ...call.function })),
      options,
      turn,
      room,
    );
    room = answered.room;
    for (const result of answered.results)
      messages.push({
        role: "tool",
        tool_call_id: result.id,
        name: result.name,
        content: result.content,
      });
    if (answered.proposal) {
      const said = [text, answered.explanation].filter(Boolean).join("\n\n");
      options.onText(said);
      return turn.finished(usage, said, answered.proposal);
    }
  }
  throw turn.lookupLimitReached(messages, text, room);
}
