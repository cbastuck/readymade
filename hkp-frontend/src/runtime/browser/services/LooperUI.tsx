import { useEffect, useMemo, useState } from "react";

import {
  ServiceAction,
  ServiceClass,
  ServiceInstance,
  ServiceModule,
  ServiceUIProps,
} from "hkp-frontend/src/types";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";

import ServiceSelector from "hkp-frontend/src/ui-components/ServiceSelector";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";
import Button from "hkp-frontend/src/ui-components/Button";
import Switch from "hkp-frontend/src/ui-components/Switch";
import SubmittableInput from "hkp-frontend/src/ui-components/SubmittableInput";

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

    if (needsUpdate(state.incrementalOutput, isIncrementalOutput)) {
      setIsIncrementalOutput(state.incrementalOutput);
    }

    if (needsUpdate(state.interactiveMode, isInterativeMode)) {
      setIsInteractiveMode(state.interactiveMode);
    }

    if (needsUpdate(state.loopCondition, loopCondition)) {
      setLoopCondition(state.loopCondition);
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
    [instances, service]
  );

  const onIterate = () => {
    service.configure({ command: { action: "loop" } });
  };

  const [isInterativeMode, setIsInteractiveMode] = useState(false);
  const onChangeInteractiveMode = (checked: boolean) => {
    service.configure({ interactiveMode: checked });
  };

  const [isIncrementalOutput, setIsIncrementalOutput] = useState(false);
  const onChangeIncrementalOutput = (checked: boolean) => {
    service.configure({ incrementalOutput: checked });
  };

  const [loopCondition, setLoopCondition] = useState("");
  const onChangeLoopCondition = (newCondition: string) => {
    service.configure({ loopCondition: newCondition });
  };

  return (
    <ServiceUI
      {...props}
      onInit={onUpdate}
      onNotification={onUpdate}
      initialSize={{ width: 550, height: undefined }}
    >
      <div className="w-full h-full my-4 flex flex-col gap-4">
        <div className="w-full flex flex-col gap-4">
          <div className="w-full flex items-center gap-4">
            <Switch
              title="Interactive"
              checked={isInterativeMode}
              onCheckedChange={onChangeInteractiveMode}
            />
            <Switch
              title="Incremental Output"
              checked={isIncrementalOutput}
              onCheckedChange={onChangeIncrementalOutput}
            />
          </div>
          <div className="w-full flex items-center gap-4">
            <SubmittableInput
              fullWidth
              title="Condition"
              disabled={isInterativeMode}
              value={loopCondition}
              onSubmit={onChangeLoopCondition}
            />
            <Button
              onClick={onIterate}
              disabled={!isInterativeMode || iterationResults.length === 0}
            >
              Iterate
            </Button>
          </div>
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
