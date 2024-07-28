import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

import OllamaPromptUI from "./OllamaPromptUI";
import { needsUpdate } from "@/ui-components/service/ServiceUI";

const serviceName = "Ollama Prompt";
const serviceId = "hookup.to/service/ollama-prompt";

type State = {
  availableModels: Array<string>;
  model: string;
  endpoint: string;
  responseIsJson: boolean;
  prompt: string;
  temperature: number;
  seed: number;
};

const defaultLocalEndpoint = "http://localhost:11434/api";

export class OllamaPrompt extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      availableModels: [],
      endpoint: defaultLocalEndpoint,
      model: "",
      responseIsJson: false,
      prompt: "",
      temperature: 0,
      seed: 0,
    });
  }

  fetchAvailableModels = () => {
    fetch(`${this.state.endpoint}/tags`)
      .then((r) => r.json())
      .then((r) => r.models)
      .then(this.onAvailableModels);
  };

  onAvailableModels = (models: Array<{ model: string }>) => {
    this.state.availableModels = models.map((m) => m.model);
    this.app.notify(this, {
      availableModels: this.state.availableModels,
    });
  };

  async configure(config: any) {
    const { prompt, silentPrompt, model, temperature } = config;

    if (needsUpdate(model, this.state.model)) {
      this.state.model = model;
      this.app.notify(this, { model: this.state.model });
    }

    if (needsUpdate(config.responseIsJson, this.state.responseIsJson)) {
      this.state.responseIsJson = config.responseIsJson;
      this.app.notify(this, { responseIsJson: this.state.responseIsJson });
    }

    if (prompt !== undefined) {
      this.state.prompt = prompt;
      const result = await this.process(prompt);
      this.app.notify(this, { answer: result });
      this.app.next(this, result);
    }

    if (silentPrompt !== undefined) {
      this.state.prompt = silentPrompt;
      this.app.notify(this, { prompt: this.state.prompt });
    }

    if (
      !this.state.availableModels ||
      this.state.availableModels.length === 0
    ) {
      this.fetchAvailableModels();
    }

    if (needsUpdate(temperature, this.state.temperature)) {
      this.state.temperature = temperature;
      this.app.notify(this, { temperature });
    }
  }

  async process(params: any) {
    if (!this.state.model) {
      throw new Error("Ollama no model specified");
    }

    const t = typeof params;
    if (t !== "string") {
      if (t === "object") {
        params = JSON.stringify(params);
      } else {
        this.pushErrorNotification(
          "Ollama prompt input must be of type string"
        );
        return null;
      }
    }
    this.app.notify(this, { busy: true });

    const prompt = this.state.prompt
      ? `${this.state.prompt}\n\n: "${params}"`
      : params;

    const body: any = {
      model: this.state.model,
      prompt,
      options: {
        seed: this.state.seed || undefined,
        temperature: this.state.temperature,
      },
    };

    const reportProgress = (partial: string) => {
      const progressToOutput = false;
      return progressToOutput
        ? this.app.next(this, partial)
        : this.app.notify(this, { update: partial });
    };

    const readAsStream = true;
    if (readAsStream) {
      const resp = await fetch(`${this.state.endpoint}/generate`, {
        method: "POST",
        body: JSON.stringify({ ...body, stream: true }),
      });
      const reader = resp.body?.getReader();
      if (reader) {
        const stream = new ReadableStream({
          start(controller) {
            function push() {
              reader?.read().then(({ done, value }) => {
                if (done) {
                  return controller.close();
                }
                controller.enqueue(value);
                const str = uint8arrayToStringMethod(value);
                try {
                  const partialResponse = str ? JSON.parse(str).response : "";
                  reportProgress(partialResponse);
                } catch (err) {
                  console.error(
                    "Could not parse the following partial JSON response",
                    str
                  );
                }

                push();
              });
            }
            push();
          },
        });

        const r = new Response(stream, {
          headers: { "Content-Type": "text/html" },
        });
        const chunks = await r.text();
        this.app.notify(this, { busy: false });

        const plainText = chunks
          .split("\n")
          .map((x) => (x ? JSON.parse(x) : ""))
          .map((x) => x.response)
          .join("");
        try {
          const result = this.state.responseIsJson
            ? JSON.parse(plainText)
            : plainText;
          return result;
        } catch (err) {
          throw new Error(
            `Ollama Prompt attempted to parse a buffer as JSON which is not valid json: ${plainText}`
          );
        }
      }
    } else {
      const resp = await fetch(this.state.endpoint, {
        method: "POST",
        body: JSON.stringify({ ...body, stream: false }),
      });
      const { response, done, done_reason } = await resp.json();
      if (done && done_reason === "stop") {
        this.app.notify(this, { busy: false });
      }

      return response || null;
    }
  }
}

function uint8arrayToStringMethod(uint8array: Uint8Array) {
  return new TextDecoder("utf-8").decode(uint8array);
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new OllamaPrompt(app, board, descriptor, id),
  createUI: OllamaPromptUI,
};

export default descriptor;
