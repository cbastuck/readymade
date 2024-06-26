import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

import OllamaHackerCompositeUI from "./OllamaHackerCompositeUI";
import { OllamaPrompt } from "./OllamaPrompt";
import { DangerousHacker } from "./DangerousHacker";

const serviceName = "Ollama Hacker";
const serviceId = "hookup.to/service/ollama-hacker";

type State = {};

class OllamaHackerComposite extends ServiceBase<State> {
  ollama: OllamaPrompt | undefined;
  hacker: DangerousHacker | undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {});
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
    await this.ollama?.configure(config);
    await this.hacker?.configure(config);
  }

  getConfiguration = async () => {
    return {
      bypass: this.bypass,
      prompt: this.ollama?.state.prompt,
      buffer: this.hacker?.state.buffer,
    };
  };

  async process(params: any) {
    return this.hacker?.state.buffer ? this.hacker.process(params) : params;
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
