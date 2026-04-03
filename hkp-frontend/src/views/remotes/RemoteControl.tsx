import { useContext } from "react";

import { BoardCtx } from "hkp-frontend/src/BoardContext";
import Runtime from "hkp-frontend/src/components/Runtime";
import { ProcessContext, RuntimeClass } from "hkp-frontend/src/types";

type Props = {
  runtimeClass: RuntimeClass;
};

export default function RemoteControl({ runtimeClass }: Props) {
  const context = useContext(BoardCtx);
  const runtimes = context?.runtimes || [];

  const onResult = async (
    uuid: string | null,
    result: any,
    context?: ProcessContext | null,
  ) => {
    console.log("RemoteControl.onResult", uuid, result, context);
  };

  const processRuntimeByName = async (name: string, params: any) => {
    console.log("RemoteControl.processRuntimeByName", name, params);
  };

  if (!context) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col overflow-hidden bg-white shadow-md rounded-lg p-4 m-4">
      <h3>Runtime "{runtimeClass.name}"</h3>
      <span className="font-menu text-md">
        running on <a href={runtimeClass.url}>{runtimeClass.url}</a>
      </span>

      <div className="flex flex-col justify-between overflow-scroll w-full m-2">
        {runtimes.map((rt, idx) => (
          <Runtime
            key={`engine-control-${idx}`}
            boardContext={context}
            runtime={{ ...runtimeClass, ...rt }}
            initialState={{
              wrapServices: true,
              minimized: true,
            }}
            expanded={true}
            onResult={onResult}
            processRuntimeByName={processRuntimeByName}
            initialServiceFrameState={{ collapsed: true }}
          />
        ))}
      </div>
    </div>
  );
}
