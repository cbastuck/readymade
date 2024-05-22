import { Component } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";

import { ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";

type State = {
  capacity: number;
  items: Array<any>;
};

export default class BufferUI extends Component<ServiceUIProps, State> {
  state: State = {
    capacity: 0,
    items: [],
  };

  onInit = (initialState: any) => {
    const { capacity } = initialState;
    this.setState({
      capacity,
    });
  };

  onNotification = async (notification: any) => {
    if (notification.buffer !== undefined) {
      this.setState({ items: notification.buffer });
    }
  };

  renderBuffer = () => {
    const { items } = this.state;
    return (
      <div className="flex flex-col h-[100px] overflow-y-auto border-solid border">
        {items.map((item, idx) => (
          <div key={`buffer-list-item-${idx}`}>{JSON.stringify(item)}</div>
        ))}
      </div>
    );
  };

  onClear = () => this.props.service.configure({ action: "clear" });

  render() {
    return (
      <ServiceUI
        {...this.props}
        className="pb-2"
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        <div className="flex flex-col gap-1">
          <InputField
            value={`${this.state.capacity}`}
            onChange={(value) => {
              const capacity = value !== "" ? Number(value) : undefined;
              if (capacity !== undefined) {
                this.props.service.configure({ capacity });
                this.setState({ capacity });
              }
            }}
            label="Capacity"
            unit="items"
          />

          {this.renderBuffer()}

          <Button className="w-full" onClick={this.onClear}>
            Clear
          </Button>
        </div>
      </ServiceUI>
    );
  }
}
