import { useState } from "react";

import { ServiceUIProps } from "@/types";
import SubmittableInput from "@/ui-components/SubmittableInput";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

export default function OllamaPromptUI(props: ServiceUIProps) {
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [accumulatedUpdate, setAccumulatedUpdate] = useState("");

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
  };

  const onInit = (state: any) => update(state);
  const onNotification = (notification: any) => update(notification);

  const omSubmitPrompt = (newPrompt: string) => {
    setPrompt(newPrompt);
    setAccumulatedUpdate("");
    props.service.configure({ prompt: newPrompt });
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
        <div className="flex w-full items-end gap-4">
          <SubmittableInput
            fullWidth
            title="Prompt"
            value={prompt}
            onSubmit={omSubmitPrompt}
          />

          <BusyIndicator isBusy={isBusy} />
        </div>
        <div className="max-h-[100px] h-full p-2 my-2 text-md font-menu text-left overflow-y-auto border border-solid">
          {accumulatedUpdate || (
            <span className="text-gray-500">
              Idle, updates appear here during progress
            </span>
          )}
        </div>
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
