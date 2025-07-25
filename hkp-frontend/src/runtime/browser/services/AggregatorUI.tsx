import { Component } from "react";

import { ServiceInstance, ServiceUIProps } from "../../../types";
import Input from "hkp-frontend/src/ui-components/Input";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import NumberInput from "hkp-frontend/src/ui-components/NumberInput";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

type State = {
  interval: number;
  property: string;
  aggregator: string;
};
const aggOptions = ["max value count"];

export default class AggregatorUI extends Component<ServiceUIProps, State> {
  state: State = {
    interval: 0,
    property: "",
    aggregator: "",
  };

  onInit = (initialState: any) => {
    this.setState({
      interval: initialState.interval || 100,
      property: initialState.property || "",
      aggregator: initialState.aggregator || aggOptions[0],
    });
  };

  onNotification = async (notification: any) => {
    if (needsUpdate(notification.property, this.state.property)) {
      this.setState({ property: notification.property });
    }

    if (needsUpdate(notification.interval, this.state.interval)) {
      this.setState({ interval: notification.interval });
    }
  };

  renderMain = (service: ServiceInstance) => {
    const { interval, property, aggregator } = this.state;

    return (
      <div className="flex flex-col gap-2">
        <Input
          minHeight
          fullWidth
          title="Property"
          value={property}
          onChange={(property) => {
            service.configure({ property });
          }}
        />

        <div className="pt-4">
          <RadioGroup
            id={`aggregator-${service.uuid}`}
            title="Mode"
            options={aggOptions}
            value={aggregator}
            disabled={true}
            onChange={(newAggregator) =>
              service.configure({ aggregator: newAggregator })
            }
          />
        </div>

        <NumberInput
          title="Interval"
          value={interval}
          onChange={(value) => {
            service.configure({ interval: value });
          }}
        >
          ms
        </NumberInput>
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        className="pb-2"
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {this.renderMain(this.props.service)}
      </ServiceUI>
    );
  }
}
