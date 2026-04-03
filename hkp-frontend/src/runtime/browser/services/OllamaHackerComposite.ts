import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import OllamaHackerCompositeUI from "./OllamaHackerCompositeUI";
import { OllamaPrompt } from "./OllamaPrompt";
import { DangerousHacker } from "./DangerousHacker";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceName = "Ollama Code Assist";
const serviceId = "hookup.to/service/ollama-hacker";

type State = {
  mode: string; // "generate" or "process"
  limitDataOnGenerate: number;
  executeCodeAfterGeneration: boolean;
};

class OllamaHackerComposite extends ServiceBase<State> {
  ollama: OllamaPrompt | undefined;
  hacker: DangerousHacker | undefined;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, {
      mode: "generate",
      limitDataOnGenerate: 3,
      executeCodeAfterGeneration: true,
    });
    this.init(id);
  }

  async init(id: string) {
    this.ollama = (await this.app.createSubService(
      this,
      {
        serviceId: "hookup.to/service/ollama-prompt",
        serviceName: "Ollama Prompt",
      },
      id,
    )) as unknown as OllamaPrompt;

    this.hacker = (await this.app.createSubService(
      this,
      {
        serviceId: "hookup.to/service/hacker/dangerous",
        serviceName: "Dangerous Hacker",
      },
      id,
    )) as unknown as DangerousHacker;
  }

  async configure(config: any) {
    console.log("OllamaHackerComposite.configure", config.availableModels);
    const { mode, buffer, prompt, ...rest } = config;
    if (needsUpdate(mode, this.state.mode)) {
      this.state.mode = mode;
      this.app.notify(this, { mode });
    }
    await this.ollama?.configure(
      prompt ? { ...rest, prompt, injectPrompt: false } : config,
    );
    if (buffer !== undefined) {
      await this.hacker?.configure(
        buffer
          ? { ...config, buffer: addGeneratedFunctionCall(buffer) }
          : config,
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
      model: this.ollama?.state.model,
      limitDataOnGenerate: this.state.limitDataOnGenerate,
      executeCodeAfterGeneration: this.state.executeCodeAfterGeneration,
    };
  };

  async process(params: any) {
    if (this.state.mode === "generate") {
      const possiblyReducedDataset =
        this.state.limitDataOnGenerate > 0 && Array.isArray(params)
          ? params.slice(0, this.state.limitDataOnGenerate)
          : params;
      const result = await this.ollama?.process(possiblyReducedDataset);

      if (this.state.executeCodeAfterGeneration) {
        await this.configure({ mode: "process" });
        await this.hacker?.configure({
          buffer: addGeneratedFunctionCall(result),
        });
      } else {
        await this.hacker?.configure({ buffer: result });
        return null;
      }
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
    id: string,
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
