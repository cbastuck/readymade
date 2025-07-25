import { BugPlay, UndoDot } from "lucide-react";

import Copyable from "hkp-frontend/src/components/Copyable";
import Button from "../Button";
import Editor from "hkp-frontend/src/components/shared/Editor";
import { useMemo, useRef, useState } from "react";

type Props = {
  data: any;

  onInject: (data: any) => void;
};

export default function FlowInspectorPopup({
  data,

  onInject,
}: Props) {
  const editor = useRef<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const dataAsString = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const onResetDirty = () => {
    editor.current.setValue(dataAsString);
    setIsDirty(false);
  };

  const onInjectInternal = () => {
    if (!isDirty) {
      onInject(data);
    } else {
      const buffer = editor.current.getValue();
      try {
        onInject(JSON.parse(buffer));
      } catch (err) {
        console.error("FlowInspectorPopup.onInjectInternal", err);
        onInject(buffer);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="my-2 h-full w-full grid gap-2 border border-solid p-2 font-menu text-base overflow-y-auto">
        <div className="w-full h-[200px]">
          <Editor
            ref={editor}
            value={dataAsString}
            onChange={() => setIsDirty(true)}
          />
        </div>
      </div>
      <div className="flex items-center">
        <ResetButton isDisabled={!isDirty} onClick={onResetDirty} />

        <Button
          className="tracking-wider w-full"
          disabled={!data && !isDirty}
          onClick={onInjectInternal}
        >
          Inject data
          <BugPlay />
        </Button>

        <div className="w-[60px]">
          <Copyable
            renderInput={false}
            label=""
            value={dataAsString}
            isUrl={false}
            disabled={!data}
          />
        </div>
      </div>
    </div>
  );
}

function ResetButton({ onClick, isDisabled }: any) {
  return (
    <div className="mx-2">
      <Button
        disabled={isDisabled}
        className={`w-9 p-2 m-0 ${
          !isDisabled ? "bg-sky-600" : "stroke-gray-900"
        }`}
        onClick={onClick}
      >
        <UndoDot stroke={isDisabled ? "gray" : "white"} />
      </Button>
    </div>
  );
}
