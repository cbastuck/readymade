import { Component, MouseEvent } from "react";
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

type State = {
  subservices: Array<ServiceInstance>;
  input: string;
  output: string;
  bypass: { [serviceUuid: string]: boolean };
};
export default class StackUI extends Component<ServiceUIProps, State> {
  state: State = {
    subservices: [],
    input: defaultInput,
    output: defaultOutput,
    bypass: {},
  };

  updateBypass = (subservices: Array<ServiceInstance>) => {
    return subservices.reduce(
      (all, ssvc) => ({ ...all, [ssvc.uuid]: ssvc.bypass }),
      {}
    );
  };

  onInit = (initialState: any) => {
    const {
      subservices = [],
      input = defaultInput,
      output = defaultOutput,
    } = initialState;
    const bypass = this.updateBypass(subservices);
    this.setState({
      subservices,
      input,
      output,
      bypass,
    });
  };

  onNotification = (notification: any) => {
    const { subservices, input, output } = notification;

    if (subservices !== undefined) {
      const bypass = this.updateBypass(subservices);
      this.setState({
        subservices,
        bypass,
      });
    }

    if (input !== undefined) {
      this.setState({ input });
    }

    if (output !== undefined) {
      this.setState({ output });
    }
  };

  onAppendService = (svc: ServiceClass) =>
    this.props.service.appendSubService(svc);

  onRemoveService = (ev: MouseEvent, ssvc: ServiceInstance) => {
    this.props.service.removeSubservice(ssvc);
    ev.preventDefault();
    ev.stopPropagation();
  };

  renderMain = (service: ServiceInstance) => {
    const { subservices = [], output, input } = this.state;

    const inputOptions = ["multiplex", "lanes"];
    const outputOptions = ["array"];
    const services = service.app.listAvailableServices();
    return (
      <div className="w-full h-full my-4 flex flex-col gap-4">
        <RadioGroup
          title="Input"
          options={inputOptions}
          value={input}
          onChange={(input) => service.configure({ input })}
        />
        <RadioGroup
          title="Output"
          options={outputOptions}
          value={output}
          onChange={(output) => service.configure({ output })}
        />

        <div className="flex items-end w-full">
          <GroupLabel>Services</GroupLabel>
          <div className="ml-auto">
            <ServiceSelector
              id={service.uuid}
              registry={services}
              onAddService={this.onAppendService}
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
                  onClick={(ev) => this.onRemoveService(ev, ssvc)}
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

  render() {
    const { service } = this.props;
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        initialSize={{ width: 450, height: undefined }}
      >
        {this.renderMain(service)}
      </ServiceUI>
    );
  }
}
