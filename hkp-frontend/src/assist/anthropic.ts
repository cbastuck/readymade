import Anthropic from "@anthropic-ai/sdk";
import type { ModelInfo } from "@anthropic-ai/sdk/resources/models";
import type {
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import {
  addUsage,
  AssistUsage,
  formatTokens,
  fromAnthropicUsage,
  noUsage,
} from "./usage";
import { OutputLimitError } from "./outputLimit";
import { bundledKnowledgeProvider } from "./documentation";
import type { ReadymadeKnowledgeProvider } from "./knowledge";
import { Effort } from "./settings";
import { AssistScope, scopeInstruction } from "./scope";
import {
  assistSystem,
  assistTools,
  isProposalTool,
  runAssistTool,
} from "./assistTools";
import type { RunningCatalog } from "./serviceCatalog";
import { BoardDescriptor } from "../types";

export type AssistModel = Pick<ModelInfo, "id" | "display_name"> &
  Partial<Pick<ModelInfo, "capabilities" | "max_tokens">> & {
    /** The context window, for providers whose model list states it. */
    context_tokens?: number;
  };
export type Conversation = MessageParam[];
export function createAssistClient(token: string) {
  return new Anthropic({
    apiKey: token.trim(),
    dangerouslyAllowBrowser: true,
    maxRetries: 0,
    timeout: 120_000,
  });
}
export async function listAssistModels(
  token: string,
  signal?: AbortSignal,
): Promise<AssistModel[]> {
  const models: AssistModel[] = [];
  for await (const model of createAssistClient(token).models.list(
    { limit: 100 },
    { signal },
  )) {
    if (model.lifecycle !== "retired") models.push(model);
  }
  return models;
}
export function modelEfforts(model?: AssistModel): Effort[] {
  const capability = model?.capabilities?.effort;
  return [
    "default",
    ...(["low", "medium", "high", "xhigh", "max"] as const).filter(
      (level) => capability?.supported && capability[level]?.supported,
    ),
  ];
}

export async function runAssistTurn(options: {
  token: string;
  model: AssistModel;
  effort: Effort;
  /** What the person set, never more than the model states it can write. */
  outputLimit?: number;
  conversation: Conversation;
  prompt: string;
  context: unknown;
  /** What may change; a proposal is resolved against `base` accordingly. */
  scope: AssistScope;
  /** The current board, complete, that a proposal is merged into. */
  base: BoardDescriptor;
  signal: AbortSignal;
  onText: (text: string) => void;
  onStatus: (status: string) => void;
  onRawResponse?: (text: string) => void;
  /** The turn's usage so far, after every request it makes. */
  onUsage?: (usage: AssistUsage) => void;
  knowledgeProvider?: ReadymadeKnowledgeProvider;
  /** What the board's runtimes have, to hold a proposal's services to. */
  services?: RunningCatalog;
}): Promise<{
  conversation: Conversation;
  text: string;
  board?: BoardDescriptor;
  usage: AssistUsage;
}> {
  const client = createAssistClient(options.token);
  const knowledge = options.knowledgeProvider ?? bundledKnowledgeProvider;
  const { tools: assist, agentTools } = await assistTools(
    options.scope,
    knowledge,
  );
  options.signal.throwIfAborted();
  const tools = assist.map(
    (tool) =>
      ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }) as Tool,
  );
  const messages: Conversation = [
    ...options.conversation,
    {
      role: "user",
      content: `${options.prompt}\n\n${scopeInstruction(options.scope)}\n\nCurrent board and editing context:\n${JSON.stringify(options.context)}`,
    },
  ];
  let text = "";
  // Every request counts, the documentation lookups as much as the proposal.
  let usage = noUsage;
  const stated = options.model.max_tokens;
  const maxTokens = options.outputLimit
    ? Math.min(options.outputLimit, stated || options.outputLimit)
    : Math.min(16384, stated || 16384);
  for (let step = 0; step < 12; step++) {
    options.signal.throwIfAborted();
    const effort = modelEfforts(options.model).includes(options.effort)
      ? options.effort
      : "default";
    const stream = client.messages.stream(
      {
        model: options.model.id,
        max_tokens: maxTokens,
        system: assistSystem,
        messages,
        tools,
        ...(effort !== "default" ? { output_config: { effort } } : {}),
      },
      { signal: options.signal },
    );
    stream.on("text", (delta) => {
      text += delta;
      options.onText(text);
    });
    const response = await stream.finalMessage();
    usage = addUsage(usage, fromAnthropicUsage(response.usage));
    options.onUsage?.(usage);
    // Nothing of it is carried into a retry: the turn is a series of
    // requests, and the one cut off may be any of them.
    if (response.stop_reason === "max_tokens")
      throw new OutputLimitError(
        `The response reached its output limit (${formatTokens(maxTokens)} tokens). Raise the output limit in Model settings or lower the effort, then retry.`,
        { limit: maxTokens },
      );
    messages.push({ role: "assistant", content: response.content });
    const calls = response.content.filter((block) => block.type === "tool_use");
    if (!calls.length)
      return {
        conversation: messages,
        text: text || "No changes proposed.",
        usage,
      };
    const results: ToolResultBlockParam[] = [];
    let proposal: BoardDescriptor | undefined;
    let explanation = "";
    for (const call of calls) {
      options.signal.throwIfAborted();
      try {
        if (proposal && isProposalTool(call.name))
          throw new Error("Propose only once per turn.");
        const { result, proposal: proposed } = await runAssistTool(
          call.name,
          call.input,
          {
            scope: options.scope,
            base: options.base,
            knowledge,
            agentTools,
            onStatus: options.onStatus,
            services: options.services,
          },
        );
        if (proposed) {
          proposal = proposed.board;
          explanation = proposed.explanation;
        }
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(result),
        });
      } catch (error) {
        if (isProposalTool(call.name))
          options.onRawResponse?.(JSON.stringify(call.input, null, 2));
        proposal = undefined;
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          is_error: true,
          content:
            error instanceof Error ? error.message : "Invalid tool input",
        });
      }
    }
    messages.push({ role: "user", content: results });
    if (proposal)
      return {
        conversation: messages,
        text: [text, explanation].filter(Boolean).join("\n\n"),
        board: proposal,
        usage,
      };
    options.onStatus("Preparing a response…");
  }
  throw new Error(
    "The assistant reached its documentation lookup limit. Please narrow the request.",
  );
}
