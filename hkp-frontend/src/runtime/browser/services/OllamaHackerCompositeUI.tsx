import { ServiceUIProps } from "hkp-frontend/src/types";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import PromptInput from "./OllamaPromptUI/PromptInput";
import { useState } from "react";
import { HackerUIPanel } from "./HackerUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import SelectorField, {
  arrayToOptions,
} from "hkp-frontend/src/components/shared/SelectorField";

export default function OllamaHackerCompsiteUI(props: ServiceUIProps) {
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [mode, setMode] = useState("generate"); // "generate" or "process"
  const [availableModels, setAvailableModels] = useState<Array<string>>([]);
  const [usedModel, setUsedModel] = useState("");

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

    if (needsUpdate(state.availableModels, availableModels)) {
      setAvailableModels(state.availableModels);
    }

    if (needsUpdate(state.model, usedModel)) {
      setUsedModel(state.model);
    }
  };

  const onInit = (state: any) => {
    update(state);
  };

  const onNotification = (notification: any) => {
    update(notification);
  };

  const onSubmitPrompt = (prompt: string) => {
    props.service.ollama.configure({ prompt: prompt });
  };

  const onCodeChange = (buffer: string) => {
    props.service.hacker.configure({ buffer });
  };

  const onModeChange = (newMode: string) => {
    props.service.configure({ mode: newMode });
  };

  const onBlurPrompt = (newPrompt: string) => {
    props.service.configure({ prompt: newPrompt, injectPrompt: false });
  };

  const onSelectModel = ({ value: newModel }: any) => {
    props.service.configure({ model: newModel });
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
          <>
            <SelectorField
              label="Model"
              value={usedModel}
              options={arrayToOptions(availableModels)}
              onChange={onSelectModel}
            />
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
          </>
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
