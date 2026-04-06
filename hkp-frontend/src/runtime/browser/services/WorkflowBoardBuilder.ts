import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import WorkflowBoardBuilderUI from "./WorkflowBoardBuilderUI";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";
import { buildWorkflowSystemPrompt } from "./workflow-prompt/SystemPromptCatalog";
import {
  DEFAULT_GENERATED_BOARD,
  DEFAULT_WORKFLOW_DESCRIPTION,
} from "./workflow-prompt/DefaultWorkflowBoard";

const serviceName = "Workflow Board Builder";
const serviceId = "hookup.to/service/workflow-board-builder";

type Provider = "claude" | "openai" | "gemini";

type State = {
  provider: Provider;
  model: string;
  description: string;
  inputBoardSource: string;
  generatedBoardSource: string;
  isEditorOpen: boolean;
  busy: boolean;
  lastError: string;
};

const DEFAULT_MODELS: Record<Provider, string> = {
  claude: "claude-3-7-sonnet-latest",
  openai: "gpt-4.1-mini",
  gemini: "gemini-2.0-flash",
};

export class WorkflowBoardBuilder extends ServiceBase<State> {
  private apiKeys: Partial<Record<Provider, string>> = {};

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      provider: "claude",
      model: DEFAULT_MODELS.claude,
      description: DEFAULT_WORKFLOW_DESCRIPTION,
      inputBoardSource: "",
      generatedBoardSource: JSON.stringify(DEFAULT_GENERATED_BOARD, null, 2),
      isEditorOpen: false,
      busy: false,
      lastError: "",
    });
  }

  async configure(config: any) {
    const {
      provider,
      model,
      description,
      inputBoardSource,
      generatedBoardSource,
    } = config || {};

    if (needsUpdate(provider, this.state.provider)) {
      this.state.provider = provider;
      if (!model) {
        this.state.model =
          DEFAULT_MODELS[provider as Provider] || this.state.model;
      }
      this.app.notify(this, {
        provider: this.state.provider,
        model: this.state.model,
      });
    }

    if (needsUpdate(model, this.state.model)) {
      this.state.model = model;
      this.app.notify(this, { model: this.state.model });
    }

    if (description !== undefined) {
      this.state.description = description;
      this.app.notify(this, { description: this.state.description });
    }

    if (inputBoardSource !== undefined) {
      this.state.inputBoardSource = inputBoardSource;
      this.app.notify(this, { inputBoardSource: this.state.inputBoardSource });
    }

    if (generatedBoardSource !== undefined) {
      this.state.generatedBoardSource = generatedBoardSource;
      this.app.notify(this, {
        generatedBoardSource: this.state.generatedBoardSource,
      });
    }

    if (needsUpdate(config?.isEditorOpen, this.state.isEditorOpen)) {
      this.state.isEditorOpen = !!config.isEditorOpen;
      this.app.notify(this, { isEditorOpen: this.state.isEditorOpen });
    }

    if (needsUpdate(config?.apiKey, this.apiKeys[this.state.provider])) {
      this.apiKeys[this.state.provider] = config.apiKey;
    }

    if (config?.generateFromDescription) {
      await this.generateBoardFromDescription(config.generateFromDescription);
    }
  }

  async process(params: any) {
    if (typeof params === "string") {
      return this.generateBoardFromDescription(params);
    }

    if (typeof params?.prompt === "string") {
      return this.generateBoardFromDescription(params.prompt);
    }

    if (params && Object.prototype.hasOwnProperty.call(params, "boardSource")) {
      const source =
        typeof params.boardSource === "string"
          ? params.boardSource
          : JSON.stringify(params.boardSource, null, 2);
      this.updateCurrentBoardSource(source);
      return params.boardSource;
    }

    if (params !== undefined) {
      const source = JSON.stringify(params, null, 2);
      this.updateCurrentBoardSource(source);
    }

    return params;
  }

  private updateCurrentBoardSource(source: string) {
    if (source !== this.state.inputBoardSource) {
      this.state.inputBoardSource = source;
      this.app.notify(this, {
        inputBoardSource: this.state.inputBoardSource,
      });
    }

    if (source !== this.state.generatedBoardSource) {
      this.state.generatedBoardSource = source;
      this.app.notify(this, {
        generatedBoardSource: this.state.generatedBoardSource,
      });
    }
  }

  pushGeneratedBoardToOutput = (overrideSource?: string) => {
    const source = overrideSource ?? this.state.generatedBoardSource;
    if (!source?.trim()) {
      throw new Error("No generated board JSON available to push");
    }

    const parsed = extractBoardJson(source);
    this.app.next(this, parsed);

    this.state.isEditorOpen = false;
    this.app.notify(this, {
      isEditorOpen: this.state.isEditorOpen,
    });
    return parsed;
  };

  generateBoardFromDescription = async (overrideDescription?: string) => {
    const description = overrideDescription ?? this.state.description;
    const inputBoardSource = this.state.inputBoardSource;
    const provider = this.state.provider;
    const model = this.state.model;
    const apiKey = this.apiKeys[provider];

    this.state.isEditorOpen = false;
    this.app.notify(this, { isEditorOpen: this.state.isEditorOpen });

    if (!description?.trim()) {
      throw new Error("No workflow description available");
    }

    if (!apiKey) {
      throw new Error(`No API key configured for provider: ${provider}`);
    }

    this.state.busy = true;
    this.state.lastError = "";
    this.app.notify(this, { busy: true, lastError: "" });

    try {
      const systemPrompt = buildWorkflowSystemPrompt(this.app);
      const userPrompt = buildUserPrompt(description, inputBoardSource);

      const raw = await this.callProvider(
        provider,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
      );

      const parsed = extractBoardJson(raw);
      const normalized = JSON.stringify(parsed, null, 2);

      this.state.generatedBoardSource = normalized;
      this.state.inputBoardSource = normalized;
      this.app.notify(this, { generatedBoardSource: normalized });
      this.app.notify(this, { inputBoardSource: normalized });
      return parsed;
    } catch (err: any) {
      const message = err?.message || `${err}`;
      this.state.lastError = message;
      this.app.notify(this, { lastError: message });
      throw err;
    } finally {
      this.state.busy = false;
      this.app.notify(this, { busy: false });
    }
  };

  generatePromptFromBoardSource = async (overrideBoardSource?: string) => {
    const boardSource = overrideBoardSource ?? this.state.generatedBoardSource;
    const provider = this.state.provider;
    const model = this.state.model;
    const apiKey = this.apiKeys[provider];

    if (!boardSource?.trim()) {
      throw new Error("No board JSON available to describe");
    }

    if (!apiKey) {
      throw new Error(`No API key configured for provider: ${provider}`);
    }

    this.state.busy = true;
    this.state.lastError = "";
    this.app.notify(this, { busy: true, lastError: "" });

    try {
      const systemPrompt = [
        "You translate board JSON into a concise workflow prompt.",
        "Return plain text only (no markdown code fences, no JSON).",
        "Describe behavior, key services, runtime assumptions, and important constraints.",
        "Focus on what to change/tune next.",
      ].join("\n");

      const userPrompt = [
        "Generate a high-quality workflow prompt from this board JSON.",
        "The prompt should help an AI refine this board in the next iteration.",
        "Board JSON:",
        boardSource,
      ].join("\n\n");

      const raw = await this.callProvider(
        provider,
        apiKey,
        model,
        systemPrompt,
        userPrompt,
      );

      const prompt = raw.trim();
      this.state.description = prompt;
      this.app.notify(this, { description: prompt });
      return prompt;
    } catch (err: any) {
      const message = err?.message || `${err}`;
      this.state.lastError = message;
      this.app.notify(this, { lastError: message });
      throw err;
    } finally {
      this.state.busy = false;
      this.app.notify(this, { busy: false });
    }
  };

  private async callProvider(
    provider: Provider,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    if (provider === "claude") {
      return callClaude(apiKey, model, systemPrompt, userPrompt);
    }
    if (provider === "openai") {
      return callOpenAI(apiKey, model, systemPrompt, userPrompt);
    }
    return callGemini(apiKey, model, systemPrompt, userPrompt);
  }
}

