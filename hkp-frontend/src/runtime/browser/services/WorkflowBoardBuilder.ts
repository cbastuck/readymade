import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import WorkflowBoardBuilderUI from "./WorkflowBoardBuilderUI";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceName = "Workflow Board Builder";
const serviceId = "hookup.to/service/workflow-board-builder";

type Provider = "claude" | "openai" | "gemini";

type State = {
  provider: Provider;
  model: string;
  description: string;
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

const HKP_PYTHON_SERVICES = [
  "monitor",
  "map",
  "sub-service",
  "http-server-subservices",
  "timer",
];

const HKP_NODE_SERVICES = ["hookup.to/service/monitor"];

const HKP_RT_SERVICES = [
  "buffer",
  "cache",
  "cache-subservices",
  "core-input",
  "core-output",
  "fft",
  "filesystem",
  "ffmpeg",
  "filter",
  "http-client",
  "http-server",
  "http-server-subservices",
  "ifft",
  "map",
  "monitor",
  "mp4-to-wav",
  "static",
  "sub-service",
  "timer",
  "transients",
  "wav-reader",
  "websocket-client",
  "websocket-reader",
  "websocket-socket",
  "websocket-writer",
];

const DEFAULT_WORKFLOW_DESCRIPTION = [
  "Hello world workflow:",
  "Create a browser-only board that animates the text HKP in a circle on a canvas.",
  "Use a timer to drive animation updates, a map service to emit a text drawing template, and a canvas service to render it.",
].join("\n");

const DEFAULT_GENERATED_BOARD = {
  boardName: "Circle Text",
  runtimes: [
    {
      id: "rt-browser-1",
      name: "Browser Runtime",
      type: "browser",
      state: {
        wrapServices: false,
        minimized: false,
      },
    },
  ],
  services: {
    "rt-browser-1": [
      {
        uuid: "svc-timer-1",
        serviceId: "hookup.to/service/timer",
        serviceName: "Timer",
        state: {
          periodicValue: 50,
          periodicUnit: "ms",
          periodic: true,
          running: true,
        },
      },
      {
        uuid: "svc-map-1",
        serviceId: "hookup.to/service/map",
        serviceName: "Map",
        state: {
          template: {
            type: "text",
            text: "HKP",
            color: "#3b82f6",
            font: "bold 22px Arial",
            "x=": "round(200 + 120 * sin(params.triggerCount * 0.05 + 1.5708))",
            "y=": "round(150 + 120 * sin(params.triggerCount * 0.05))",
          },
          mode: "replace",
        },
      },
      {
        uuid: "svc-canvas-1",
        serviceId: "hookup.to/service/canvas",
        serviceName: "Canvas",
        state: {
          size: [400, 300],
          clearOnRedraw: true,
          resizable: true,
        },
      },
    ],
  },
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
      generatedBoardSource: JSON.stringify(DEFAULT_GENERATED_BOARD, null, 2),
      isEditorOpen: true,
      busy: false,
      lastError: "",
    });
  }

  async configure(config: any) {
    const { provider, model, description, generatedBoardSource } = config || {};

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
    const description =
      typeof params === "string" ? params : JSON.stringify(params, null, 2);
    return this.generateBoardFromDescription(description);
  }

  pushGeneratedBoardToOutput = (overrideSource?: string) => {
    const source = overrideSource ?? this.state.generatedBoardSource;
    if (!source?.trim()) {
      throw new Error("No generated board JSON available to push");
    }

    const parsed = extractBoardJson(source);
    this.app.next(this, parsed);
    return parsed;
  };

  generateBoardFromDescription = async (overrideDescription?: string) => {
    const description = overrideDescription ?? this.state.description;
    const provider = this.state.provider;
    const model = this.state.model;
    const apiKey = this.apiKeys[provider];

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
      const systemPrompt = buildSystemPrompt(this.app);
      const userPrompt = buildUserPrompt(description);

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
      this.app.notify(this, { generatedBoardSource: normalized });
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

function buildSystemPrompt(app: AppInstance) {
  const browserServices = app
    .listAvailableServices()
    .map((svc) => ({ serviceId: svc.serviceId, serviceName: svc.serviceName }));

  const runtimeCatalog = {
    browser: browserServices,
    "hkp-rt": HKP_RT_SERVICES,
    "hkp-node": HKP_NODE_SERVICES,
    "hkp-python": HKP_PYTHON_SERVICES,
  };

  return [
    "You are an assistant that converts natural-language workflow descriptions into HKP board JSON.",
    "Return ONLY valid JSON. Do not wrap in markdown.",
    "Board schema:",
    "{",
    '  "boardName": string,',
    '  "runtimes": [{ "id": string, "name": string, "type": "browser" | "rest" | "graphql", "state"?: object, "url"?: string }],',
    '  "services": { [runtimeId: string]: [{ "uuid": string, "serviceId": string, "serviceName": string, "state": object }] }',
    "}",
    "Use one or more runtimes as needed. Do NOT optimize for a single runtime unless the workflow clearly demands it.",
    "Prefer multi-runtime topologies when they improve clarity, execution location, or capability fit.",
    "Use stable UUID-like IDs for services and runtime IDs that are unique inside the board.",
    "Prefer short but meaningful board and runtime names.",
    "When runtime is browser, use serviceId values from the browser catalog.",
    "When runtime is hkp-rt / hkp-node / hkp-python, use serviceId values from that runtime catalog.",
    "Always include service state with practical defaults.",
    "Runtime service catalogs:",
    JSON.stringify(runtimeCatalog, null, 2),
  ].join("\n");
}

function buildUserPrompt(description: string) {
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
