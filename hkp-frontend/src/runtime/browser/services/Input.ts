import WebsocketChannel from "../../WebsocketChannel";
import {
  replacePlaceholders,
  isSecureConnection,
  isWebsocket,
} from "../../../core/url";

import InputUI from "./InputUI";
import { AppInstance, ServiceClass } from "@/types";
import ServiceBase from "./ServiceBase";

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

  async doConnect() {
    this.closeConection();
    const { url, mode } = this.state;
    if (!url) {
      return;
    }

    if (mode === "websocket") {
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
        isSecureConnection()
      );

      await this._websocket.open({
        absolute: url + `?token=${this.app.getAuthenticatedUser()?.idToken}`,
      });
      // this._websocket.send({ topic });
    } else {
      try {
        const resp = await fetch(url);
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.indexOf("text/event-stream") !== -1) {
          this.app.notify(this, { canFetch: false });
          return this.openEventSource(url);
        }
      } catch (err) {
        console.error("Input fetch failed with error: ", err);
      }
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

  async configure(config: any) {
    const { url, mode } = config;

    let reconnect = false;
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
  }

  destroy() {
    if (this.closeEventSourceConnection) {
      this.closeEventSourceConnection();
    }
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
