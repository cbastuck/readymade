import { useEffect, useMemo, useState } from "react";

import {
  ServiceAction,
  ServiceClass,
  ServiceInstance,
  ServiceModule,
  ServiceUIProps,
} from "@/types";

import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";

import ServiceSelector from "@/ui-components/ServiceSelector";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";
import Button from "@/ui-components/Button";

type InstancesState = {
  instances: Array<ServiceInstance>;
  bypass: { [serviceUuid: string]: boolean };
};
export default function LooperUI(props: ServiceUIProps) {
  const { service } = props;
  const [instancesState, setInstancesState] = useState<InstancesState>({
    instances: [],
    bypass: {},
  });
  const [numIterations, setNumIterations] = useState(1);
  const [iterationResults, setIterationResults] = useState<Array<any>>([]);

  const updateBypass = (instances: Array<ServiceInstance>) => {
    return instances.reduce(
      (all, ssvc) => ({ ...all, [ssvc.uuid]: ssvc.bypass }),
      {}
    );
  };

  const onUpdate = (state: any) => {
    if (needsUpdate(state.instances, instances)) {
      setInstancesState({
        instances: state.instances,
        bypass: updateBypass(state.instances),
      });
    }

    if (needsUpdate(state.numIterations, numIterations)) {
      setNumIterations(state.numIterations);
    }

    if (state.iterationResults !== undefined) {
      setIterationResults(state.iterationResults);
    }
  };

  const onAppendService = (svc: ServiceClass) => service.appendSubService(svc);

  /*
  const onRemoveService = (ev: MouseEvent, ssvc: ServiceInstance) => {
    service.removeSubservice(ssvc);
    ev.preventDefault();
    ev.stopPropagation();
  };
  */

  const onServiceAction = (action: ServiceAction) => {
    console.log("LooperUI.onServiceAction", action);
  };

  const [availableServices, setAvailableServices] = useState<
    Array<ServiceModule>
  >([]);
  const app = service.app;
  useEffect(() => setAvailableServices(app.listAvailableServices()), [app]);

  const instances = instancesState.instances;
  const instanceUIs = useMemo(
    () => instances.map((ssvc) => service.app.createSubServiceUI(ssvc)),
    [instances]
  );

  const onIterate = () => {
    service.configure({ command: { action: "loop" } });
  };

  return (
    <ServiceUI
      {...props}
      onInit={onUpdate}
      onNotification={onUpdate}
      initialSize={{ width: 550, height: undefined }}
    >
      <div className="w-full h-full my-4 flex flex-col gap-4">
        <div className="w-full flex items-center gap-4">
          <Button
            className="w-full"
            onClick={onIterate}
            disabled={iterationResults.length === 0}
          >
            Iterate
          </Button>
        </div>
        <Accordion
          className="mx-4"
          type="single"
          collapsible
          defaultValue="loop-body"
        >
          <AccordionItem value="loop-body">
            <AccordionTrigger className="w-full">Loop Body</AccordionTrigger>
            <AccordionContent className="flex flex-col border p-4">
              <div className="flex items-end w-full">
                <div className="ml-auto">
                  <ServiceSelector
                    id={service.uuid}
                    registry={availableServices}
                    onAddService={onAppendService}
                  />
                </div>
              </div>
              <div className="flex gap-4 overflow-x-auto">
                {instances.map((ssvc, idx) => (
                  <ServiceUI
                    key={`looper-svc-frame-${ssvc.uuid}`}
                    service={ssvc}
                    onServiceAction={onServiceAction}
                  >
                    {instanceUIs[idx]}
                  </ServiceUI>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ServiceUI>
  );
}
