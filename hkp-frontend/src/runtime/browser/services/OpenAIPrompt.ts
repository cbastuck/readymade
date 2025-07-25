import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import OpenAIPromptUI from "./OpenAIPromptUI";
import {
  needsUpdate,
  needsUpdateStrict,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceName = "OpenAI Prompt";
const serviceId = "hookup.to/service/openai-prompt";

export type OpenAIModel = {
  name: string;
  endpoint: string;
  type: "image" | "chat" | "audio" | "text";
};

type State = {
  availableModels: Array<OpenAIModel>;
  availableVoices: Array<string>;
  model: string;
  voice: string;
  responseIsJson: boolean;
  prompt: string;
  temperature: number;
  seed: number;
};

export class OpenAIPrompt extends ServiceBase<State> {
  _apiKey: string = "";
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      availableModels: [
        {
          name: "gpt-4o-mini",
          endpoint: "https://api.openai.com/v1/chat/completions",
          type: "chat",
        },
        {
          name: "dall-e-2",
          endpoint: "https://api.openai.com/v1/images/generations",
          type: "image",
        },
        {
          name: "dall-e-3",
          endpoint: "https://api.openai.com/v1/images/generations",
          type: "image",
        },
        {
          name: "tts-1",
          endpoint: "https://api.openai.com/v1/audio/speech",
          type: "audio",
        },
        {
          name: "whisper-1",
          endpoint: "https://api.openai.com/v1/audio/transcriptions",
          type: "text",
        },
      ],
      availableVoices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
      model: "gpt-4o-mini",
      voice: "alloy",
      responseIsJson: false,
      prompt: "",
      temperature: 0,
      seed: 0,
    });
  }

  async configure(config: any) {
    const { prompt, injectPrompt, model, temperature, apiKey, voice } = config;

    if (needsUpdateStrict(model, this.state.model)) {
      this.state.model = model;
      this.app.notify(this, { model: this.state.model });
    }

    if (needsUpdate(temperature, this.state.temperature)) {
      this.state.temperature = temperature;
      this.app.notify(this, { temperature });
    }

    if (prompt !== undefined) {
      this.state.prompt = prompt;
      this.app.notify(this, { prompt: this.state.prompt });
      if (injectPrompt) {
        this.processAndInject("");
      }
    }

    if (needsUpdate(apiKey, this._apiKey)) {
      this._apiKey = apiKey;
    }

    if (needsUpdate(voice, this.state.voice)) {
      this.state.voice = voice;
      this.app.notify(this, { voice: this.state.voice });
    }
  }

  processAndInject = async (prompt: string) => {
    const result = await this.process(prompt);
    this.app.notify(this, { answer: result });
    this.app.next(this, result);
  };

  async process(params: any) {
    if (!this._apiKey) {
      console.error("OpenAIPrompt - no API key provided");
      return null;
    }
    const messages = [
      {
        role: "system",
        content: this.state.prompt,
      },
      {
        role: "user",
        content: `${params}`,
      },
    ];

    const openAiModel = this.state.availableModels.find(
      (x) => x.name === this.state.model
    );
    if (!openAiModel) {
      throw new Error(
        `OpenAIPromot no openAiModel available for model id: ${this.state.model}`
      );
    }
    const dim = [1024, 1024];
    const imageDimensions = `${dim[0]}x${dim[1]}`;
    const type = openAiModel.type;
    const getBody = () => {
      if (type === "chat") {
        return {
          model: this.state.model,
          messages,
          temperature: this.state.temperature,
        };
      } else if (type === "image") {
        return {
          model: openAiModel.name,
          prompt: `${params}`,
          n: 1,
          size: imageDimensions,
        };
      } else if (type === "audio") {
        return {
          model: openAiModel.name,
          input: `${params}`,
          voice: this.state.voice,
        };
      } else if (type === "text") {
        // implement me: https://platform.openai.com/docs/guides/speech-to-text?lang=curl
        throw new Error("OpenAIPrompt - text type not implemented");
      } else {
        throw new Error(`OpenAIPrompt - unknown type: ${type}`);
      }
    };
    const resp = await fetch(openAiModel.endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${this._apiKey}`,
      },
      body: JSON.stringify(getBody()),
    });

    if (type === "chat") {
      const json = await resp.json();
      return json.choices?.length === 1
        ? json.choices[0].message.content
        : json;
    }

    if (type === "image") {
      const json = await resp.json();
      const imageUrl = json?.data?.[0]?.url;
      if (imageUrl) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => {
            resolve({ image, url: imageUrl });
          };
          image.onerror = (err) => {
            reject(err);
          };
          image.src = imageUrl;
        });
      }
    }

    if (type === "audio") {
      const blob = await resp.blob();
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        audio.oncanplaythrough = () => {
          resolve(blob);
        };
        audio.onerror = (err) => {
          reject(err);
        };
        audio.src = URL.createObjectURL(blob);
      });
    }
    return Promise.resolve(await resp.text());
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
  ) => new OpenAIPrompt(app, board, descriptor, id),
  createUI: OpenAIPromptUI,
};

export default descriptor;
