import { useState, MouseEvent } from "react";
import { Trash } from "lucide-react";

import {
  ServiceClass,
  ServiceInstance,
  ServiceUIProps,
} from "hkp-frontend/src/types";

import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import GroupLabel from "hkp-frontend/src/ui-components/GroupLabel";
import ServiceSelector from "hkp-frontend/src/ui-components/ServiceSelector";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

const defaultInput = "multiplex";
const defaultOutput = "array";

export default function StackUI(props: ServiceUIProps) {
  const [subservices, setSubservices] = useState<Array<ServiceInstance>>([]);
  const [input, setInput] = useState<string>(defaultInput);
  const [output, setOutput] = useState<string>(defaultOutput);
  const [bypass, setBypass] = useState<{ [serviceUuid: string]: boolean }>({});

  const updateBypass = (ssvcs: Array<ServiceInstance>) => {
    return ssvcs.reduce(
      (all, ssvc) => ({ ...all, [ssvc.uuid]: ssvc.bypass }),
      {}
    );
  };

  const onInit = (initialState: any) => {
    const {
      subservices: ss = [],
      input: inp = defaultInput,
      output: out = defaultOutput,
    } = initialState;
    const b = updateBypass(ss);
    setSubservices(ss);
    setInput(inp);
    setOutput(out);
    setBypass(b);
  };

  const onNotification = (notification: any) => {
    const { subservices: ss, input: inp, output: out } = notification;

    if (ss !== undefined) {
      const b = updateBypass(ss);
      setSubservices(ss);
      setBypass(b);
    }

    if (inp !== undefined) {
      setInput(inp);
    }

    if (out !== undefined) {
      setOutput(out);
    }
  };

  const onAppendService = (svc: ServiceClass) =>
    props.service.appendSubService(svc);

  const onRemoveService = (ev: MouseEvent, ssvc: ServiceInstance) => {
    props.service.removeSubservice(ssvc);
    ev.preventDefault();
    ev.stopPropagation();
  };

  const renderMain = (service: ServiceInstance) => {
    const inputOptions = ["multiplex", "lanes"];
    const outputOptions = ["array"];
    const services = service.app.listAvailableServices();
    return (
      <div className="w-full h-full my-4 flex flex-col gap-4">
        <RadioGroup
          title="Input"
          options={inputOptions}
          value={input}
          onChange={(inp) => service.configure({ input: inp })}
        />
        <RadioGroup
          title="Output"
          options={outputOptions}
          value={output}
          onChange={(out) => service.configure({ output: out })}
        />

        <div className="flex items-end w-full">
          <GroupLabel>Services</GroupLabel>
          <div className="ml-auto">
            <ServiceSelector
              id={service.uuid}
              registry={services}
              onAddService={onAppendService}
            />
          </div>
        </div>

        <Accordion className="mx-4" type="single" collapsible>
          {subservices.map((ssvc) => (
            <AccordionItem value={`item-${ssvc.uuid}`} key={ssvc.uuid}>
              <AccordionTrigger>
                <div title={ssvc.uuid} className="text-base">
                  {ssvc.__descriptor
                    ? ssvc.__descriptor.serviceName
                    : ssvc.serviceName}
                </div>
              </AccordionTrigger>

              <AccordionContent className="flex flex-col border p-4">
                {service.app.createSubServiceUI(ssvc)}
                <Button
                  className="m-2"
                  variant="destructive"
                  onClick={(ev) => onRemoveService(ev, ssvc)}
                >
                  <Trash size="20px" />
                </Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  };

  const { service } = props;
  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 450, height: undefined }}
    >
      {renderMain(service)}
    </ServiceUI>
  );
}
