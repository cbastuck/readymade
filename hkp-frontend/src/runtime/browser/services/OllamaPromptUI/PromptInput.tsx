import { useRef } from "react";

import SubmittableTextarea from "@/ui-components/SubmittableTextarea";

import Button from "@/ui-components/Button";
import BusyIndicator from "./BusyIndicator";

type Props = {
  accumulatedUpdate: string;
  prompt: string;
  isBusy: boolean;
  isDisabled?: boolean;
  buttonText?: string;
  title?: string | null;
  onProcessButton: (prompt: string) => void;
  onSubmitPrompt: (prompt: string) => void;
  onBlurPrompt?: (prompt: string) => void;
};

export default function PromptInput({
  accumulatedUpdate,
  prompt,
  isBusy,
  isDisabled,
  title,
  buttonText = "Process",
  onProcessButton,
  onSubmitPrompt,
  onBlurPrompt,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const onBlur = () => {
    onBlurPrompt?.(inputRef.current?.value || "");
  };

  const busyPreview = useRef<HTMLDivElement>(null);
  if (busyPreview.current) {
    busyPreview.current.scrollTop = busyPreview.current?.scrollHeight;
  }

  return (
    <div className="flex flex-col h-full w-full">
      <SubmittableTextarea
        ref={inputRef}
        className="font-menu text-base resize-none h-full w-full"
        title={title === null ? undefined : title || "Prompt"}
        value={prompt}
        onSubmit={onSubmitPrompt}
        onBlur={onBlur}
        disabled={isDisabled}
      />
      <div className="w-full my-2">
        <Button
          className="w-full"
          onClick={() =>
            inputRef.current && onProcessButton(inputRef.current.value)
          }
        >
          {buttonText}
        </Button>
      </div>
      <div className="flex items-top gap-4 border border-solid">
        <div className="my-2 mx-2">
          <BusyIndicator isBusy={isBusy} />
        </div>
        <div
          ref={busyPreview}
          className="min-h-9 max-h-9 w-full p-2 my-0 text-md font-menu text-left overflow-y-auto "
        >
          {accumulatedUpdate || (
            <span className="text-gray-500">
              Idle, updates appear here during progress
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
