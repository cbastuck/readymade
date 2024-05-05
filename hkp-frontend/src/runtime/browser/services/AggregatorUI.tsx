import { Component } from "react";

import ServiceUI from "../../services/ServiceUI";
import { ServiceInstance, ServiceUIProps } from "../../../types";
import Input from "@/ui-components/Input";
import { needsUpdate } from "@/ui-components/service/ServiceUI";
import NumberInput from "@/ui-components/NumberInput";
import RadioGroup from "@/ui-components/RadioGroup";

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
      interval: initialState.state.interval || 100,
      property: initialState.state.property || "",
      aggregator: initialState.state.aggregator || aggOptions[0],
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
          title="Aggregate Property"
          value={property}
          onChange={(property) => {
            service.configure({ property });
          }}
        />

        <div className="pt-4">
          <RadioGroup
            id={`aggregator-${service.uuid}`}
            title="Aggregate Mode"
            options={aggOptions}
            value={aggregator}
            onChange={(newAggregator) =>
              service.configure({ aggregator: newAggregator })
            }
          />
        </div>

        <NumberInput
          title="Aggregate Interval"
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
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[{ name: "main", render: this.renderMain }]}
      />
    );
  }
}
