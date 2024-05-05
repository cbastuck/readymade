import { useRef, useState } from "react";

import Editor from "../../../components/shared/Editor/index";
import ServiceUI, { needsUpdate } from "@/ui-components/service/ServiceUI";
import { ServiceInstance, ServiceUIProps } from "@/types";
import { Size } from "@/common";
import { HealthStatus } from "./Hacker";

export default function HackerUI(props: ServiceUIProps) {
  const [buffer, setBuffer] = useState("");
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    error: false,
  });
  const [size, setSize] = useState([300, 150]);
  const editorRef = useRef<Editor>(null);

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
    if (needsUpdate(notification.healthStatus, healthStatus)) {
      setHealthStatus(notification.healthStatus);
    }

    if (needsUpdate(notification.size, size)) {
      setSize(notification.size);
    }
  };

  const onResize = (
    service: ServiceInstance,
    { width = 0, height = 0 }: Size
  ) => {
    const resized = { size: [Number(width), Number(height)] };
    service.configure(resized);
  };

  const { service } = props;
  return (
    <ServiceUI
      {...props}
      onNotification={onNotification}
      onInit={onInit}
      resizable={true}
      onResize={onResize}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          style={{
            textAlign: "left",
            width: "100%",
            padding: 5,
            display: "flex",
            flexDirection: "row",
            fontSize: 12,
          }}
        >
          Health
          <div
            style={{
              fontFamily: "Arial",
              fontSize: "30px",
              marginTop: -2,
              marginLeft: 5,
              color: healthStatus.error ? "red" : "green",
            }}
          >
            •
          </div>
          <div
            style={{
              marginLeft: 10,
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
            <button
              onClick={() =>
                service.configure({ buffer: editorRef.current?.getValue() })
              }
            >
              fixed
            </button>
          </div>
        </div>
        <Editor
          style={{ paddingRight: 15 }}
          ref={editorRef}
          value={buffer}
          language="javascript"
          onChange={(buffer) => service.configure({ buffer })}
          width={size[0]}
          height={size[1]}
        />
      </div>
    </ServiceUI>
  );
}
