import { useRef, useState } from "react";

import Editor, { EditorHandle } from "../../../components/shared/Editor/index";
import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import { ServiceInstance, ServiceUIProps } from "hkp-frontend/src/types";
import { Size } from "hkp-frontend/src/common";
import { HealthStatus } from "./Hacker";

export default function HackerUI(props: ServiceUIProps) {
  const [buffer, setBuffer] = useState("");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    error: false,
  });
  const [size, setSize] = useState([300, 150]);

  const onInit = (service: ServiceInstance) => {
    const { buffer, size } = service;
    if (buffer !== undefined) {
      setBuffer(buffer);
    }

    if (size !== undefined) {
      setSize([size[0], size[1]]);
    }
  };

  const onNotification = (notification: any) => {
    console.log("HackerUI.onNotification", notification);
    if (needsUpdate(notification.healthStatus, healthStatus)) {
      setHealthStatus(notification.healthStatus);
    }

    if (needsUpdate(notification.size, size)) {
      setSize(notification.size);
    }
    if (needsUpdate(notification.buffer, buffer)) {
      setBuffer(notification.buffer);
    }
  };

  const onResize = (
    service: ServiceInstance,
    { width = 0, height = 0 }: Size
  ) => {
    const resized = { size: [Number(width), Number(height)] };
    service.configure(resized);
  };

  const onChange = (buffer: string) => props.service.configure({ buffer });

  return (
    <ServiceUI
      {...props}
      onNotification={onNotification}
      onInit={onInit}
      resizable={true}
      onResize={onResize}
    >
      <HackerUIPanel
        buffer={buffer}
        healthStatus={healthStatus}
        onChange={onChange}
      />
    </ServiceUI>
  );
}

type Props = {
  buffer: string;
  healthStatus: { error: boolean; message?: string };
  title?: string;
  onChange: (updatedBuffer: string) => void;
};
export function HackerUIPanel({
  buffer,
  healthStatus,
  title = "Health",
  onChange,
}: Props) {
  const editorRef = useRef<EditorHandle>(null);
  return (
    <div
      className="select-none"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div className="flex items-center">
        <div>{title}</div>
        <div
          className="ml-2"
          style={{
            fontFamily: "Arial",
            fontSize: "30px",
            color: healthStatus.error ? "red" : "green",
          }}
        >
          •
        </div>
        <div
          className="ml-2"
          style={{
            color: "orange",
            textTransform: "none",
          }}
        >
          {healthStatus.error && `[${healthStatus.message}]`}
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: !healthStatus.error ? "none" : undefined,
          }}
        >
          <button className="hkp-svc-btn" onClick={() => onChange(editorRef.current?.getValue())}>
            fixed
          </button>
        </div>
      </div>
      <div className="w-full h-full mb-2">
        <Editor
          ref={editorRef}
          value={buffer}
          language="javascript"
          onChange={(buffer) => buffer && onChange(buffer)}
        />
      </div>
    </div>
  );
}