async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const json = await readJsonOrThrow(response, "Claude");
  const text =
    json?.content
      ?.filter((entry: any) => entry?.type === "text")
      ?.map((entry: any) => entry?.text || "")
      ?.join("\n") || "";
  if (!text) {
    throw new Error("Claude returned an empty response");
  }
  return text;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const json = await readJsonOrThrow(response, "OpenAI");
  const text = json?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("OpenAI returned an empty response");
  }
  return text;
}

async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  const json = await readJsonOrThrow(response, "Gemini");
  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      ?.join("\n") || "";
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }
  return text;
}

async function readJsonOrThrow(response: Response, provider: string) {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${provider} request failed: ${response.status} ${text}`);
  }
  return json;
}

function buildUserPrompt(description: string, inputBoardSource?: string) {
  if (inputBoardSource?.trim()) {
    return [
      "Refine the provided board JSON according to the workflow request.",
      "Return a complete board JSON document.",
      "Keep unchanged behavior intact unless the request asks for change.",
      "Workflow refinement request:",
      description,
      "Current board JSON to refine:",
      inputBoardSource,
    ].join("\n\n");
  }

  return [
    "Build a complete board and choose runtimes automatically.",
    "Workflow description:",
    description,
  ].join("\n\n");
}

function extractBoardJson(raw: string): any {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch?.[1]) {
      return JSON.parse(codeBlockMatch[1].trim());
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.substring(start, end + 1));
    }

    throw new Error("Model response did not contain valid board JSON");
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new WorkflowBoardBuilder(app, board, descriptor, id),
  createUI: WorkflowBoardBuilderUI,
};

export default descriptor;
