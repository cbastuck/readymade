import { ServiceUIProps } from "@/types";

import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import PromptInput from "./OllamaPromptUI/PromptInput";
import { useState } from "react";
import { HackerUIPanel } from "./HackerUI";
import RadioGroup from "@/ui-components/RadioGroup";

export default function OllamaHackerCompsiteUI(props: ServiceUIProps) {
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState("generate"); // "generate" or "process"

  const [buffer, setBuffer] = useState("");
  const [healthStatus, setHealthStatus] = useState<any>({ error: false });

  const { service } = props;
  const update = (state: any) => {
    if (needsUpdate(state.mode, mode)) {
      setMode(state.mode);
    }
    if (needsUpdate(state.answer, buffer)) {
      service.configure({ buffer: state.answer });
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
    props.service.ollama.configure({ prompt: prompt, stopPropagation: true });
  };

  const onCodeChange = (buffer: string) => {
    props.service.hacker.configure({ buffer });
  };

  const onModeChange = (newMode: string) => {
    props.service.configure({ mode: newMode });
  };

  const onBlurPrompt = (newPrompt: string) => {
    props.service.configure({ silentPrompt: newPrompt });
  };

  return (
    <ServiceUI
      className="pb-4 overlflow-hidden h-full"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 440, height: undefined }}
    >
      <div className="flex flex-col h-full">
        <RadioGroup
          title="Mode"
          options={["generate", "process"]}
          value={mode}
          onChange={onModeChange}
        />
        {mode === "generate" ? (
          <PromptInput
            accumulatedUpdate={accumulatedUpdate}
            prompt={prompt}
            isBusy={isBusy}
            buttonText="Generate Code"
            onProcessButton={onSubmitPrompt}
            onSubmitPrompt={onSubmitPrompt}
            onBlurPrompt={onBlurPrompt}
            title="Describe the task"
          />
        ) : (
          <HackerUIPanel
            title="Code"
            buffer={buffer}
            healthStatus={healthStatus}
            onChange={onCodeChange}
          />
        )}
      </div>
    </ServiceUI>
  );
}
