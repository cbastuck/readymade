import { useRef } from "react";

import SubmittableTextarea from "hkp-frontend/src/ui-components/SubmittableTextarea";

import Button from "hkp-frontend/src/ui-components/Button";
import BusyIndicator from "./BusyIndicator";
import StreamingPreview from "./StreamingPreview";

type Props = {
  accumulatedUpdate: string;
  prompt: string;
  isBusy: boolean;
  isDisabled?: boolean;
  buttonText?: string;
  title?: string | null;
  displayPreview?: boolean;
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
  displayPreview = true,
  onProcessButton,
  onSubmitPrompt,
  onBlurPrompt,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const onBlur = () => {
    onBlurPrompt?.(inputRef.current?.value || "");
  };

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
          className="w-full tracking-widest"
          onClick={() =>
            inputRef.current && onProcessButton(inputRef.current.value)
          }
        >
          {buttonText}
        </Button>
      </div>
      {displayPreview && (
        <div className="flex items-top gap-4 border border-solid">
          <div className="my-2 ml-2">
            <BusyIndicator isBusy={isBusy} />
          </div>
          <StreamingPreview value={accumulatedUpdate} />
        </div>
      )}
    </div>
  );
}
