import { parseResponse } from "./MultiformParser";

export default class WebsocketChannel {
  constructor(websocketId, onAction, secureConnection, onClose) {
    this.websocket = null;
    this.websocketId = websocketId;
    this.onAction = onAction;
    this.secureConnection = secureConnection;
    this.onCloseCallback = onClose;
  }

  open = (url, subprotocol) => {
    return new Promise((resolve, reject) => {
      if (this.websocket) {
        this.close();
      }
      this.pendingOpenPromise = { resolve, reject };
      const protocol = this.secureConnection ? "wss" : "ws";
      const full = url.absolute ? url.absolute : `${protocol}://${url}`;
      this.websocket = new WebSocket(full, subprotocol);
      this.websocket.binaryType = "arraybuffer";
      this.websocket.onmessage = this.onMessage;
      this.websocket.onclose = this.onClose;
      this.websocket.onerror = this.onError;
      this.websocket.onopen = this.onOpen;
    });
  };

  close = () => {
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject("Socket was closed during opening");
      this.pendingOpenPromise = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  };

  send(data, raw = false) {
    if (this.websocket) {
      this.websocket.send(raw ? data : JSON.stringify(data));
    }
  }

  onError = (error) => {
    console.error(`Error on WebSocket ${this.websocketId} Error: `, error);
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject(error);
      this.pendingOpenPromise = null;
    }
  };

  onOpen = (event) => {
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.resolve();
      this.pendingOpenPromise = null;
      this.websocketOpenedSuccessfully = true;
    }
  };

  onClose = (event) => {
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

  onMessage = (event) => {
    if (event.data) {
      const message = parseResponse(event.data);
      if (message instanceof Blob) {
        return this.onAction(message);
      }

      const action = message.json
        ? rebuild(message.json.payload, message) // message is a multipart/form
        : typeof message === "string"
        ? JSON.parse(message)
        : message;

      return this.onAction(action, message);
    }
  };
}

function rebuild(json, message) {
  return Object.keys(json).reduce((acc, key) => {
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
