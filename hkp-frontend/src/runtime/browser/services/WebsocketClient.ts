import WebsocketChannel from "../../WebsocketChannel";
import { isSecureConnection } from "../../../core/url";

import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { createAuthorizedURL } from "hkp-frontend/src/views/playground/common";
import WebsocketClientUI from "./WebsocketClientUI";

const serviceId = "hookup.to/service/websocket-client";
const serviceName = "WebSocket Client";

type State = {
  url: string;
};

class WebsocketClient extends ServiceBase<State> {
  _websocket: WebsocketChannel | null = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) {
    super(app, board, descriptor, id, { url: "" });
  }

  async configure(config: any) {
    const { url, bypass } = config;

    let reconnect = bypass === false;

    if (url !== undefined && url) {
      this.state.url = url;
      reconnect = true;
      this.app.notify(this, { url });
    }

    if (bypass === true) {
      this.doDisconnect();
    } else if (reconnect) {
      this.doConnect();
    }
  }

  doDisconnect() {
    if (this._websocket) {
      this._websocket.close();
      this._websocket = null;
    }
  }

  async doConnect() {
    this.doDisconnect();
    const { url } = this.state;
    if (!url) {
      return;
    }

    const urlWithAuth = createAuthorizedURL(
      url,
      this.app.getAuthenticatedUser(),
    );

    this._websocket = new WebsocketChannel(
      `websocket-client-${this.uuid}`,
      (params: any) => {
        console.log("WebsocketClient received", params);
        if (this.bypass) {
          return;
        }
        if (params.action === "ping") {
          return;
        }
        this.app.next(this, params);
      },
      isSecureConnection(),
      () => {},
    );

    try {
      await this._websocket.open({ absolute: urlWithAuth });
      this.setBypass(false);
    } catch (_err) {
      this.setBypass(true);
    }
  }

  async process(params: any) {
    if (this._websocket) {
      console.log("WebsocketClient.process", params);
      this._websocket.send(params);
    }
    return null;
  }

  destroy() {
    this.doDisconnect();
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string,
  ) => new WebsocketClient(app, board, descriptor, id),
  createUI: WebsocketClientUI,
};

export default descriptor;
