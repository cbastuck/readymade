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
import Select from "hkp-frontend/src/ui-components/Select";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "hkp-frontend/src/ui-components/primitives/accordion";
import { Button } from "hkp-frontend/src/ui-components/primitives/button";

const defaultInput = "multiplex";
const defaultOutput = "array";

export default function StackUI(props: ServiceUIProps) {
  const [subservices, setSubservices] = useState<Array<ServiceInstance>>([]);
  const [input, setInput] = useState<string>(defaultInput);
  const [output, setOutput] = useState<string>(defaultOutput);
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);

  const onInit = (initialState: any) => {
    const {
      subservices: ss = [],
      input: inp = defaultInput,
      output: out = defaultOutput,
    } = initialState;
    setSubservices(ss);
    setInput(inp);
    setOutput(out);
    if (ss.length > 0) {
      setOpenItem(`item-${ss[0].uuid}`);
    }
  };

  const onNotification = (notification: any) => {
    const { subservices: ss, input: inp, output: out } = notification;

    if (ss !== undefined) {
      setSubservices(ss);
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
        <div className="flex items-center gap-3">
          <span className="text-base text-muted-foreground">Input</span>
          <Select
            options={inputOptions}
            value={input}
            onChange={(inp) => service.configure({ input: inp })}
          />

          <span className="text-base text-muted-foreground">Output</span>
          <Select
            options={outputOptions}
            value={output}
            onChange={(out) => service.configure({ output: out })}
          />
        </div>

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

        <Accordion className="mx-4" type="single" collapsible value={openItem} onValueChange={setOpenItem}>
          {subservices.map((ssvc) => (
            <AccordionItem value={`item-${ssvc.uuid}`} key={ssvc.uuid}>
              <AccordionPrimitive.Header className="flex items-center">
                <AccordionPrimitive.Trigger className="flex flex-1 items-center py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                  <span title={ssvc.uuid} className="text-base">
                    {ssvc.__descriptor
                      ? ssvc.__descriptor.serviceName
                      : ssvc.serviceName}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
                <Button
                  className="ml-auto mr-2 text-muted-foreground hover:text-destructive"
                  variant="ghost"
                  size="icon"
                  onClick={(ev) => onRemoveService(ev, ssvc)}
                >
                  <Trash size="14px" />
                </Button>
              </AccordionPrimitive.Header>

              <AccordionContent className="flex flex-col border p-4 overflow-auto">
                {service.app.createSubServiceUI(ssvc)}
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
      initialSize={{ width: 800, height: undefined }}
    >
      {renderMain(service)}
    </ServiceUI>
  );
}
