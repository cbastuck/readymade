import { useState } from "react";

import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import PromptInput from "./PromptInput";
import SelectorField, {
  arrayToOptions,
} from "@/components/shared/SelectorField";

import Slider from "@/ui-components/Slider";
import MenuIcon from "@/ui-components/MenuIcon";
import { FileJson, FileText } from "lucide-react";

export default function OllamaPromptUI(props: ServiceUIProps) {
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");
  const [availableModels, setAvailableModels] = useState<Array<string>>([]);
  const [usedModel, setUsedModel] = useState("");
  const [parseResponseAsJson, setChangeParseResponse] = useState(false);
  const [temperature, setTemperature] = useState(1);

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

    if (needsUpdate(state.temperature, temperature)) {
      setTemperature(state.temperature);
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
    props.service.configure({ prompt: newPrompt });
  };

  const onBlurPrompt = (newPrompt: string) => {
    props.service.configure({ silentPrompt: newPrompt });
  };

  const onSelectModel = ({ value: newModel }: any) => {
    props.service.configure({ model: newModel });
  };

  const onToggleParseResponse = () =>
    props.service.configure({ responseIsJson: !parseResponseAsJson });

  const onOpenModels = () => {
    if (availableModels.length === 0) {
      props.service.fetchAvailableModels();
    }
  };

  const onChangeTemperature = (newTemperature: number) => {
    props.service.configure({ temperature: newTemperature });
  };

  const customMenuEntries = [
    {
      name: parseResponseAsJson ? "Reply is text" : "Reply is JSON",
      icon: parseResponseAsJson ? (
        <MenuIcon icon={FileText} />
      ) : (
        <MenuIcon icon={FileJson} />
      ),
      onClick: onToggleParseResponse,
    },
  ];

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
      customMenuEntries={customMenuEntries}
    >
      <div className="flex flex-col w-full h-full">
        <SelectorField
          label="Model"
          value={usedModel}
          onOpen={onOpenModels}
          options={arrayToOptions(availableModels)}
          onChange={onSelectModel}
        />
        <Slider
          className="my-2 pr-2"
          title="Temperature"
          value={temperature}
          onChange={onChangeTemperature}
          min={0}
          max={4}
          step={0.1}
        />
        <PromptInput
          prompt={prompt}
          isBusy={isBusy}
          accumulatedUpdate={accumulatedUpdate}
          onProcessButton={onProcessButton}
          onSubmitPrompt={onSubmitPrompt}
          onBlurPrompt={onBlurPrompt}
        />
      </div>
    </ServiceUI>
  );
}
