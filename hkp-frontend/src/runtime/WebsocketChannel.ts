import { parseResponse } from "./MultiformParser";

type AbsoluteURL = { absolute: string };
type WebSocketURL = string | AbsoluteURL;

interface PendingOpenPromise {
  resolve: () => void;
  reject: (reason?: any) => void;
}

export default class WebsocketChannel {
  websocket: WebSocket | null;
  websocketId: string;
  onAction: (action: any, message?: any) => void;
  secureConnection: boolean;
  onCloseCallback: (() => void) | null;
  pendingOpenPromise: PendingOpenPromise | null;
  websocketOpenedSuccessfully: boolean;

  constructor(
    websocketId: string,
    onAction: (action: any, message?: any) => void,
    secureConnection: boolean,
    onClose: (() => void) | null
  ) {
    this.websocket = null;
    this.websocketId = websocketId;
    this.onAction = onAction;
    this.secureConnection = secureConnection;
    this.onCloseCallback = onClose;
    this.pendingOpenPromise = null;
    this.websocketOpenedSuccessfully = false;
  }

  open = (url: WebSocketURL, subprotocol?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (this.websocket) {
        this.close();
      }
      this.pendingOpenPromise = { resolve, reject };
      const protocol = this.secureConnection ? "wss" : "ws";
      const full = (url as AbsoluteURL).absolute
        ? (url as AbsoluteURL).absolute
        : `${protocol}://${url}`;
      this.websocket = new WebSocket(full, subprotocol);
      this.websocket.binaryType = "arraybuffer";
      this.websocket.onmessage = this.onMessage;
      this.websocket.onclose = this.onClose;
      this.websocket.onerror = this.onError;
      this.websocket.onopen = this.onOpen;
    });
  };

  close = (): void => {
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject("Socket was closed during opening");
      this.pendingOpenPromise = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  };

  send(data: any, raw: boolean = false): void {
    if (this.websocket) {
      this.websocket.send(raw ? data : JSON.stringify(data));
    }
  }

  onError = (error: Event): void => {
    console.error(`Error on WebSocket ${this.websocketId} Error: `, error);
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject(error);
      this.pendingOpenPromise = null;
    }
  };

  onOpen = (_event: Event): void => {
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.resolve();
      this.pendingOpenPromise = null;
      this.websocketOpenedSuccessfully = true;
    }
  };

  onClose = (_event: CloseEvent): void => {
    console.log(`Closed WebSocket from ${this.websocketId}`);
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject();
      this.pendingOpenPromise = null;
    }
    if (this.websocketOpenedSuccessfully && this.onCloseCallback) {
      this.onCloseCallback();
    }
    this.websocketOpenedSuccessfully = false;
  };

  onMessage = (event: MessageEvent): void => {
    if (event.data) {
      const message = parseResponse(event.data);
      if (message instanceof Blob) {
        return this.onAction(message);
      }

      const action = (message as any).json
        ? rebuild((message as any).json.payload, message) // message is a multipart/form
        : typeof message === "string"
        ? JSON.parse(message)
        : message;

      return this.onAction(action, message);
    }
  };
}

function rebuild(json: Record<string, any>, message: any): Record<string, any> {
  return Object.keys(json).reduce<Record<string, any>>((acc, key) => {
    const value = json[key];
    if (typeof value === "object") {
      return { ...acc, [key]: rebuild(value, message) };
    }
    if (value.startsWith && value.startsWith("+binary-data-@")) {
      const blob = new Blob([message[value].payload], {
        type: message[value].headers["content-type"],
      });
      return { ...acc, [key]: blob };
    } else {
      return { ...acc, [key]: value };
    }
  }, {});
}
