import { parseResponse } from './MultiformParser';
import { restoreToken } from '../core/Auth';

export default class WebsocketChannel {
  constructor(websocketId, onAction, secureConnection) {
    this.websocket = null;
    this.websocketId = websocketId;
    this.onAction = onAction;
    this.secureConnection = secureConnection;
  }

  open = url => {
    return new Promise((resolve, reject) => {
      if (this.websocket) {
        this.close();
      }
      this.pendingOpenPromise = { resolve, reject };
      const protocol = this.secureConnection ? 'wss' : 'ws';
      const full = url.absolute ? url.absolute : `${protocol}://${url}`;
      this.websocket = new WebSocket(full, restoreToken());
      this.websocket.binaryType = 'arraybuffer';
      this.websocket.onmessage = this.onMessage;
      this.websocket.onclose = this.onClose;
      this.websocket.onerror = this.onError;
      this.websocket.onopen = this.onOpen;
    });
  }

  close = () => {
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject('Socket was closed during opening');
      this.pendingOpenPromise = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  send(data) {
    if (this.websocket) {
      this.websocket.send(JSON.stringify(data));
    }
  }

  onError = error => {
    console.error(`Error on WebSocket ${this.websocketId} Error: `, error);
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject(error);
      this.pendingOpenPromise = null;
    }
  };

  onOpen = event => {
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.resolve();
      this.pendingOpenPromise = null;
    }
  }

  onClose = event => {
    console.log(`Closed WebSocket from ${this.websocketId}`);
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject();
      this.pendingOpenPromise = null;
    }
  };

  onMessage = event => {
    const message = parseResponse(event.data);
    if (message instanceof Blob) {
      return this.onAction(message);
    }
    const action = message.json ? 
      rebuild(message.json.payload, message) : // message is a multipart/form
      JSON.parse(message);
    
    return this.onAction(action);
  };
}

function rebuild(json, message) {
  return Object.keys(json).reduce(
    (acc, key) => {
      const value = json[key];
      if (typeof value === 'object') {
        return { ...acc, [key]: rebuild(value, message) };
      }
      if (value.startsWith && value.startsWith('+binary-data-@')) {
        const blob = new Blob(
          [message[value].payload],
          { type : message[value].headers['content-type'] },
        );
        return { ...acc, [key]: blob };
      } else {
        return { ...acc, [key]: value };
      }
    },
    {}
  );
}
