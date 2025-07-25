import { isSecureConnection } from "../../../core/url";
import WebsocketChannel from "../../WebsocketChannel";
import { replacePlaceholders } from "../../../core/url";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";

import OutputUI from "./OutputUI";
import { createAuthorizedURL } from "hkp-frontend/src/views/playground/common";

const serviceId = "hookup.to/service/output";
const serviceName = "Output";

type State = {
  mode: "websocket" | "post";
  url: string;
  flow: "stop" | "pass";
  headers: Record<string, string>;
};

class Output extends ServiceBase<State> {
  _websocket: WebsocketChannel | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      mode: "websocket",
      url: "",
      flow: "stop",
      headers: {},
    });
    this.bypass = true;
  }

  configure(config: any) {
    const { url, flow, headers, mode, bypass } = config;

    if (url !== undefined) {
      this.state.url = replacePlaceholders(url);
      this.app.notify(this, { url });
    }

    if (mode !== undefined) {
      this.state.mode = mode;
      this.app.notify(this, { mode });
    }

    if (flow !== undefined) {
      this.state.flow = flow;
      this.app.notify(this, { flow });
    }

    if (headers !== undefined) {
      this.state.headers = headers;
      this.app.notify(this, { headers });
    }

    if (bypass !== undefined) {
      this.bypass = bypass;
      this.app.notify(this, { bypass });
    }
  }

  destroy() {
    if (this._websocket) {
      this._websocket.close();
      this._websocket = null;
    }
  }

  connectWebsocket = async (url: string) => {
    const ws = new WebsocketChannel(
      `output-service-${this.uuid}`,
      this.onReceive,
      isSecureConnection()
    );

    ws.onError = (err) => {
      console.log("Output websocket on error triggered", err);
      this.destroy();
      this.bypass = true;
      this.app.notify(this, { bypass: this.bypass });
    };

    ws.onClose = () => {
      console.log("Output websocket connection closed");
      this.destroy();
    };

    await ws.open({ absolute: url });
    return ws;
  };

  onReceive = (data: any) => {
    console.log("Output.onReceive", data);
  };

  async process(params: any) {
    const { url, mode } = this.state;

    if (url && !this.bypass) {
      if (mode === "websocket") {
        if (!this._websocket) {
          const urlWithAuth = createAuthorizedURL(
            url,
            this.app.getAuthenticatedUser()
          );
          this._websocket = await this.connectWebsocket(urlWithAuth);
        }
        this._websocket.send(params);
      } else if (mode === "post") {
        fetch(url, {
          method: "post",
          body: JSON.stringify(params),
          headers: this.state.headers,
        });
      }
    }

    switch (this.state.flow) {
      case "stop":
        return null;
      default:
        return params;
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) => new Output(app, board, descriptor, id),
  createUI: OutputUI,
};

export default descriptor;
