import { Component } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/ui-components/primitives/accordion";

import Button from "hkp-frontend/src/ui-components/Button";

import { ServiceUIProps } from "@/types";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import { DownloadIcon, X, Eye } from "lucide-react";
import MenuIcon from "@/ui-components/MenuIcon";
import Editor from "@/components/shared/Editor";
import Slider from "@/ui-components/Slider";

type State = {
  capacity: number;
  interval: number;
  items: Array<any>;
  displayBuffer: any;
};

export default class BufferUI extends Component<ServiceUIProps, State> {
  state: State = {
    capacity: 0,
    interval: 0,
    items: [],
    displayBuffer: undefined,
  };

  update = (state: any) => {
    const { capacity, interval } = state;

    if (needsUpdate(capacity, this.state.capacity)) {
      this.setState({ capacity });
    }

    if (needsUpdate(interval, this.state.interval)) {
      this.setState({ interval });
    }

    if (state.buffer !== undefined) {
      this.setState({ items: state.buffer });
    }
  };

  onInit = (initialState: any) => {
    this.update(initialState);
  };

  onNotification = async (notification: any) => {
    this.update(notification);
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
      <Accordion type="single" collapsible className="w-full" defaultValue="0">
        <AccordionItem value="item-1">
          <AccordionTrigger className="tracking-wider">
            Items ({this.state.items.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col w-full h-full max-h-[300px] overflow-y-auto border-solid border text-left">
              {items.map((item, idx) => (
                <div key={`buffer-list-item-${idx}`} className="flex">
                  <div className="mx-2">{this.renderItem(item)}</div>
                  <div className="ml-auto">
                    <Button
                      className="h-[30px]"
                      onClick={() => downloadBuffer(item)}
                    >
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
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

  onChangeInterval = (newInterval: number) => {
    this.props.service.configure({ interval: newInterval });
  };

  onChangeCapacity = (newCapacity: number) => {
    this.props.service.configure({ capacity: newCapacity });
  };

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
        initialSize={{ width: 320, height: undefined }}
      >
        <div className="flex flex-col gap-1">
          <div className="flex w-full items-end">
            <Slider
              title="Capacity"
              min={1}
              max={1000}
              value={this.state.capacity}
              onChange={this.onChangeCapacity}
            />
            <div className="ml-auto pl-2"> items</div>
          </div>
          <div className="flex w-full items-end">
            <Slider
              title="Interval"
              min={0}
              max={10000}
              value={this.state.interval}
              onChange={this.onChangeInterval}
            />
            <div className="ml-auto pl-2"> sec</div>
          </div>
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
