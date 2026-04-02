import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ServiceAction, ServiceInstance } from "hkp-frontend/src/types";
import ServiceSelector from "hkp-frontend/src/ui-components/ServiceSelector";
import { findServiceUI } from "../UIRegistry";
import RealtimeRuntimeServiceUI from "../RealtimeRuntimeServiceUI";
import ServiceWithDropBars from "../../ServiceWithDropBars";

type PipelineEntry = {
  serviceId: string;
  instanceId: string;
  state?: any;
};

type Props = {
  service: ServiceInstance;
};

export default function SubServicePipelineUI({ service }: Props) {
  const pipeline: PipelineEntry[] = service.state?.pipeline ?? [];
  const registry = service.app.listAvailableServices();
  const [collapsed, setCollapsed] = useState(false);

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
            const onSubServiceAction = (command: ServiceAction) => {
              if (command.action === "remove") {
                remove(entry.instanceId);
              }
            };

            const subServiceInstance: ServiceInstance = {
              uuid: entry.instanceId,
              serviceId: entry.serviceId,
              serviceName: entry.serviceId,
              state: entry.state,
              app: service.app,
              board: service.board,
              configure: async (config: object) => {
                await service.configure({
                  configureService: {
                    instanceId: entry.instanceId,
                    state: config,
                  },
                });
              },
              process: async () => {},
              getConfiguration: async () => entry.state,
              destroy: async () => {},
            };

            const SubServiceUI =
              (entry.serviceId && findServiceUI(entry.serviceId)) ||
              RealtimeRuntimeServiceUI;

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
