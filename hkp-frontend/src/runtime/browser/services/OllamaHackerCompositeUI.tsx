import { ServiceUIProps } from "@/types";

import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import PromptInput from "./OllamaPromptUI/PromptInput";
import { useState } from "react";
import { HackerUIPanel } from "./HackerUI";

export default function OllamaHackerCompsiteUI(props: ServiceUIProps) {
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const [buffer, setBuffer] = useState("");
  const [healthStatus, setHealthStatus] = useState<any>({ error: false });

  const { service } = props;
  const update = (state: any) => {
    if (needsUpdate(state.answer, buffer)) {
      service.configure({ buffer: state.answer + "\nreturn f(params)" });
    }

    if (needsUpdate(state.prompt, prompt)) {
      setPrompt(state.prompt);
    }
    if (state.update !== undefined) {
      setAccumulatedUpdate((a) => a + state.update);
    }

    if (needsUpdate(state.busy, isBusy)) {
      if (!state.busy) {
        setAccumulatedUpdate("");
      }
      setIsBusy(state.busy);
    }

    if (needsUpdate(state.buffer, buffer)) {
      setBuffer(state.buffer);
    }

    if (needsUpdate(state.healthStatus, healthStatus)) {
      setHealthStatus(state.healthStatus);
    }
  };

  const onInit = (state: any) => {
    update(state);
  };

  const onNotification = (notification: any) => {
    update(notification);
  };

  const onSubmitPrompt = (prompt: string) => {
    props.service.ollama.configure({ prompt });
  };

  const onCodeChange = (buffer: string) => {
    props.service.hacker.configure({ buffer });
  };

  return (
    <ServiceUI
      className="pb-4 overlflow-hidden"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 440, height: undefined }}
    >
      <div className="flex flex-col">
        <PromptInput
          accumulatedUpdate={accumulatedUpdate}
          prompt={prompt}
          isBusy={isBusy}
          onProcessButton={onSubmitPrompt}
          omSubmitPrompt={onSubmitPrompt}
        />
        <HackerUIPanel
          buffer={buffer}
          healthStatus={healthStatus}
          onChange={onCodeChange}
        />
      </div>
    </ServiceUI>
  );
}
