import { parseResponse } from './MultiformParser';
import { restoreToken } from '../core/Auth';

export default class WebsocketChannel {
  constructor(websocketId, onAction) {
    this.websocketId = websocketId;
    this.onAction = onAction;
  }

  open = url => {
    return new Promise((resolve, reject) => {
      if (this.websocket) {
        this.close();
      }
      this.pendingOpenPromise = { resolve, reject };
      this.websocket = new WebSocket(`ws://${url}`, restoreToken()); // TODO: not WSS?
      this.websocket.binaryType = 'arraybuffer';
      this.websocket.onmessage = this.onMessage;
      this.websocket.onclose = this.onClose;
      this.websocket.onerror = this.onError;
      this.websocket.onopen = this.onOpen;
    });
  }

  close = () => {
    if (this.pendingOpenPromise) {
      return false;
    }

    if (this.websocket) {
      console.log('!!!!!Todo implement WebsocketChannel.close!!!!!');
    }
    return true;
  }

  onError = error => {
    console.error(`Error on WebSocket ${this.websocketId} Error: `, error);
    if (this.pendingOpenPromise) {
      this.pendingOpenPromise.reject(error);
      this.pendingOpenPromise = null;
    }
  };

  onOpen = event => {
    console.log(`WebSocket to ${this.websocketId} is open`);
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
    const action = message.json ? 
      rebuild(message.json.payload, message) : 
      JSON.parse(message);
    this.onAction(action);
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
