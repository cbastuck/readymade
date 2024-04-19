import { ServiceInstance, ServiceUIProps } from "@/types";
import { Component } from "react";
import { TextArea } from "semantic-ui-react";

import Editor from "hkp-frontend/src/components/shared/Editor/index";
import Button from "hkp-frontend/src/components/shared/Button";

import ServiceUI from "hkp-frontend/src/runtime/services/ServiceUI";

import { s, t } from "hkp-frontend/src/styles";

const ACTION_BAR_HEIGHT = "45";

export default class MonitorUI extends Component<ServiceUIProps> {
  state = {
    message: "",
    renderTextEditor: true,
  };

  onInit = (initialState: any) => {
    this.setState({
      ...initialState,
    });
  };

  onNotification = (_: ServiceInstance, params: any) => {
    const nil = params === null && "<null>";
    const undef = params === undefined && "<undefined>";
    const s = nil || undef || unroll(params);
    console.log("GOT NOTIFI", params);

    const { bypass } = params || {};
    if (bypass !== undefined) {
      return;
    }

    this.setState({
      message: isObject(s) ? JSON.stringify(s, null, 2) : s,
    });
  };

  clearEditor = () => this.setState({ message: "" });

  switchEditor = () =>
    this.setState({ renderTextEditor: !this.state.renderTextEditor });

  renderEditor = () =>
    this.state.renderTextEditor ? (
      <TextArea
        style={{
          margin: "5px 10px",
          fontFamily: "monospace",
          fontWeight: "bold",
          resize: "none",
          border: "1px solid lightgray",
          borderRadius: 5,
          flexGrow: 1,
        }}
        value={this.state.message}
        rows={10}
        cols={30}
      />
    ) : (
      <div
        style={s(t.m("5px 10px"), {
          height: `calc(100% - ${ACTION_BAR_HEIGHT}px)`,
        })}
      >
        <Editor
          value={this.state.message}
          language="json"
          onChange={(val) => this.setState({ message: val })}
        />
      </div>
    );

  renderActionBar = (service: ServiceInstance) => (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        margin: "0px 10px",
        marginBottom: 5,
        height: `${ACTION_BAR_HEIGHT} - 15}px`,
      }}
    >
      <Button onClick={this.clearEditor} style={{ width: "100%" }}>
        Clear
      </Button>

      <Button onClick={this.switchEditor} style={{ width: "100%" }}>
        {this.state.renderTextEditor ? "Edit" : "Back"}
      </Button>
      <Button
        style={{ width: "100%" }}
        onClick={() => {
          let data;
          try {
            data = JSON.parse(this.state.message);
          } catch (err) {
            data = this.state.message;
          }
          service.app.next(service, data);
        }}
      >
        Inject
      </Button>
    </div>
  );

  render() {
    return (
      <ServiceUI
        {...this.props}
        onInit={this.onInit}
        onNotification={this.onNotification}
      >
        {({ service }: { service: ServiceInstance }) =>
          service && (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {this.renderEditor()}
              {this.renderActionBar(service)}
            </div>
          )
        }
      </ServiceUI>
    );
  }
}

function isObject(obj: any) {
  return typeof obj === "object" && obj !== null;
}

function unroll(params: any): any {
  const isBlob = params instanceof Blob;
  if (isBlob) {
    return `Blob (${params.type} ${params.size} bytes)`;
  }

  const isUint8Array = params instanceof Uint8Array;
  if (isUint8Array) {
    return `Uint8Array of ${params.length} bytes)`;
  }

  const isPrimitive = !isObject(params);
  if (isPrimitive) {
    return params;
  }
  const isArray = Array.isArray(params);
  if (isArray) {
    return params.map((x) => unroll(x));
  }
  return Object.keys(params).reduce(
    (all, key) => ({
      ...all,
      [key]: unroll(params[key]),
    }),
    {}
  );
}
