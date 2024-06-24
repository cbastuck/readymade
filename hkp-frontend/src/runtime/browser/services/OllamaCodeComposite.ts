import { v4 as uuidv4 } from "uuid";

import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

import OllamaCodeCompositeUI from "./OllamaCodeCompositeUI";
import { OllamaPrompt } from "./OllamaPrompt";
import { DangerousHacker } from "./DangerousHacker";

const serviceName = "Ollama Code Composite";
const serviceId = "hookup.to/service/ollama-code-composite";

type State = {};

class OllamaCodeComposite extends ServiceBase<State> {
  ollama: OllamaPrompt | undefined;
  hacker: DangerousHacker | undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {});
    this.init();
  }

  async init() {
    this.ollama = (await this.app.createSubService(
      this,
      {
        serviceId: "hookup.to/service/ollama-prompt",
        serviceName: "Ollama Prompt",
      },
      uuidv4()
    )) as OllamaPrompt;
    this.hacker = (await this.app.createSubService(
      this,
      {
        serviceId: "hookup.to/service/hacker/dangerous",
        serviceName: "Dangerous Hacker",
      },
      uuidv4()
    )) as DangerousHacker;
  }

  async configure(config: any) {
    await this.ollama?.configure(config);
    await this.hacker?.configure(config);
  }

  async process(params: any) {
    if (!this.hacker?.state.buffer) {
      const buffer = await this.ollama?.process(params);
      await this.hacker?.configure({ buffer });
    }
    return this.hacker?.process(params);
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
  ) => new OllamaCodeComposite(app, board, descriptor, id),
  createUI: OllamaCodeCompositeUI,
};

export default descriptor;
