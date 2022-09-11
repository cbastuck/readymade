import React, { Component } from "react";
import { Checkbox, Button } from "semantic-ui-react";

import InputField from "../../components/shared/InputField";
import ServiceUI from "./ServiceUI";
import { s, t } from "../../styles";
import WebsocketChannel from "../WebsocketChannel";
import {
  replacePlaceholders,
  isWebsocket,
  isSecureConnection,
} from "../../core/url";

const serviceId = "hookup.to/service/input";
const serviceName = "Input";

class InputUI extends Component {
  state = {
    url: "",
    topic: "secret-key",
    isWebsocket: false,
    canFetch: undefined,
  };

  onInit = (initialState) => {
    const {
      url = "",
      running = false,
      topic = "secret-key",
      isWebsocket = false,
    } = initialState;
    this.setState({ url, running, topic, isWebsocket });
  };

  onNotification = (service, notification) => {
    const { url, running, topic, isWebsocket, canFetch } = notification;

    if (url !== undefined && this.state.url !== url) {
      this.setState({ url });
    }

    if (running !== undefined && this.state.running !== running) {
      this.setState({ running });
    }

    if (topic !== undefined) {
      this.setState({ topic });
    }

    if (isWebsocket !== undefined) {
      this.setState({ isWebsocket });
    }

    if (canFetch !== undefined) {
      this.setState({ canFetch });
    }
  };

  renderMain = (service) => {
    const { running, url, topic, isWebsocket, canFetch, fetchPending } =
      this.state;
    return (
      <div
        style={{
          margin: 10,
        }}
      >
        <div style={s(t.uc, t.ls1, t.fs12)}>
          <InputField
            label="URL"
            value={url}
            onChange={(_, { value: url }) => {
              this.setState({ url });
              service.configure({ url });
            }}
          />
        </div>
        {isWebsocket && (
          <div style={s(t.uc, t.ls1, t.fs12)}>
            <InputField
              label="topic"
              value={topic}
              onChange={(_, { value: topic }) => {
                this.setState({ topic });
                service.configure({ topic });
              }}
            />
          </div>
        )}
        {canFetch === true && (
          <Button
            style={s(t.w100, t.uc, t.ls1, t.fs12, { marginTop: 0 })}
            onClick={() => service.configure({ fetch: url })}
            disabled={fetchPending}
          >
            Fetch
          </Button>
        )}
        {canFetch === false && (
          <div style={t.tl}>
            <Checkbox
              style={s(t.mt1, t.uc, t.ls1, t.fs12)}
              label="input active"
              toggle
              onChange={(_, { checked: running }) => {
                service.configure({ running });
              }}
              checked={running}
            />
          </div>
        )}
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
        segments={[{ name: "Main", render: this.renderMain }]}
      />
    );
  }
}

class Input {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.url = "";
    this.parseEventsAsJSON = true;
    this.running = false;
    this.topic = "secret-key";
    this.fetchOnProcess = false;
  }

  onEventSourceData(event) {
    if (this.running) {
      const { data } = event;
      if (data) {
        const params = this.parseEventsAsJSON
          ? JSON.parse(data)
          : { raw: data };
        this.app.next(this, params);
      }
    }
  }

  async doConnect() {
    this.closeConection();

    const { url, topic } = this;
    if (isWebsocket(url)) {
      this._websocket = new WebsocketChannel(
        `input-service-${this.uuid}`,
        (params) => {
          if (this.running) {
            const { action } = params;
            if (action === "ping") {
              return;
            }
            this.app.next(this, params);
          }
        },
        isSecureConnection()
      );
      await this._websocket.open({ absolute: url });
      this._websocket.send({ topic });
    } else {
      try {
        const resp = await fetch(url);
        const contentType = resp.headers.get("content-type");
        if (contentType.indexOf("text/event-stream") !== -1) {
          this.app.notify(this, { canFetch: false });
          return this.openEventSource(url);
        }

        this.app.notify(this, { canFetch: true });
        const data = await this.onFetchResponse(resp);
        this.app.next(this, data); // inject the data
      } catch (err) {
        console.error("Input fetch failed with error: ", err);
      }
    }
  }

  onFetchResponse = async (resp) => {
    if (!resp.ok) {
      return;
    }
    const contentType = resp.headers.get("content-type");
    if (contentType.indexOf("application/json") !== -1) {
      return resp.json();
    }

    if (contentType.indexOf("text/plain") !== -1) {
      return resp.text();
    }

    if (true) {
      // TODO: when is it an array buffer when a blob?
      // -> configure?
      return resp.arrayBuffer();
    } else {
      return resp.blob();
    }
  };

  openEventSource = (url) => {
    this._eventSource = new EventSource(url);
    this._eventSource.onopen = () => {
      const listener = this.onEventSourceData.bind(this);
      this._eventSource.onmessage = listener;
      this._eventSource.addEventListener("data", listener);

      this.closeEventSourceConnection = () => {
        this._eventSource.removeEventListener("data", listener);
        this._eventSource.close();
        this._eventSource = null;
        this.closeEventSourceConnection = null;
      };
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

  async configure(config) {
    const { url, running, topic, fetch: fetchUrl, fetchOnProcess } = config;

    let reconnect = false;
    if (topic !== undefined) {
      this.topic = topic;
      reconnect = true;
    }

    if (url !== undefined && url) {
      this.url = replacePlaceholders(url);
      reconnect = true;
      this.app.notify(this, { url });
    }

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
    }

    if (fetchUrl !== undefined) {
      this.url = fetchUrl;
      const data = await this.doFetch(true);
      this.app.next(this, data); // inject the data
    }

    if (reconnect) {
      this.doConnect();
      this.isWebsocket = !!this._websocket;
      this.app.notify(this, { isWebsocket: this.isWebsocket });
    }

    if (fetchOnProcess !== undefined) {
      this.fetchOnProcess = fetchOnProcess;
    }
  }

  doFetch = async () => {
    if (this.url) {
      const resp = await fetch(this.url);
      return this.onFetchResponse(resp);
    }
    console.warn("Input doFetch() without url configured");
  };

  destroy() {
    if (this.closeEventSourceConnection) {
      this.closeEventSourceConnection();
    }
  }

  async process(params) {
    if (this.fetchOnProcess) {
      return this.doFetch();
    }
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new Input(app, board, descriptor, id),
  createUI: InputUI,
};

export default descriptor;
