import { Component } from "react";

import InputField from "hkp-frontend/src/components/shared/InputField";
import Button from "hkp-frontend/src/ui-components/Button";

import { ServiceUIProps } from "@/types";
import ServiceUI from "@/ui-components/service/ServiceUI";
import { DownloadIcon, X, Eye } from "lucide-react";
import MenuIcon from "@/ui-components/MenuIcon";
import Editor from "@/components/shared/Editor";

type State = {
  capacity: number;
  items: Array<any>;
  displayBuffer: any;
};

export default class BufferUI extends Component<ServiceUIProps, State> {
  state: State = {
    capacity: 0,
    items: [],
    displayBuffer: undefined,
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
      <div className="flex flex-col w-full h-full max-h-[400px] overflow-auto border-solid border text-left">
        {items.map((item, idx) => (
          <div key={`buffer-list-item-${idx}`} className="flex">
            <div className="mx-2">{this.renderItem(item)}</div>
            <div className="ml-auto">
              <Button className="h-[30px]" onClick={() => downloadBuffer(item)}>
                <DownloadIcon size={20} />
              </Button>
              <Button
                className="h-[30px]"
                onClick={() => this.setState({ displayBuffer: item })}
              >
                <Eye size={20} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  renderSingle = (item: any) => {
    const valueStr = JSON.stringify(item, null, 2);
    return (
      <div className="h-[280px] w-full pb-12">
        <div className="flex">
          <h1>Item</h1>
          <Button
            className="ml-auto"
            onClick={() => this.setState({ displayBuffer: undefined })}
          >
            <X />
          </Button>
        </div>
        <Editor value={valueStr} />
      </div>
    );
  };

  onClear = () => this.props.service.configure({ action: "clear" });

  render() {
    const customMenuEntries = [
      {
        name: "Clear",
        icon: <MenuIcon icon={X} />,
        disabled: this.state.items.length === 0,
        onClick: this.onClear,
      },
    ];

    const { displayBuffer } = this.state;
    return (
      <ServiceUI
        {...this.props}
        className="pb-2"
        onInit={this.onInit}
        onNotification={this.onNotification}
        customMenuEntries={customMenuEntries}
        initialSize={{ width: 280, height: undefined }}
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

          {displayBuffer
            ? this.renderSingle(displayBuffer)
            : this.renderBuffer()}
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
