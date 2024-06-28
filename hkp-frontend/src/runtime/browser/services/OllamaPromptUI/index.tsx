import { useState } from "react";

import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import PromptInput from "./PromptInput";
import SelectorField, {
  arrayToOptions,
} from "@/components/shared/SelectorField";
import Switch from "@/ui-components/Switch";

export default function OllamaPromptUI(props: ServiceUIProps) {
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");
  const [availableModels, setAvailableModels] = useState<Array<string>>([]);
  const [usedModel, setUsedModel] = useState("");
  const [parseResponseAsJson, setChangeParseResponse] = useState(false);

  const update = (state: any) => {
    if (needsUpdate(state.prompt, prompt)) {
      setPrompt(state.prompt);
    }
    if (needsUpdate(state.busy, isBusy)) {
      if (!state.busy) {
        setAccumulatedUpdate("");
      }
      setIsBusy(state.busy);
    }
    if (state.update !== undefined) {
      setAccumulatedUpdate((a) => a + state.update);
    }

    if (needsUpdate(state.availableModels, availableModels)) {
      setAvailableModels(state.availableModels);
    }

    if (needsUpdate(state.model, usedModel)) {
      setUsedModel(state.model);
    }

    if (needsUpdate(state.responseIsJson, parseResponseAsJson)) {
      setChangeParseResponse(state.responseIsJson);
    }
  };

  const onInit = (state: any) => {
    update(state);
  };
  const onNotification = (notification: any) => update(notification);

  const onProcessButton = (prompt: string) => {
    setAccumulatedUpdate("");
    props.service.configure({ prompt });
  };

  const onSubmitPrompt = (newPrompt: string) => {
    setPrompt(newPrompt);
    props.service.configure({ prompt: newPrompt });
  };

  const onSelectModel = ({ value: newModel }: any) => {
    props.service.configure({ model: newModel });
  };

  const onChangeParseResponse = (isJson: boolean) => {
    props.service.configure({ responseIsJson: isJson });
  };

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <div className="flex flex-col w-full h-full">
        <SelectorField
          label="Model"
          value={usedModel}
          options={arrayToOptions(availableModels)}
          onChange={onSelectModel}
        />
        <PromptInput
          prompt={prompt}
          isBusy={isBusy}
          accumulatedUpdate={accumulatedUpdate}
          onProcessButton={onProcessButton}
          onSubmitPrompt={onSubmitPrompt}
        />
        <Switch
          title="Response is JSON"
          checked={parseResponseAsJson}
          onCheckedChange={onChangeParseResponse}
        />
      </div>
    </ServiceUI>
  );
}
