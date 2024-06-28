import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

import OllamaHackerCompositeUI from "./OllamaHackerCompositeUI";
import { OllamaPrompt } from "./OllamaPrompt";
import { DangerousHacker } from "./DangerousHacker";
import { needsUpdate } from "@/ui-components/service/ServiceUI";

const serviceName = "Ollama Hacker";
const serviceId = "hookup.to/service/ollama-hacker";

type State = {
  mode: string; // "generate" or "process"
};

class OllamaHackerComposite extends ServiceBase<State> {
  ollama: OllamaPrompt | undefined;
  hacker: DangerousHacker | undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, { mode: "generate" });
    this.init(id);
  }

  async init(id: string) {
    this.ollama = (await this.app.createSubService(
      this,
      {
        serviceId: "hookup.to/service/ollama-prompt",
        serviceName: "Ollama Prompt",
      },
      id
    )) as OllamaPrompt;
    this.hacker = (await this.app.createSubService(
      this,
      {
        serviceId: "hookup.to/service/hacker/dangerous",
        serviceName: "Dangerous Hacker",
      },
      id
    )) as DangerousHacker;
  }

  async configure(config: any) {
    const { mode, buffer } = config;
    if (needsUpdate(mode, this.state.mode)) {
      this.state.mode = mode;
      this.app.notify(this, { mode });
    }
    await this.ollama?.configure(config);
    if (buffer !== undefined) {
      await this.hacker?.configure(
        buffer
          ? { ...config, buffer: addGeneratedFunctionCall(buffer) }
          : config
      );
      await this.configure({ mode: "process" });
    }
  }

  getConfiguration = async () => {
    return {
      bypass: this.bypass,
      prompt: this.ollama?.state.prompt,
      buffer: this.hacker?.state.buffer,
      mode: this.state.mode,
    };
  };

  async process(params: any) {
    if (this.state.mode === "generate") {
      const result = await this.ollama?.process(params);
      await this.hacker?.configure({
        buffer: addGeneratedFunctionCall(result),
      });
      await this.configure({ mode: "process" });
    }
    return await this.hacker?.process(params);
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
  ) => new OllamaHackerComposite(app, board, descriptor, id),
  createUI: OllamaHackerCompositeUI,
};

export default descriptor;

function addGeneratedFunctionCall(answer: string): string {
  const callFnCode = "return f(params);";
  return answer.indexOf(callFnCode) === -1
    ? `${answer}\n${callFnCode}\n`
    : answer;
}
