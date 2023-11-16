import {
  AppImpl,
  RemoteRuntimeMessageType,
  RuntimeDescriptor,
  RuntimeScope,
} from "../../types";
import { createRemoteRuntimeApp } from "./RemoteRuntimeApp";

export default class RemoteRuntimeScope implements RuntimeScope {
  app: AppImpl;
  descriptor: RuntimeDescriptor; // TODO: better keep the whole runtime descriptor - change API
  outputUrl: string;

  constructor(runtime: RuntimeDescriptor, outputUrl: string) {
    this.app = createRemoteRuntimeApp(this);
    this.descriptor = runtime;
    this.outputUrl = outputUrl;

    if (this.outputUrl) {
      this.connect(this.outputUrl);
    }
  }

  getApp = (): AppImpl => {
    return this.app;
  };

  onResult = async (
    instanceId: string | null,
    result: any,
    requestId: string | null
  ): Promise<void> => {
    console.warn("BrowserRuntimeScope.onResult not set");
  };

  onConfig = (instanceId: string, config: object) => {
    console.warn("BrowserRuntimeScope.onConfig not set");
  };

  connect = (outputUrl: string) => {
    const url = new URL(this.descriptor.url!);
    url.protocol = window.location.protocol === "http:" ? "ws" : "wss";
    const websocketUrl = url.toString() + outputUrl.slice(1);
    const socket = new WebSocket(websocketUrl);
    socket.onopen = (event) => {
      socket.send(
        JSON.stringify({
          ping: "Hello",
        })
      );
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (err) {
        console.error("Received invalid message", event.data);
        return;
      }

      if (message.type === RemoteRuntimeMessageType.RESULT) {
        this.onResult(null, message.data, null);
      } else if (message.type === RemoteRuntimeMessageType.CONFIGURATION) {
        this.onConfig(message.data.instanceId, message.data.config);
      } else {
        console.warn(
          `Unknown message reived in remote runtime scope: ${JSON.stringify(
            event.data
          )}`
        );
      }
    };
  };
}
