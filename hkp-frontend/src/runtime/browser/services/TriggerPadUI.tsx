import { useState } from "react";

import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import HoldableButton from "hkp-frontend/src/components/shared/HoldableButton";

export default function TriggerPadUI(props: ServiceUIProps) {
  const [triggeredPads, setTriggeredPads] = useState<{ [key: string]: any }>({});
  const [assignments, setAssignments] = useState<{ [key: string]: any }>({});
  const [armedPad, setArmedPad] = useState<string | undefined>(undefined);

  const onInit = (initialState: any) => {
    setArmedPad(`${initialState.armedPad}`);
    setAssignments(initialState.padAssignments);
  };

  const onNotification = (notification: any) => {
    if (notification.assignments) {
      setAssignments(notification.assignments);
    }

    if (notification.armedPad !== undefined) {
      setArmedPad(`${notification.armedPad}`);
    }
  };

  const renderPad = (
    service: ServiceInstance,
    rowIndex: number,
    colIndex: number
  ) => {
    const index = makeIndex(rowIndex, colIndex);
    const isPadTriggered = triggeredPads[index];
    const isPadAssigned = assignments[index];
    const isPadArmed = armedPad === index;
    const onPush = () => {
      // service.triggerPad(index);
      service.configure({
        command: { action: "trigger-pad", params: { padIndex: index } },
      });
      setTriggeredPads((prev) => ({
        ...prev,
        [index]: true,
      }));
      return true;
    };
    const onEnd = () => {
      if (triggeredPads[index]) {
        setTriggeredPads((prev) => ({
          ...prev,
          [index]: false,
        }));
      }
      return true;
    };
    return (
      <div
        onDragOver={(ev) => {
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
        }}
        onDrop={async (ev) => {
          const item = ev.dataTransfer.getData("text/plain");
          const blob = dataURItoBlob(item);
          service.configure({
            padAssignments: {
              ...assignments,
              [`${index}`]: blob,
            },
          });
        }}
      >
        <HoldableButton
          style={{
            width: 100,
            height: 100,
            margin: 2,
            border: `solid 1px ${isPadArmed ? "#4183c4" : "lightgray"}`,
            backgroundColor: !isPadTriggered
              ? isPadAssigned
                ? "#eff"
                : "white"
              : "#4183c4",
          }}
          onDown={onPush}
          onUp={onEnd}
          onRightClick={() => {
            // service.clearPad(index);
            service.configure({
              command: { action: "clear-pad", params: { padIndex: index } },
            });
          }}
        />
      </div>
    );
  };

  const renderRow = (service: ServiceInstance, rowIndex: number) => {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        {renderPad(service, rowIndex, 0)}
        {renderPad(service, rowIndex, 1)}
        {renderPad(service, rowIndex, 2)}
        {renderPad(service, rowIndex, 3)}
      </div>
    );
  };

  const renderMain = (service: ServiceInstance) => {
    return (
      <div className="flex flex-col mb-2">
        {renderRow(service, 0)}
        {renderRow(service, 1)}
        {renderRow(service, 2)}
        {renderRow(service, 3)}
      </div>
    );
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
    >
      {renderMain(props.service)}
    </ServiceUI>
  );
}

function makeIndex(rowIndex: number, colIndex: number) {
  return `${rowIndex * 4 + colIndex}`;
}

function dataURItoBlob(dataURI_: string) {
  // Split the input to get the mime-type and the data itself
  const dataURI = dataURI_.split(",");

  // First part contains data:audio/ogg;base64 from which we only need audio/ogg
  const type = dataURI[0].split(":")[1].split(";")[0];

  // Second part is the data itself and we decode it
  const byteString = window.atob(dataURI[1]);
  const byteStringLen = byteString.length;

  // Create ArrayBuffer with the byte string and set the length to it
  const ab = new ArrayBuffer(byteStringLen);

  // Create a typed array out of the array buffer representing each character from as a 8-bit unsigned integer
  const intArray = new Uint8Array(ab);
  for (let i = 0; i < byteStringLen; i++) {
    intArray[i] = byteString.charCodeAt(i);
  }
  return new Blob([intArray], { type });
}
