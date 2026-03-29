import { useState } from "react";
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

export default function BufferUI(props: ServiceUIProps) {
  const [capacity, setCapacity] = useState<number>(0);
  const [interval, setInterval] = useState<number>(0);
  const [items, setItems] = useState<Array<BufferItem>>([]);
  const [displayItem, setDisplayItem] = useState<BufferItem>(undefined);
  const [displayItemContent, setDisplayItemContent] = useState<string>("");
  const [accumulatedOutput, setAccumulatedOutput] = useState<boolean>(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(false);

  const update = (state: any) => {
    const {
      capacity: newCapacity,
      interval: newInterval,
      accumulatedOutput: newAccumulatedOutput,
    } = state;

    if (needsUpdate(newCapacity, capacity)) {
      setCapacity(newCapacity);
    }

    if (needsUpdate(newInterval, interval)) {
      setInterval(newInterval);
    }

    if (needsUpdate(newAccumulatedOutput, accumulatedOutput)) {
      setAccumulatedOutput(newAccumulatedOutput);
    }

    if (state.buffer !== undefined) {
      setItems(state.buffer);
    }
  };

  const onInit = (initialState: any) => {
    update(initialState);
  };

  const onNotification = async (notification: any) => {
    update(notification);
  };

  const renderItem = (item: any) => {
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

  const onInjectItem = (item: any) => {
    props.service.configure({
      command: { action: "inject", params: item },
    });
  };

  const renderBuffer = () => {
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
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          >
            Items ({items.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col w-full h-full max-h-[300px] overflow-y-auto border-solid border text-left">
              {items.map((item, idx) => (
                <div
                  key={`buffer-list-item-${idx}`}
                  className="flex items-center"
                >
                  <div className="mx-2">{renderItem(item)}</div>
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

                        setDisplayItem(item);
                        setDisplayItemContent(data);
                      }}
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="h-[25px]"
                      onClick={() => onInjectItem(item)}
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

  const renderSingle = () => {
    return (
      <div className="h-[280px] w-full pb-12">
        <div className="flex">
          <h1>Item</h1>
          <Button
            className="ml-auto"
            onClick={() => {
              setDisplayItem(undefined);
              setDisplayItemContent("");
            }}
          >
            <X />
          </Button>
        </div>
        <Editor value={displayItemContent} />
      </div>
    );
  };

  const onClear = () => props.service.configure({ action: "clear" });

  const onChangeInterval = (newInterval: number) => {
    props.service.configure({ interval: newInterval });
  };

  const onChangeCapacity = (newCapacity: number) => {
    props.service.configure({ capacity: newCapacity });
  };

  const onAccumulateOutput = (newChecked: boolean) => {
    props.service.configure({ accumulatedOutput: newChecked });
  };

  const customMenuEntries = [
    {
      name: "Clear",
      icon: <MenuIcon icon={X} />,
      disabled: items.length === 0,
      onClick: onClear,
    },
  ];

  return (
    <ServiceUI
      {...props}
      className="pb-2"
      onInit={onInit}
      onNotification={onNotification}
      customMenuEntries={customMenuEntries}
      initialSize={{ width: 320, height: undefined }}
    >
      <div className="flex flex-col gap-1">
        <div className="flex w-full items-end">
          <Slider
            title="Capacity"
            min={1}
            max={1000}
            value={capacity}
            onChange={onChangeCapacity}
          />
          <div className="ml-auto pl-2"> items</div>
        </div>
        <div className="flex w-full items-end mt-2">
          <Slider
            title="Interval"
            min={0}
            max={10000}
            value={interval}
            onChange={onChangeInterval}
          />
          <div className="ml-auto pl-2"> sec</div>
        </div>
        <div className="mt-2">
          <Switch
            title="Accumulate Output"
            checked={accumulatedOutput}
            onCheckedChange={onAccumulateOutput}
          />
        </div>

        {displayItem ? renderSingle() : renderBuffer()}
      </div>
    </ServiceUI>
  );
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
