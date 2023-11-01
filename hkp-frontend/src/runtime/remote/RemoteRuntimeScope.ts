import { AppImpl, RuntimeDescriptor, RuntimeScope } from "../../types";
import WebsocketChannel from "../WebsocketChannel";
import { createRemoteRuntimeApp } from "./RemoteRuntimeApp";

export default class RemoteRuntimeScope implements RuntimeScope {
  app: AppImpl;
  descriptor: RuntimeDescriptor; // TODO: better keep the whole runtime descriptor - change API
  outputUrl: string;
  websocket: WebSocket | null;

  constructor(runtime: RuntimeDescriptor, outputUrl: string) {
    this.app = createRemoteRuntimeApp(this);
    this.descriptor = runtime;
    this.outputUrl = outputUrl;
    this.websocket = null;

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

  connect = (outputUrl: string) => {
    const url = new URL(this.descriptor.url!);
    url.protocol = "ws";
    const websocketUrl = url.toString() + outputUrl.slice(1);
    console.log("USNG Websovket Url", websocketUrl);
    const socket = new WebSocket(websocketUrl);
    socket.onopen = (event) => {
      console.log("CONNECTED TO WEBSOKET");
      socket.send("Here's some text that the server is urgently awaiting!");
    };
    socket.onmessage = (event) => {
      console.log("Received On websocket", event.data);
    };

    this.websocket = socket;
  };
}
