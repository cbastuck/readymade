import { useRef } from "react";

import SubmittableTextarea from "@/ui-components/SubmittableTextarea";

import Button from "@/ui-components/Button";
import BusyIndicator from "./BusyIndicator";

type Props = {
  accumulatedUpdate: string;
  prompt: string;
  isBusy: boolean;
  onProcessButton: (prompt: string) => void;
  omSubmitPrompt: (prompt: string) => void;
};

export default function PromptInput({
  accumulatedUpdate,
  prompt,
  isBusy,
  onProcessButton,
  omSubmitPrompt,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <SubmittableTextarea
        ref={inputRef}
        className="font-menu text-base h-full"
        title="Prompt"
        value={prompt}
        rows={8}
        onSubmit={omSubmitPrompt}
      />
      <div className=" w-full  my-2">
        <Button
          className="w-full"
          onClick={() =>
            inputRef.current && onProcessButton(inputRef.current.value)
          }
        >
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
    </>
  );
}
