import React, { Component } from "react";
import { Checkbox } from "semantic-ui-react";

import ServiceUI from "../../services/ServiceUI";
import { s, t } from "../../../styles";
import InputField from "../../../components/shared/InputField";
import SelectorField from "../../../components/shared/SelectorField";
import { request } from "../../../core/actions";
import { isWebsocket, isSecureConnection } from "../../../core/url";
import WebsocketChannel from "../../WebsocketChannel";
// import { serializeWebsocketBuffer } from '../../core/format';
import { replacePlaceholders } from "../../../core/url";

const serviceId = "hookup.to/service/output";
const serviceName = "Output";

export class OutputUI extends Component {
  state = {
    url: "",
    headers: {},
  };

  onInit = (initialState) => {
    const {
      url = "",
      running = false,
      flow = "cancel",
      headers = {},
    } = initialState;
    this.setState({
      url,
      running,
      flow,
      headers,
    });
  };

  onNotification = (service, notification) => {
    const { url, running, flow, headers } = notification;

    if (url !== undefined && this.state.url !== url) {
      this.setState({ url });
    }

    if (running !== undefined && this.state.running !== running) {
      this.setState({ running });
    }

    if (flow !== undefined) {
      this.setState({ flow });
    }

    if (headers !== undefined) {
      this.setState({ headers });
    }
  };

  renderMain = (service) => {
    const { running, url, flow, headers } = this.state;
    const headerKeys = Object.keys(headers);
    return (
      <div style={t.m10}>
        <div style={s(t.ls1, t.fs12)}>
          <InputField
            label="URL"
            value={url}
            onChange={(_, { value }) => {
              this.setState({ url: value });
              service.configure({ url: value });
            }}
          />
        </div>
        {headerKeys.length > 0 && (
          <div style={s(t.tl, t.ls1, t.fs12, t.mt3)}>
            <div>Headers</div>
            {headerKeys.map((key) => (
              <InputField
                key={`output-header-${service.uuid}-${key}`}
                label={key}
                value={headers[key]}
                onChange={async (_, { value: newValue }) => {
                  const newHeaders = {
                    ...this.state.headers,
                    [key]: newValue,
                  };
                  await service.configure({ headers: newHeaders });
                }}
              />
            ))}
          </div>
        )}
        <div style={t.tl}>
          <Checkbox
            style={s(t.mt5, t.ls1, t.fs12)}
            label="output active"
            toggle
            onChange={(_, { checked }) => {
              if (checked) {
                service.configure({ running: true });
              } else {
                service.configure({ running: false });
              }
            }}
            checked={running}
          />
        </div>
        <SelectorField
          label="flow"
          style={t.m(0, 10)}
          options={{
            cancel: "cancel",
            pass: "pass-through",
          }}
          value={flow}
          onChange={async (_ev, { value: flow }) => {
            await service.configure({ flow });
            this.setState({ flow });
          }}
        />
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

class Output {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.running = false;
    this.url = "";
    this.flow = "cancel";
    this.headers = {};
  }

  configure(config) {
    const { url, running, flow, headers } = config;

    if (running !== undefined) {
      this.running = running;
      this.app.notify(this, { running });
    }

    if (url !== undefined) {
      this.url = replacePlaceholders(url);
      this.app.notify(this, { url });
    }

    if (flow !== undefined) {
      this.flow = flow;
      this.app.notify(this, { flow });
    }

    if (headers !== undefined) {
      this.headers = headers;
      this.app.notify(this, { headers });
    }
  }

  destroy() {
    if (this._websocket) {
      this._websocket.close();
      this._websocket = null;
    }
  }

  connectWebsocket = async (url) => {
    const ws = new WebsocketChannel(
      `output-service-${this.uuid}`,
      (params) => {},
      isSecureConnection()
    );
    await ws.open({ absolute: url });
    return ws;
  };

  async process(params) {
    const { url, running } = this;

    if (url && running) {
      if (isWebsocket(url)) {
        /*
        if (!this._websocket) {
          this._websocket = await this.connectWebsocket(url);
        }
         const buffer = await serializeWebsocketBuffer(
            params, 
            {}
          );
        this._websocket.send(buffer);
        */
      } else {
        request({ absolute: url }, "POST", false, params, this.headers);
      }
    }

    switch (this.flow) {
      case "cancel":
        return null;
      default:
        return params;
    }
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Output(app, board, descriptor, id),
  createUI: OutputUI,
};

export default descriptor;
