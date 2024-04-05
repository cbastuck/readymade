import ServiceMenu from "./ServiceMenu";
import {
  AppViewMode,
  RuntimeDescriptor,
  ServiceClass,
  ServiceRegistry,
} from "@/types";
import SettingsDropdown from "./SettingsDropdown";
import Editable from "../Editable";
import RunParamsDialog from "./RunParamsDialog";
import { useContext, useState } from "react";
import { BoardCtx } from "@/BoardContext";

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

export default function Header({
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
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex items-end gap-3 px-2 min-h-10">
        <SettingsDropdown
          runtime={runtime}
          isExpanded={isExpanded}
          wrapServices={wrapServices}
          onExpand={onExpand}
          onWrapServices={onWrapServices}
          onProcess={onProcess}
          onClear={onClear}
          onDelete={onDelete}
        />
        <Editable value={name} title={runtimeId} onChangeName={onChangeName} />
      </div>

      <div className="ml-auto mt-1 mr-0">
        <ServiceMenu
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
    </div>
  );
}
