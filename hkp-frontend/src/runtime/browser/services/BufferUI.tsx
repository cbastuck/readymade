import { Component } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "hkp-frontend/src/ui-components/primitives/accordion";

import Button from "hkp-frontend/src/ui-components/Button";

import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { DownloadIcon, X, Eye, BugPlay } from "lucide-react";
import MenuIcon from "hkp-frontend/src/ui-components/MenuIcon";
import Editor from "hkp-frontend/src/components/shared/Editor";
import Slider from "hkp-frontend/src/ui-components/Slider";
import Switch from "hkp-frontend/src/ui-components/Switch";
import { isFunction } from "./helpers";

type BufferItem = any;

type State = {
  capacity: number;
  interval: number;
  items: Array<BufferItem>;
  displayItem: BufferItem;
  displayItemContent: string;
  accumulatedOutput: boolean;
  isAccordionOpen: boolean;
};

export default class BufferUI extends Component<ServiceUIProps, State> {
  state: State = {
    capacity: 0,
    interval: 0,
    items: [],
    displayItem: undefined,
    displayItemContent: "",
    accumulatedOutput: false,
    isAccordionOpen: false,
  };

  update = (state: any) => {
    const { capacity, interval, accumulatedOutput } = state;

    if (needsUpdate(capacity, this.state.capacity)) {
      this.setState({ capacity });
    }

    if (needsUpdate(interval, this.state.interval)) {
      this.setState({ interval });
    }

    if (needsUpdate(accumulatedOutput, this.state.accumulatedOutput)) {
      this.setState({ accumulatedOutput });
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
    if (item instanceof Blob) {
      return `Blob with size ${item.size} bytes`;
    }
    if (item instanceof Uint8Array) {
      return `Binary data with length ${item.length}`;
    }
    if (type === "string") {
      return `String with length ${item.length}`;
    }

    if (Array.isArray(item)) {
      return `Array with length ${item.length}`;
    }

    if (isFunction(item)) {
      return `Function instance`;
    }

    return "JSON";
  };

  onInjectItem = (item: any) => {
    this.props.service.configure({
      command: { action: "inject", params: item },
    });
  };

  renderBuffer = () => {
    const { items, isAccordionOpen } = this.state;
    return (
      <Accordion
        type="single"
        collapsible
        className="w-full"
        value={isAccordionOpen ? "accordion-item" : ""}
      >
        <AccordionItem value="accordion-item">
          <AccordionTrigger
            className="tracking-wider"
            onClick={() =>
              this.setState({
                isAccordionOpen: !isAccordionOpen,
              })
            }
          >
            Items ({this.state.items.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col w-full h-full max-h-[300px] overflow-y-auto border-solid border text-left">
              {items.map((item, idx) => (
                <div
                  key={`buffer-list-item-${idx}`}
                  className="flex items-center"
                >
                  <div className="mx-2">{this.renderItem(item)}</div>
                  <div className="ml-auto mr-2 flex gap-3">
                    <Button
                      size="xs"
                      variant="ghost"
                      className="h-[25px]"
                      onClick={() => downloadBuffer(item)}
                    >
                      <DownloadIcon size={16} />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="h-[25px]"
                      onClick={async () => {
                        const data =
                          item instanceof Blob
                            ? await blobToString(item)
                            : JSON.stringify(item, null, 2);

                        this.setState({
                          displayItem: item,
                          displayItemContent: data,
                        });
                      }}
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="h-[25px]"
                      onClick={() => this.onInjectItem(item)}
                    >
                      <BugPlay size={16} />
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

  renderSingle = () => {
    return (
      <div className="h-[280px] w-full pb-12">
        <div className="flex">
          <h1>Item</h1>
          <Button
            className="ml-auto"
            onClick={() =>
              this.setState({
                displayItem: undefined,
                displayItemContent: "",
              })
            }
          >
            <X />
          </Button>
        </div>
        <Editor value={this.state.displayItemContent} />
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

  onAccumulateOutput = (newChecked: boolean) => {
    this.props.service.configure({ accumulatedOutput: newChecked });
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

    const { displayItem } = this.state;
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
          <div className="flex w-full items-end mt-2">
            <Slider
              title="Interval"
              min={0}
              max={10000}
              value={this.state.interval}
              onChange={this.onChangeInterval}
            />
            <div className="ml-auto pl-2"> sec</div>
          </div>
          <div className="mt-2">
            <Switch
              title="Accumulate Output"
              checked={this.state.accumulatedOutput}
              onCheckedChange={this.onAccumulateOutput}
            />
          </div>

          {displayItem ? this.renderSingle() : this.renderBuffer()}
        </div>
      </ServiceUI>
    );
  }
}

function downloadBuffer(item: BufferItem) {
  const a = document.createElement("a");
  const blob =
    item instanceof Blob
      ? item
      : item instanceof Uint8Array
      ? new Blob([item], { type: "application/octet-stream" })
      : new Blob([JSON.stringify(item)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = "buffer";
  a.click();
  setTimeout(() => window.URL.revokeObjectURL(url), 10);
}

function blobToString(blob: Blob) {
  return blob.text();
}
