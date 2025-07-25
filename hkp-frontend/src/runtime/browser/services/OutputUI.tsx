import { Component } from "react";

import { s, t } from "../../../styles";
import InputField from "../../../components/shared/InputField";
import SelectorField from "hkp-frontend/src/components/shared/SelectorField";
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI from "hkp-frontend/src/ui-components/service/ServiceUI";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

type State = {
  bypass: boolean;
  mode: "websocket" | "post";
  url: string;
  flow: string;
  headers: { [key: string]: any };
};

export default class OutputUI extends Component<ServiceUIProps, State> {
  state: State = {
    bypass: true,
    mode: "websocket",
    url: "",
    headers: {},
    flow: "stop",
  };

  onInit = (initialState: any) => {
    const {
      url = "",
      bypass = true,
      flow = "stop",
      headers = {},
      mode = "websocket",
    } = initialState;

    this.setState({
      url,
      bypass,
      flow,
      headers,
      mode,
    });
  };

  onNotification = (notification: any) => {
    const { url, bypass, flow, headers, mode } = notification;

    if (mode !== undefined && this.state.mode !== mode) {
      this.setState({ mode });
    }
    if (url !== undefined && this.state.url !== url) {
      this.setState({ url });
    }

    if (bypass !== undefined && this.state.bypass !== bypass) {
      this.setState({ bypass });
    }

    if (flow !== undefined) {
      this.setState({ flow });
    }

    if (headers !== undefined) {
      this.setState({ headers });
    }
  };

  renderMain = () => {
    const { url, flow, headers, mode } = this.state;
    const { service } = this.props;
    const headerKeys = Object.keys(headers);
    return (
      <div className="flex flex-col">
        <RadioGroup
          title="Mode"
          options={["websocket", "post"]}
          value={mode}
          onChange={(newMode) => service.configure({ mode: newMode })}
        />
        <InputField
          label="URL"
          value={url}
          onChange={(value) => service.configure({ url: value })}
        />

        {headerKeys.length > 0 && (
          <div style={s(t.tl, t.ls1, t.fs12, t.mt3)}>
            <div>Headers</div>
            {headerKeys.map((key) => (
              <InputField
                key={`output-header-${service.uuid}-${key}`}
                label={key}
                value={headers[key]}
                onChange={async (newValue) => {
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

        <SelectorField
          className="py-1"
          label="Flow"
          style={t.m(0, 10)}
          options={{
            stop: "stop",
            pass: "pass",
          }}
          value={flow}
          onChange={({ value: flow }) => service.configure({ flow })}
        />
      </div>
    );
  };

  render() {
    return (
      <ServiceUI
        {...this.props}
        initialSize={{ width: 300, height: undefined }}
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {this.renderMain()}
      </ServiceUI>
    );
  }
}
