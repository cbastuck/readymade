import { useContext, useState } from "react";

import {
  isRuntimeRestClassType,
  isRuntimeConfiguration,
  RuntimeConfiguration,
  RuntimeDescriptor,
  ServiceClass,
  ServiceDescriptor,
  ServiceRegistry,
  toCanonicalRuntimeClassType,
} from "hkp-frontend/src/types";
import Editable from "hkp-frontend/src/ui-components/Editable";
import { BoardCtx } from "hkp-frontend/src/BoardContext";

import RunParamsDialog from "./RunParamsDialog";
import RuntimeSettings from "./RuntimeSettings";
import ServiceSelector from "../ServiceSelector";

import RuntimeConfigurationDialog from "./RuntimeConfigurationDialog";

type Props = {
  runtime: RuntimeDescriptor;
  registry: ServiceRegistry;
  isExpanded?: boolean;
  wrapServices?: boolean;
  backgroundColor?: string;
  onAddService: (svc: ServiceClass) => void;
  onExpand: (isExpanded: boolean) => void;
  onWrapServices: (isWrapped: boolean) => void;
  onSave: () => void;
};

export default function RuntimeHeader({
  runtime,
  registry,
  isExpanded,
  wrapServices,
  backgroundColor,
  onAddService,
  onExpand,
  onWrapServices,
  onSave,
}: Props) {
  const [showRunWithParams, setShowRunWithParams] = useState(false);
  const [isRuntimeConfigOpen, setIsRuntimeConfigOpen] = useState(false);
  const [enrichedConfig, setEnrichedConfig] =
    useState<RuntimeConfiguration | null>(null);

  const { name, id: runtimeId } = runtime;
  const boardContext = useContext(BoardCtx);
  const onChangeName = (newName: string) =>
    boardContext?.setRuntimeName(runtimeId, newName);

  const runWithParams = (params: any = {}) => {
    const scope = boardContext?.scopes[runtimeId];
    const api =
      boardContext?.runtimeApis[runtime.type] ||
      boardContext?.runtimeApis[toCanonicalRuntimeClassType(runtime.type)];
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

  const onWrapInSubService = isRuntimeRestClassType(runtime.type)
    ? async () => {
        if (!boardContext) {
          return;
        }
        const scope = boardContext.scopes[runtimeId];
        const api =
          boardContext.runtimeApis[runtime.type] ||
          boardContext.runtimeApis[toCanonicalRuntimeClassType(runtime.type)];
        if (!scope || !api) {
          return;
        }

        const currentServices = boardContext.services[runtimeId] || [];
        if (currentServices.length === 0) {
          return;
        }

        const pipelineEntries = await Promise.all(
          currentServices.map(async (svc) => {
            const state = await api.getServiceConfig(scope, svc);
            return {
              serviceId: svc.serviceId,
              instanceId: svc.uuid,
              ...(state ? { state } : {}),
            };
          }),
        );

        const subSvcClass: ServiceClass = boardContext.registry[
          runtimeId
        ]?.find((svc) => svc.serviceId === "sub-service") || {
          serviceId: "sub-service",
          serviceName: "SubService",
          capabilities: ["subservices"],
        };
        const newSvc = await (boardContext.addService(
          subSvcClass,
          runtime,
        ) as unknown as Promise<ServiceDescriptor | null>);
        if (!newSvc) return;

        await api.configureService(scope, newSvc, {
          pipeline: pipelineEntries,
        });

        for (const svc of currentServices) {
          await boardContext.removeService(svc, runtime);
        }
      }
    : undefined;

  const onDelete = () => {
    boardContext?.removeRuntime(runtime);
  };

  const onConfiguration = async () => {
    const scope = boardContext?.scopes[runtimeId];
    const api =
      boardContext?.runtimeApis[runtime.type] ||
      boardContext?.runtimeApis[toCanonicalRuntimeClassType(runtime.type)];
    const rawServices = boardContext?.services[runtime.id] || [];
    const enrichedServices = await Promise.all(
      rawServices.map(async (svc) => {
        const state =
          scope && api ? await api.getServiceConfig(scope, svc) : undefined;
        return {
          uuid: svc.uuid,
          serviceId: svc.serviceId,
          serviceName: svc.serviceName,
          state,
        };
      }),
    );
    setEnrichedConfig({ runtime, services: enrichedServices });
    setIsRuntimeConfigOpen(true);
  };

  const onApplyRuntimeConfig = (
    newConfig: string | object,
    closeDialog = true,
  ) => {
    const config =
      typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig;
    if (isRuntimeConfiguration(config)) {
      boardContext?.updateRuntime(runtime.id, config);
      if (closeDialog) {
        setIsRuntimeConfigOpen(false);
      }
    } else {
      throw new Error("Invalid runtime configuration");
    }
  };

  const runtimeConfig: RuntimeConfiguration = {
    runtime,
    services: boardContext?.services[runtime.id] || [],
  };

  return (
    <div
      className="flex items-center gap-3 pl-2 cursor-move w-full overflow-clip"
      style={{ backgroundColor }}
    >
      <div className="flex items-end gap-3 px-2 mr-auto">
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
          onSave={onSave}
          onWrapInSubService={onWrapInSubService}
        />

        <Editable
          className="text-base-plus"
          id={`runtime-name-${runtimeId}`}
          value={name}
          title={runtimeId}
          onChange={onChangeName}
        />
      </div>

      <ServiceSelector
        id={runtimeId}
        registry={registry}
        onAddService={onAddService}
      />

      <RunParamsDialog
        open={showRunWithParams}
        onClose={() => setShowRunWithParams(false)}
        onRun={runWithParams}
      />

      <RuntimeConfigurationDialog
        isOpen={isRuntimeConfigOpen}
        onClose={() => setIsRuntimeConfigOpen(false)}
        config={enrichedConfig || runtimeConfig}
        onApply={onApplyRuntimeConfig}
      />
    </div>
  );
}
