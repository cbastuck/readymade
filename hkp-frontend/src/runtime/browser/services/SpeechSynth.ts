import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import SpeechSynthUI from "./SpeechSynthUI";
import { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

const serviceName = "Speech Synth";
const serviceId = "hookup.to/service/speech-synth";

type State = {
  voices: Array<SpeechSynthesisVoice>;
};

class SpeechSynth extends ServiceBase<State> {
  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      voices: [],
    });
  }

  configure(config: any) {
    if (needsUpdate(this.state.voices, config.voices)) {
      this.state.voices = config.voices;
      this.app.notify(this, { voices: this.state.voices });
    }
  }

  async process(params: any) {
    if (typeof params !== "string") {
      this.pushErrorNotification("Speech prompt input must be of type string");
      return null;
    }

    this.app.notify(this, { incoming: params });
    return null;
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
  ) => new SpeechSynth(app, board, descriptor, id),
  createUI: SpeechSynthUI,
};

export default descriptor;
