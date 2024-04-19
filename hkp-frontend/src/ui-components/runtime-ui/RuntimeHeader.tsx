import { useContext, useState } from "react";

import {
  AppViewMode,
  RuntimeDescriptor,
  ServiceClass,
  ServiceRegistry,
} from "@/types";
import Editable from "@/ui-components/Editable";
import { BoardCtx } from "@/BoardContext";

import RunParamsDialog from "./RunParamsDialog";
import RuntimeSettings from "./RuntimeSettings";
import RuntimeServiceMenu from "./RuntimeServiceMenu";
import EditorDialog from "../EditorDialog";

type Props = {
  runtime: RuntimeDescriptor;
  registry: ServiceRegistry;
  appViewMode?: AppViewMode;
  isExpanded?: boolean;
  wrapServices?: boolean;
  onAddService: (svc: ServiceClass) => void;
  onExpand: (isExpanded: boolean) => void;
  onWrapServices: (isWrapped: boolean) => void;
};

export default function RuntimeHeader({
  runtime,
  registry,
  appViewMode,
  isExpanded,
  wrapServices,
  onAddService,
  onExpand,
  onWrapServices,
}: Props) {
  const [showRunWithParams, setShowRunWithParams] = useState(false);
  const [isRuntimeConfigOpen, setIsRuntimeConfigOpen] = useState(false);

  const { name, id: runtimeId } = runtime;
  const boardContext = useContext(BoardCtx);
  const onChangeName = (newName: string) =>
    boardContext?.setRuntimeName(runtimeId, newName);

  const runWithParams = (params: any = {}) => {
    const scope = boardContext?.scopes[runtimeId];
    const api = boardContext?.runtimeApis[runtime.type];
    if (scope && api) {
      api.processRuntime(scope, params, null);
    }
    if (showRunWithParams) {
      setShowRunWithParams(false);
    }
  };

  const onProcess = (withParams?: boolean) => {
    if (withParams) {
      setShowRunWithParams(true);
    } else {
      runWithParams();
    }
  };

  const onClear = () => {
    boardContext?.removeAllServices(runtime);
  };

  const onDelete = () => {
    boardContext?.removeRuntime(runtime);
  };

  const onConfiguration = () => {
    setIsRuntimeConfigOpen(true);
  };

  const runtimeConfig = JSON.stringify(
    { runtime, services: boardContext?.services[runtime.id] },
    null,
    2
  );

  const onApplyRuntimeConfig = (newConfig: string) => {
    console.log("Apply runtime config not implememnted", newConfig);
  };

  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex items-end gap-3 px-2 min-h-10">
        <RuntimeSettings
          runtime={runtime}
          isExpanded={isExpanded}
          wrapServices={wrapServices}
          onExpand={onExpand}
          onWrapServices={onWrapServices}
          onProcess={onProcess}
          onClear={onClear}
          onDelete={onDelete}
          onConfiguration={onConfiguration}
        />
        <div className="flex items-end font-sans">
          <Editable value={name} title={runtimeId} onChange={onChangeName} />
        </div>
      </div>

      <div className="ml-auto my-2">
        <RuntimeServiceMenu
          runtimeId={runtimeId}
          registry={registry}
          appViewMode={appViewMode}
          onAddService={onAddService}
        />
      </div>

      <RunParamsDialog
        open={showRunWithParams}
        onClose={() => setShowRunWithParams(false)}
        onRun={runWithParams}
      />

      <EditorDialog
        title="Runtime Configuration"
        value={runtimeConfig}
        isOpen={isRuntimeConfigOpen}
        onClose={() => setIsRuntimeConfigOpen(false)}
        onApply={onApplyRuntimeConfig}
      />
    </div>
  );
}
