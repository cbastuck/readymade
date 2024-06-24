import { useRef, useState } from "react";

import { ServiceUIProps } from "@/types";
import SubmittableTextarea from "@/ui-components/SubmittableTextarea";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import SelectorField, {
  arrayToOptions,
} from "@/components/shared/SelectorField";
import Switch from "@/ui-components/Switch";
import Button from "@/ui-components/Button";

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
    props.service.configure({ prompt: newPrompt });
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onProcessButton = () => {
    setAccumulatedUpdate("");
    props.service.configure({ prompt: inputRef.current?.value });
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
        <SubmittableTextarea
          ref={inputRef}
          className="font-menu text-base h-full"
          title="Prompt"
          value={prompt}
          rows={8}
          onSubmit={omSubmitPrompt}
        />
        <div className=" w-full  my-2">
          <Button className="w-full" onClick={onProcessButton}>
            Process
          </Button>
        </div>
        <div className="flex items-top gap-4 h-full p-2 my-2 text-md font-menu text-left overflow-y-auto border border-solid">
          <BusyIndicator isBusy={isBusy} />
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
  return (
    <span className="relative flex h-3 w-3 mb-2 pt-1">
      {isBusy && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
      )}
      <span
        className={`relative inline-flex rounded-full h-3 w-3 ${
          isBusy ? "bg-sky-500" : "bg-gray-200"
        }`}
      />
    </span>
  );
}
