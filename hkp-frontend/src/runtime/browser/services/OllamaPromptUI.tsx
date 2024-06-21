import { useState } from "react";

import { ServiceUIProps } from "@/types";
import SubmittableInput from "@/ui-components/SubmittableInput";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

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

  const onInit = (state: any) => update(state);
  const onNotification = (notification: any) => update(notification);

  const omSubmitPrompt = (newPrompt: string) => {
    setPrompt(newPrompt);
    setAccumulatedUpdate("");
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
        <div className="flex w-full items-end gap-4 my-2">
          <SubmittableInput
            fullWidth
            title="Prompt"
            value={prompt}
            onSubmit={omSubmitPrompt}
          />
          <BusyIndicator isBusy={isBusy} />
        </div>
        <div className=" h-full p-2 my-2 text-md font-menu text-left overflow-y-auto border border-solid">
          {accumulatedUpdate || (
            <span className="text-gray-500">
              Idle, updates appear here during progress
            </span>
          )}
        </div>
        <Switch
          title="Response is JSON"
          checked={parseResponseAsJson}
          onCheckedChange={onChangeParseResponse}
        />
      </div>
    </ServiceUI>
  );
}

function BusyIndicator({ isBusy }: { isBusy: boolean }) {
  return isBusy ? (
    <span className="relative flex h-3 w-3 mb-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
    </span>
  ) : null;
}
