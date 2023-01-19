import { useRef, useState } from "react";

import ServiceUI from "./ServiceUI";
import Editor from "../../components/shared/Editor/index";

export function HackerUI(props) {
  const [buffer, setBuffer] = useState("");
  const [healthStatus, setHealthStatus] = useState(true);
  const editorRef = useRef(null);

  const onInit = (service) => {
    const { buffer } = service;
    if (buffer !== undefined) {
      setBuffer(buffer);
    }
  };

  const onNotification = (service, notification) => {
    const { healthStatus } = notification;
    if (healthStatus !== undefined) {
      setHealthStatus(healthStatus);
    }
  };

  return (
    <ServiceUI
      {...props}
      onNotification={onNotification}
      onInit={onInit}
      resizable={true}
    >
      {({ boardContext, service }) => (
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
              textTransform: "uppercase",
              display: "flex",
              flexDirection: "row",
              fontSize: 12,
            }}
          >
            Health
            <div
              style={{
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
                display: !healthStatus.error && "none",
              }}
            >
              <button
                onClick={() =>
                  service.configure({ buffer: editorRef.current.getValue() })
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
          />
        </div>
      )}
    </ServiceUI>
  );
}

export class Hacker {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.buffer = "";
    this.resetHealthStatus(false);
  }

  resetHealthStatus = (notify = false) => {
    this.healthStatus = {
      error: false,
    };
    if (notify) {
      this.app.notify(this, { healthStatus: this.healthStatus });
    }
  };

  baseProcess = async (impl) => {
    const prevHealth = this.healthStatus;
    let res;
    try {
      res = await impl(this.buffer);
      this.healthStatus = { error: false };
    } catch (err) {
      this.onError(err, !prevHealth.error);
    }
    return this.healthStatus.error ? null : res;
  };

  onError = (err, notify) => {
    this.healthStatus = {
      error: true,
      message: err.message,
    };
    if (notify) {
      this.app.notify(this, { healthStatus: this.healthStatus });
    }
  };

  configure = (config) => {
    const { buffer } = config;
    if (buffer !== undefined) {
      this.buffer = buffer;
      if (this.healthStatus.error) {
        this.resetHealthStatus(true);
      }
    }
  };
}
