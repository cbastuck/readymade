import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  ServiceAction,
  ServiceClass,
  ServiceInstance,
  ServiceUIComponent,
} from "hkp-frontend/src/types";
import ServiceSelector from "hkp-frontend/src/ui-components/ServiceSelector";
import { findServiceUI as restFindServiceUI } from "../rest/UIRegistry";
import RuntimeRestServiceUI from "../rest/RuntimeRestServiceUI";
import ServiceWithDropBars from "../ServiceWithDropBars";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  state?: any;
};

type Props = {
  service: ServiceInstance;
  findServiceUI?: (serviceId: string) => ServiceUIComponent | null;
  FallbackUI?: React.ComponentType<any>;
  /** Optional: returns the real in-process service instance for a given instanceId.
   *  When provided and non-null, the real instance is used for the service UI so
   *  that notification channels (app.registerNotificationTarget) wire up correctly. */
  getActualInstance?: (instanceId: string) => ServiceInstance | null;
};

export default function SubServicePipelineUI({
  service,
  findServiceUI = restFindServiceUI,
  FallbackUI = RuntimeRestServiceUI,
  getActualInstance,
}: Props) {
  const pipeline: PipelineEntry[] = service.state?.pipeline ?? [];
  const registry = service.app.listAvailableServices();
  const [collapsed, setCollapsed] = useState(false);

  const findDescriptor = (serviceId: string): ServiceClass | undefined =>
    registry.find((entry) => entry.serviceId === serviceId);

  const append = (svc: { serviceId: string }) => {
    service.configure({ appendService: { serviceId: svc.serviceId } });
  };

  const remove = (instanceId: string) => {
    service.configure({ removeService: instanceId });
  };

  const rearrange = (movedInstanceId: string, targetPos: number) => {
    const newPipeline = pipeline.filter(
      (entry) => entry.instanceId !== movedInstanceId,
    );
    const movedEntry = pipeline.find(
      (entry) => entry.instanceId === movedInstanceId,
    );
    if (!movedEntry) return;
    newPipeline.splice(targetPos, 0, movedEntry);
    service.configure({ pipeline: newPipeline });
  };

  return (
    <div className="w-full flex flex-col">
      {!collapsed && pipeline.length === 0 ? (
        <div className="flex items-center">
          Empty container
          <ServiceSelector
            id={`sub-pipeline-${service.uuid}`}
            registry={registry}
            onAddService={append}
          />
        </div>
      ) : (
        <div className="flex w-full ">
          <button
            className="text-gray-400 hover:text-gray-600 flex items-center"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand pipeline" : "Collapse pipeline"}
          >
            {collapsed ? "Show " : "Hide "}Content
            {collapsed ? (
              <ChevronRight size={14} strokeWidth={1.5} />
            ) : (
              <ChevronDown size={14} strokeWidth={1.5} />
            )}
          </button>
          <div className="flex ml-auto">
            <ServiceSelector
              id={`sub-pipeline-${service.uuid}`}
              registry={registry}
              onAddService={append}
            />
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="flex flex-row">
          {pipeline.map((entry, pos) => {
            const descriptor = findDescriptor(entry.serviceId);

            const onSubServiceAction = (command: ServiceAction) => {
              if (command.action === "remove") {
                remove(entry.instanceId);
              }
            };

            // Proxy instance: routes configure() through the parent sub-service
            // so that config changes are persisted in the outer state.
            const configureProxy = async (config: object) => {
              await service.configure({
                configureService: {
                  instanceId: entry.instanceId,
                  state: config,
                },
              });
            };

            const proxyInstance: ServiceInstance = {
              uuid: entry.instanceId,
              serviceId: entry.serviceId,
              serviceName: descriptor?.serviceName ?? entry.serviceId,
              version: descriptor?.version,
              capabilities: descriptor?.capabilities,
              state: entry.state,
              app: service.app,
              board: service.board,
              configure: configureProxy,
              process: async () => {},
              getConfiguration: async () => entry.state,
              destroy: async () => {},
            };

            // If a real in-process instance is available (browser pipeline mode),
            // use it so that notification targets wire up to the inner scope's app.
            // Keep configure() pointing at the proxy so config changes are persisted.
            const realInstance = getActualInstance?.(entry.instanceId);
            const subServiceInstance: ServiceInstance = realInstance
              ? { ...realInstance, configure: configureProxy }
              : proxyInstance;

            const SubServiceUI =
              (entry.serviceId && findServiceUI(entry.serviceId)) ||
              FallbackUI;

            const uiElement = React.createElement(SubServiceUI as any, {
              service: subServiceInstance,
              showBypassOnlyIfExplicit: true,
              draggable: true,
              onServiceAction: onSubServiceAction,
            });

            return (
              <ServiceWithDropBars
                key={entry.instanceId}
                index={pos}
                onDrop={rearrange}
                allowDropBehind={pos === pipeline.length - 1}
              >
                <div className="px-0.5">{uiElement}</div>
              </ServiceWithDropBars>
            );
          })}
        </div>
      )}
    </div>
  );
}
