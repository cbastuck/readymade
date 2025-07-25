import WebsocketChannel from "../../WebsocketChannel";
import {
  replacePlaceholders,
  isSecureConnection,
  isWebsocket,
} from "../../../core/url";

import InputUI from "./InputUI";
import { AppInstance, ServiceClass } from "hkp-frontend/src/types";
import ServiceBase from "./ServiceBase";
import { createAuthorizedURL } from "hkp-frontend/src/views/playground/common";

const serviceId = "hookup.to/service/input";
const serviceName = "Input";

export type InputMode = "eventsource" | "websocket";

export type State = {
  url: string;
  mode: InputMode;
  parseEventsAsJSON: boolean;
};

class Input extends ServiceBase<State> {
  _eventSource: EventSource | null = null;
  _websocket: WebsocketChannel | null = null;
  closeEventSourceConnection: null | (() => void) = null;

  constructor(
    app: AppInstance,
    board: string,
    descriptor: ServiceClass,
    id: string
  ) {
    super(app, board, descriptor, id, {
      url: "",
      mode: "eventsource",
      parseEventsAsJSON: true,
    });
  }

  async configure(config: any) {
    const { url, mode, bypass } = config;

    let reconnect = bypass === false; // reconnect when bypass explicity changed
    if (url !== undefined && url) {
      if (isWebsocket(url) && this.state.mode === "eventsource") {
        this.state.mode = "websocket";
      }
      this.state.url = replacePlaceholders(url);
      reconnect = true;
      this.app.notify(this, { url, mode: this.state.mode });
    }

    if (mode !== undefined) {
      this.state.mode = mode;
      reconnect = true;
      this.app.notify(this, { mode });
    }

    if (reconnect) {
      this.doConnect();
    }

    if (bypass === true) {
      // explicit disconnect
      this.doDisconnect();
    }
  }

  doDisconnect = () => {
    if (this.state.mode === "websocket") {
      if (this._websocket) {
        this._websocket.close();
        this._websocket = null;
      } else {
        if (this._eventSource) {
          this._eventSource.close();
          this._eventSource = null;
        }
      }
    }
  };

  onEventSourceData(event: MessageEvent) {
    if (!this.bypass) {
      const { data } = event;
      if (data) {
        const params = this.state.parseEventsAsJSON
          ? JSON.parse(data)
          : { raw: data };
        this.app.next(this, params);
      }
    }
  }

  onCloseWebsocket = () => {};

  doConnectWebsocket = async (url: string) => {
    this._websocket = new WebsocketChannel(
      `input-service-${this.uuid}`,
      (params: any) => {
        if (!this.bypass) {
          const { action } = params;
          if (action === "ping") {
            return;
          }
          this.app.next(this, params);
        }
      },
      isSecureConnection(),
      this.onCloseWebsocket
    );

    try {
      await this._websocket.open({
        absolute: url,
      });
      this.setBypass(false);
      // this._websocket.send({ topic });
    } catch (_err) {
      this.setBypass(true);
    }
  };

  doConnectEventSource = async (url: string) => {
    try {
      if (isWebsocket(url)) {
        console.warn("Wrong schema for connecting event source", url);
        return;
      }
      const resp = await fetch(url);
      const contentType = resp.headers.get("content-type") || "";
      if (contentType.indexOf("text/event-stream") !== -1) {
        return this.openEventSource(url);
      }
    } catch (err) {
      console.error("Input fetch failed with error: ", err);
      this.bypass = true;
      this.app.notify(this, { bypass: this.bypass });
    }
  };

  async doConnect() {
    this.closeConection();
    const { url, mode } = this.state;
    if (!url) {
      return;
    }

    const urlWithAuth = createAuthorizedURL(
      url,
      this.app.getAuthenticatedUser()
    );
    if (mode === "websocket") {
      this.doConnectWebsocket(urlWithAuth);
    } else {
      this.doConnectEventSource(urlWithAuth);
    }
  }

  openEventSource = (url: string) => {
    this._eventSource = new EventSource(url);
    this._eventSource.onopen = () => {
      if (this._eventSource) {
        const listener = this.onEventSourceData.bind(this);
        this._eventSource.onmessage = listener;
        this._eventSource.addEventListener("data", listener);
        this.closeEventSourceConnection = () => {
          if (this._eventSource) {
            this._eventSource.removeEventListener("data", listener);
            this._eventSource.close();
            this._eventSource = null;
            this.closeEventSourceConnection = null;
          }
        };
      }
    };
  };

  closeConection() {
    if (this._websocket) {
      this._websocket.close();
      this._websocket = null;
    }

    if (this.closeEventSourceConnection) {
      this.closeEventSourceConnection();
    }
  }

  destroy() {
    this.closeConection();
  }

  async process(params: any) {
    return params;
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
  ) => new Input(app, board, descriptor, id),
  createUI: InputUI,
};

export default descriptor;
