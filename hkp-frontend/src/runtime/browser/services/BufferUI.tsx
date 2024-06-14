import { Component } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";

import { ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";
import { DownloadIcon } from "lucide-react";

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

  renderItem = (item: any) => {
    const type = typeof item;
    const isUint8Array = item instanceof Uint8Array;
    if (isUint8Array) {
      return `Binary data with length ${item.length}`;
    }
    if (type === "string") {
      return JSON.stringify(item);
    }
    return type;
  };

  renderBuffer = () => {
    const { items } = this.state;
    return (
      <div className="flex flex-col h-[100px] overflow-auto border-solid border w-[400px] text-left">
        {items.map((item, idx) => (
          <div key={`buffer-list-item-${idx}`} className="flex">
            <div className="mx-2">{this.renderItem(item)}</div>
            <div className="ml-auto">
              <Button className="h-[30px]" onClick={() => downloadBuffer(item)}>
                <DownloadIcon size={20} />
              </Button>
            </div>
          </div>
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

function downloadBuffer(item: any) {
  const a = document.createElement("a");
  const isUint8Array = item instanceof Uint8Array;
  const blob = isUint8Array
    ? new Blob([item], { type: "application/octet-stream" })
    : new Blob([JSON.stringify(item)], { type: "application/json" });
  a.href = window.URL.createObjectURL(blob);
  a.download = "buffer";
  a.click();
}
