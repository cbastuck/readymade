import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import PromptInput from "./PromptInput";
import SelectorField, {
  arrayToOptions,
} from "hkp-frontend/src/components/shared/SelectorField";

import Slider from "hkp-frontend/src/ui-components/Slider";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import { FileJson, FileText } from "lucide-react";
import InputField from "hkp-frontend/src/components/shared/InputField";

export default function OllamaPromptUI(props: ServiceUIProps) {
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");
  const [availableModels, setAvailableModels] = useState<Array<string>>([]);
  const [usedModel, setUsedModel] = useState("");
  const [parseResponseAsJson, setChangeParseResponse] = useState(false);
  const [temperature, setTemperature] = useState(1);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("");

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

    if (needsUpdate(state.endpoint, ollamaEndpoint)) {
      setOllamaEndpoint(state.endpoint);
    }
  };

  const onProcessButton = (prompt: string) => {
    setAccumulatedUpdate("");
    props.service.configure({ prompt, injectPrompt: true });
  };

  const onSubmitPrompt = (newPrompt: string) => {
    props.service.configure({ prompt: newPrompt });
  };

  const onBlurPrompt = (newPrompt: string) => {
    props.service.configure({ prompt: newPrompt, injectPrompt: false });
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

  const onChangeOllamaEndpoint = (newEndpoint: string) => {
    props.service.configure({ endpoint: newEndpoint });
  };

  return (
    <ServiceUI
      className="pb-4 min-w-[400px]"
      {...props}
      onInit={update}
      onNotification={update}
      initialSize={{ width: 400, height: undefined }}
      customMenuEntries={customMenuEntries}
    >
      <div className="flex flex-col w-full h-full">
        <div className="flex flex-col">
          <InputField
            className="mr-3"
            label="URL"
            value={ollamaEndpoint}
            onChange={onChangeOllamaEndpoint}
          />
          <SelectorField
            label="Model"
            value={usedModel}
            onOpen={onOpenModels}
            options={arrayToOptions(availableModels)}
            onChange={onSelectModel}
            disabled={!ollamaEndpoint}
          />
          <Slider
            className="my-2 pr-2"
            title="Temperature"
            value={temperature}
            onChange={onChangeTemperature}
            min={0}
            max={4}
            step={0.1}
            disabled={!ollamaEndpoint || !usedModel}
          />
        </div>
        <PromptInput
          prompt={prompt}
          isBusy={isBusy}
          accumulatedUpdate={accumulatedUpdate}
          onProcessButton={onProcessButton}
          onSubmitPrompt={onSubmitPrompt}
          onBlurPrompt={onBlurPrompt}
          isDisabled={!ollamaEndpoint || !usedModel}
        />
      </div>
    </ServiceUI>
  );
}
