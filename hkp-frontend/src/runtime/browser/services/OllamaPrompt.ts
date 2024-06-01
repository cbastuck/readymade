import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

import OllamaPromptUI from "./OllamaPromptUI";

const serviceName = "Ollama Prompt";
const serviceId = "hookup.to/service/ollama-prompt";

type State = {
  model: string;
  endpoint: string;
};

class OllamaPrompt extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      endpoint: "http://localhost:11434/api/generate",
      model: "llama3",
    });
  }

  async configure(config: any) {
    const { prompt } = config;
    if (config !== undefined) {
      const result = await this.process(prompt);
      this.app.next(this, result);
    }
  }

  async process(params: any) {
    this.app.notify(this, { busy: true });
    const resp = await fetch(this.state.endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: this.state.model,
        prompt: params,
        stream: false,
      }),
    });
    const { response, done, done_reason } = await resp.json();
    if (done && done_reason === "stop") {
      this.app.notify(this, { busy: false });
    }

    return response || null;
  }
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
