import { useState } from "react";

import { ServiceUIProps } from "@/types";
import SubmittableInput from "@/ui-components/SubmittableInput";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

export default function OllamaPromptUI(props: ServiceUIProps) {
  const [prompt, setPrompt] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const update = (state: any) => {
    if (needsUpdate(state.prompt, prompt)) {
      setPrompt(state.prompt);
    }
    if (needsUpdate(state.busy, isBusy)) {
      setIsBusy(state.busy);
    }
  };

  const onInit = (state: any) => update(state);
  const onNotification = (notification: any) => update(notification);

  const omSubmitPrompt = (newPrompt: string) => {
    if (newPrompt !== prompt) {
      setPrompt(newPrompt);
      props.service.configure({ prompt: newPrompt });
    }
  };

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <div className="flex w-full items-end gap-4">
        <SubmittableInput
          fullWidth
          title="Prompt"
          value={prompt}
          onSubmit={omSubmitPrompt}
        />

        <BusyIndicator isBusy={isBusy} />
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
