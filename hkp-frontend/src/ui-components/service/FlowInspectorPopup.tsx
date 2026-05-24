import { BugPlay, UndoDot } from "lucide-react";

import Copyable from "hkp-frontend/src/components/Copyable";
import Button from "../Button";
import Editor from "hkp-frontend/src/components/shared/Editor";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  history: any[];
  onInject: (data: any) => void;
};

export default function FlowInspectorPopup({ history, onInject }: Props) {
  const editor = useRef<any>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
    setIsDirty(false);
  }, [history[0]]);

  const selectedData = history[selectedIndex];
  const dataAsString = useMemo(
    () => JSON.stringify(selectedData, null, 2),
    [selectedData],
  );

  const onSelectIndex = (i: number) => {
    setSelectedIndex(i);
    setIsDirty(false);
  };

  const onResetDirty = () => {
    editor.current.setValue(dataAsString);
    setIsDirty(false);
  };

  const onInjectInternal = () => {
    if (!isDirty) {
      onInject(selectedData);
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
      {history.length > 1 && (
        <div className="flex gap-1 flex-wrap px-2 pt-2">
          {history.map((_, i) => (
            <button
              key={i}
              onClick={() => onSelectIndex(i)}
              className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
                i === selectedIndex
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-gray-500 border-gray-300 hover:border-sky-400"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
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
          disabled={!selectedData && !isDirty}
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
            disabled={!selectedData}
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
